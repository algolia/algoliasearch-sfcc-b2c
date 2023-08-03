'use strict';

/*
    This job takes the productIDs from a standard B2C product delta export (configured as the job's first step),
    then retrieves the products, enriches them and then sends them to Algolia.

    The B2C Delta Export creates the following folder structure:

    path to the delta export zip:
        Impex / src / platform / outbox / <consumer> / <deltaExportJobName> / <seqNum>.zip

    the zip file's structure once extracted:
        <seqNum>.zip
            ┗━ <UUID>
                ┗─ "catalogs"
                    ┠─ <catalogID1>
                    ┃   ┗╍ "catalog.xml"
                    ┠─ <catalogID2>
                    ┃   ┗╍ "catalog.xml"
                  [...]

    consumer - job parameter, default: "algolia" - the value you specified in the B2C delta export's `Consumers` field (add only one consumer)
    deltaExportJobName - job parameter, default: "productDeltaExport" - the value you specified in the B2C delta export's `Name` field
    seqNum - six-digit zero-padded sequential number, each run of the delta export job increments it by one - looks like this: 000001, 000002, etc.
    UUID - randomly generated by the delta export - looks like this: ebff9c4e-ac8c-4954-8303-8e68ec8b190d
    catalogID - one of the catalogIDs supplied as the job step parameter "catalogIDs" (comma-separated values) - a separate folder is created for each catalogID supplied (but only if there were changed to that catalog)

    The productIDs that are read from the XML files created by the B2C delta export job are added
    to the `changedProducts` structure which looks like this:

        changedProducts: [
            {
                'productID1': true,
                'productID2': true,
                'productID3': false,
                [...]
            },
            {
                'productID4': true,
                [...]
            },
            [...]
        ]

    `changedProducts` is an array of objects with each object containing at most 2000 key-value pairs.
    The _updateOrAddValue() in jobHelper.js makes sure that the keys are unique across the whole structure.
    It was necessary to split the data up into multiple objects due to the SFCC API quota `api.jsObjectSize`
    which limits the number of properties in any JS object to 2000.
    The quota limit for arrays (`api.jsArraySize`) is 20K, so a total of 40M products can be stored in changedProducts.

    You can use a HashMap of HashMaps structure if you need to handle more than 40M products, since the quota for map/set-type
    structures is 20K (so 400M max total). However, the HashMap approach proved to be slower in our testing than this one
    and since this is a delta export, in the majority of job runs the number of products that need to be sent will be nowhere near the 400M figure.
    In short, the job needs to be optimized for a lower number of products instead of sacrificing performance to handle really rare cases.

    The Boolean value of the productID keys indicates whether the product was added/changed (true)
    or removed with <product mode="delete" product-id="${productID}"/> (false).
    These products will be retrieved from the database, enriched and sent to Algolia (or marked for deletion).

 */


/**
 * Second job step of the "AlgoliaProductsDeltaExport" job.
 * Takes the delta export created by the CatalogDeltaExport system job step,
 * enriches/transforms it and then sends it to Algolia for indexing.
 * @param {dw.util.HashMap} parameters Job step parameters - make sure to define the parameters for both job steps as job parameters, not step parameters so that they're shared across the job steps
 * @returns {dw.system.Status} Status
*/
function sendDeltaExportProducts(parameters) {

    var ProductMgr = require('dw/catalog/ProductMgr');
    var File = require('dw/io/File');
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLStreamWriter');
    var Status = require('dw/system/Status');

    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');
    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    var fileHelper = require('*/cartridge/scripts/algolia/helper/fileHelper');

    var AlgoliaProduct = require('*/cartridge/scripts/algolia/model/algoliaProduct');


    // initializing log data
    const updateLogType = 'LastProductDeltaSyncLog';
    var productLogData = algoliaData.getLogData(updateLogType) || {};
    productLogData.processedDate = algoliaData.getLocalDateTime(new Date());
    productLogData.processedError = true;
    productLogData.processedErrorMessage = '';
    productLogData.processedRecords = 0;
    productLogData.processedToUpdateRecords = 0;

    var changedProducts = [];


    // ----------------------------- PART 1: Extracting productIDs from the output of the Delta Export -----------------------------


    // checking if mandatory parameters are present
    if (empty(parameters.consumer) || empty(parameters.deltaExportJobName)) {
        let errorMessage = 'Mandatory job parameters missing!';
        jobHelper.logError(errorMessage);
        productLogData.processedErrorMessage = errorMessage;
        algoliaData.setLogData(updateLogType, productLogData);
        return new Status(Status.ERROR);
    }

    var paramConsumer = parameters.consumer.trim();
    var paramDeltaExportJobName = parameters.deltaExportJobName.trim();

    // creating working folder (same as the delta export output folder) - if there were no previous changes, the delta export job step won't create it
    var l0_deltaExportDir = new File(algoliaConstants.ALGOLIA_DELTA_EXPORT_BASE_FOLDER + paramConsumer + '/' + paramDeltaExportJobName); // Impex/src/platform/outbox/algolia/productDeltaExport

    // return OK if the folder doesn't exist, this means that the CatalogDeltaExport job step finished OK but didn't have any output (there were no changes)
    if (!l0_deltaExportDir.exists()) {
        return new Status(Status.OK);
    }

    // list all the delta export zips in the folder
    var deltaExportZips = fileHelper.getDeltaExportZipList(l0_deltaExportDir);

    // if there are no files to process, there's no point in continuing
    if (empty(deltaExportZips)) {
        return new Status(Status.OK);
    }

    // creating empty temporary "_processing" dir
    var l1_processingDir = new File(l0_deltaExportDir, '_processing');
    if (l1_processingDir.exists()) {
        fileHelper.removeFolderRecursively(l1_processingDir);
    }
    l1_processingDir.mkdir();

    // creating "_completed" dir
    var l1_completedDir = new File(l0_deltaExportDir, '_completed');
    l1_completedDir.mkdir(); // creating "_completed" folder -- does no harm if it already exists

    // process each export zip one by one
    deltaExportZips.forEach(function(filename) {
        var currentZipFile = new File(l0_deltaExportDir, filename); // 000001.zip, 000002.zip, etc.

        // this will create a structure like so: "l0_deltaExportDir/_processing/000001.zip/ebff9c4e-ac8c-4954-8303-8e68ec8b190d/catalogs/...
        var l2_tempZipDir = new File(l1_processingDir, filename);
        if (l2_tempZipDir.mkdir()) { // mkdir() returns a success boolean
            currentZipFile.unzip(l2_tempZipDir);
        }

        // there's a folder with a UUID as a name one level down, we need to open that
        var l3_uuidDir = fileHelper.getFirstChildFolder(l2_tempZipDir); // _processing/000001.zip/ebff9c4e-ac8c-4954-8303-8e68ec8b190d/

        // UUID-named folder has "catalogs" in it, open that
        var l4_catalogsDir = new File(l3_uuidDir, 'catalogs'); // _processing/000001.zip/ebff9c4e-ac8c-4954-8303-8e68ec8b190d/catalogs/

        // -------------------- processing catalog XMLs --------------------

        if (l4_catalogsDir.exists() && l4_catalogsDir.isDirectory()) {

            // getting child catalog folders, there can be more than one - folder name is the ID of the catalog
            var l5_catalogDirList = fileHelper.getChildFolders(l4_catalogsDir);

            // processing catalog.xml files in each folder
            l5_catalogDirList.forEach(function(l5_catalogDir) {

                let catalogFile = new File(l5_catalogDir, 'catalog.xml');

                // adding productsIDs from the XML to the list of changed productIDs
                let result = jobHelper.updateCPObjectFromXML(catalogFile, changedProducts, 'catalog');

                if (result.success) {
                    productLogData.processedRecords += result.nrProductsRead;
                } else {
                    // abort if error reading from any of the delta export zips
                    let errorMessage = 'Error reading from file: ' + catalogFile;
                    jobHelper.logError(errorMessage);
                    productLogData.processedErrorMessage = errorMessage;
                    algoliaData.setLogData(updateLogType, productLogData);
                    return new Status(Status.ERROR);
                }
            });
        }

        // cleanup: removing unzipped files that are already processed, along with their parent dirs
        // this removes `l4_catalogsDir`, `version.txt` from `l3_uuidDir`, `l3_uuidDir` and `l2_tempZipDir` itself
        fileHelper.removeFolderRecursively(l2_tempZipDir);
    });

    // writing number of records read from the B2C delta zips
    jobHelper.logInfo(productLogData.processedRecords + ' records read from B2C delta zips');


    // cleanup - removing "_processing" dir
    fileHelper.removeFolderRecursively(l1_processingDir);


    // ----------------------------- PART 2: Retrieving and enriching the products, writing them to XML -----------------------------


    // there were no changes, no need to proceed, return OK
    if (jobHelper.isObjectsArrayEmpty(changedProducts)) {

        // This is for handling the case where the B2C delta export job creates a zip file with no changed products
        // In this case the script doesn't need to proceed, but the zip file should still be moved to "_completed".
        deltaExportZips.forEach(function(filename) {
            var currentZipFile = new File(l0_deltaExportDir, filename); // 000001.zip, 000002.zip, etc.
            var targetZipFile = new File(l1_completedDir, currentZipFile.getName());
            fileHelper.moveFile(currentZipFile, targetZipFile);

            var currentMetaFile = new File(l0_deltaExportDir, filename.replace('.zip', '.meta')); // each .zip has a corresponding .meta file as well, we'll need to delete these later
            var targetMetaFile = new File(l1_completedDir, currentMetaFile.getName());
            fileHelper.moveFile(currentMetaFile, targetMetaFile);
        });

        productLogData.processedDate = algoliaData.getLocalDateTime(new Date());
        productLogData.processedError = false;
        productLogData.processedErrorMessage = '';
        algoliaData.setLogData(updateLogType, productLogData);

        return new Status(Status.OK);
    }

    // open Delta XML file to write
    var updateFile, updateFileWriter, updateXmlWriter;
    try {
        // <siteID>_product_update.xml
        updateFile = new File(l0_deltaExportDir, algoliaConstants.ALGOLIA_DELTA_EXPORT_UPDATE_FILE_NAME);

        // if there's already an update XML from a previous unsuccessful attempt, remove it
        if (updateFile.exists()) {
            updateFile.remove();
        }

        // creating file, writing start elements
        updateFileWriter = new FileWriter(updateFile, 'UTF-8');
        updateXmlWriter = new XMLStreamWriter(updateFileWriter);
        updateXmlWriter.writeStartDocument();
        updateXmlWriter.writeStartElement('products');

    } catch (error) {
        let errorMessage = 'Error opening delta XML for writing';
        jobHelper.logFileError(updateFile.fullPath, errorMessage, error);
        productLogData.processedErrorMessage = errorMessage;
        algoliaData.setLogData(updateLogType, productLogData);
        return new Status(Status.ERROR);
    }

    // retrieving products from database and enriching them
    changedProducts.forEach(function(currentObject) {
        for (var productID in currentObject) {

            var productUpdateObj;
            var isAvailable = currentObject[productID];

            if (isAvailable) { // <productID>: true - product was either added or modified

                var product = ProductMgr.getProduct(productID); // get product from database, send remove request to Algolia if null

                if (!empty(product)) {
                    var algoliaProduct = new AlgoliaProduct(product);
                    productUpdateObj = new jobHelper.UpdateProductModel(algoliaProduct);

                } else { // the data from the delta export about this product is stale, product can no longer be found in the database -- send a remove request
                    productUpdateObj = new jobHelper.DeleteProductModel(productID);
                }

            } else { // <productID>: false - product is to be deleted
                productUpdateObj = new jobHelper.DeleteProductModel(productID);
            }

            // writing product data to file
            if (productUpdateObj) {
                try {
                    jobHelper.writeObjectToXMLStream(updateXmlWriter, productUpdateObj);
                } catch (error) {
                    let errorMessage = 'Error writing to update XML file';
                    jobHelper.logFileError(updateFile.fullPath, errorMessage, error);

                    productLogData.processedErrorMessage = errorMessage;
                    algoliaData.setLogData(updateLogType, productLogData);

                    updateFileWriter.close();
                    updateXmlWriter.close();
                    return new Status(Status.ERROR);
                }
                productLogData.processedToUpdateRecords++;
            }
        }
    });

    // closing XML update file
    updateXmlWriter.writeEndElement();
    updateXmlWriter.writeEndDocument();
    updateXmlWriter.close();
    updateFileWriter.close();

    // writing number of records written to XML file
    jobHelper.logFileInfo(updateFile.fullPath, productLogData.processedToUpdateRecords + ' records written to update XML file');

    // writing number of processed records to update log
    productLogData.processedDate = algoliaData.getLocalDateTime(new Date());
    productLogData.processedError = false;
    productLogData.processedErrorMessage = '';
    algoliaData.setLogData(updateLogType, productLogData);


    // ----------------------------- PART 3: Sending the contents of the XML to Algolia -----------------------------


    var status = new Status(Status.ERROR);

    var sendHelper = require('*/cartridge/scripts/algolia/helper/sendHelper');
    var deltaIterator = require('*/cartridge/scripts/algolia/helper/deltaIterator');

    // opening delta XML and sending contents to Algolia
    var deltaList = deltaIterator.create(updateFile.fullPath, 'product');
    if (!empty(deltaList)) {
        status = sendHelper.sendDelta(deltaList, updateLogType, parameters); // returns Status.OK if all is well
    }

    if (status.error) {
        let errorMessage = status.details.errorMessage ? status.details.errorMessage : 'Error sending delta. See the logs for details.';
        jobHelper.logError(errorMessage);
        productLogData = algoliaData.getLogData(updateLogType); // need to get it again since sendDelta has updated the file, the in-memory one is out of date
        productLogData.processedErrorMessage = errorMessage;
        algoliaData.setLogData(updateLogType, productLogData);
        return new Status(Status.ERROR);
    }

    // delta successfully sent, remove update file
    updateFile.remove();

    // cleanup: after the products have successfully been sent, move the delta zips from which the productIDs have successfully been extracted and the corresponding products sent to "_completed"
    deltaExportZips.forEach(function(filename) {
        var currentZipFile = new File(l0_deltaExportDir, filename); // 000001.zip, 000002.zip, etc.
        var targetZipFile = new File(l1_completedDir, currentZipFile.getName());
        fileHelper.moveFile(currentZipFile, targetZipFile);

        var currentMetaFile = new File(l0_deltaExportDir, filename.replace('.zip', '.meta')); // each .zip has a corresponding .meta file as well, we'll need to delete these later
        var targetMetaFile = new File(l1_completedDir, currentMetaFile.getName());
        fileHelper.moveFile(currentMetaFile, targetMetaFile);
    });

    return status;
}

module.exports.sendDeltaExportProducts = sendDeltaExportProducts;
