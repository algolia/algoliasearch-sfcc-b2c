'use strict';

var ProductMgr = require('dw/catalog/ProductMgr');
var Site = require('dw/system/Site');
var File = require('dw/io/File');
var logger;

// job step parameters
var paramConsumer, paramDeltaExportJobName, paramAttributeListOverride, paramIndexingMethod;

// Algolia requires
var algoliaData, AlgoliaLocalizedProduct, algoliaProductConfig, jobHelper, fileHelper, reindexHelper, algoliaIndexingAPI, sendHelper, productFilter, CPObjectIterator, AlgoliaJobReport;

// logging-related variables and constants
var jobReport;

var l0_deltaExportDir, l1_processingDir, l1_completedDir;
var changedProducts = [], changedProductsIterator;
var deltaExportZips, siteLocales, nonLocalizedAttributes = [], attributesToSend;

var baseIndexingOperation; // 'addObject' or 'partialUpdateObject', depending on the step parameter 'indexingMethod'
const deleteIndexingOperation = 'deleteObject';
var fullRecordUpdate = false;

/*
 * Rough algorithm of chunk-oriented script module execution:
 *
 *  counter = 0
 *  beforeStep() - executed before starting the job step, initialization
 *    repeat until counter reaches getTotalCount() {
 *         create new thread {
 *             beforeChunk() - executed before each chunk
 *             read() - repeat until chunkSize, each run reads one product
 *             process() - repeat until chunkSize, each run processes one product
 *             write() - executed one time, sends all products from the chunk at once
 *             counter += chunkSize
 *             afterChunk() - executed after each chunk
 *         }
 *     }
 *     afterStep() - executed after the job step finishes
 */

/**
 * before-step-function (steptypes.json)
 * Any returns from this function result in skipping to the afterStep() function (omitting read-process-writealtogether)
 * with the "success" parameter passed to it set to false.
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
*/
exports.beforeStep = function(parameters, stepExecution) {
    algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    AlgoliaLocalizedProduct = require('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
    algoliaProductConfig = require('*/cartridge/scripts/algolia/lib/algoliaProductConfig');
    jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    fileHelper = require('*/cartridge/scripts/algolia/helper/fileHelper');
    reindexHelper = require('*/cartridge/scripts/algolia/helper/reindexHelper');
    algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');
    logger = require('dw/system/Logger').getLogger('algolia', 'Algolia');
    productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');
    sendHelper = require('*/cartridge/scripts/algolia/helper/sendHelper');

    CPObjectIterator = require('*/cartridge/scripts/algolia/helper/CPObjectIterator');
    AlgoliaJobReport = require('*/cartridge/scripts/algolia/helper/AlgoliaJobReport');

    /* --- checking mandatory parameters --- */
    if (empty(parameters.consumer) || empty(parameters.deltaExportJobName)) {
        let errorMessage = 'Mandatory job step parameters missing!';
        jobHelper.logError(errorMessage);
        return;
    }


    /* --- initializing custom object logging --- */
    jobReport = new AlgoliaJobReport(stepExecution.getJobExecution().getJobID(), 'product');
    jobReport.startTime = new Date();


    /* --- parameters --- */
    paramConsumer = parameters.consumer.trim();
    paramDeltaExportJobName = parameters.deltaExportJobName.trim();
    paramAttributeListOverride = algoliaData.csvStringToArray(parameters.attributeListOverride); // attributeListOverride - pass it along to sending method
    paramIndexingMethod = parameters.indexingMethod || 'fullRecordUpdate'; // 'fullRecordUpdate' (default) or 'partialRecordUpdate'


    /* --- B2C delta job parameters --- */
    logger.info('consumer parameter: ' + paramConsumer);
    logger.info('deltaExportJobName parameter: ' + paramDeltaExportJobName);


    /* --- attributeListOverride parameter --- */
    if (empty(paramAttributeListOverride)) {
        attributesToSend = algoliaProductConfig.defaultAttributes_v2;
        const additionalAttributes = algoliaData.getSetOfArray('CustomFields');
        additionalAttributes.map(function(attribute) {
            if (attributesToSend.indexOf(attribute) < 0) {
                attributesToSend.push(attribute);
            }
        });
    } else {
        attributesToSend = paramAttributeListOverride;
    }
    logger.info('attributeListOverride parameter: ' + paramAttributeListOverride);
    logger.info('Actual attributes to be sent: ' + JSON.stringify(attributesToSend));


    /* --- indexingMethod parameter --- */
    switch (paramIndexingMethod) {
        case 'partialRecordUpdate':
            baseIndexingOperation = 'partialUpdateObject';
            break;
        case 'fullRecordUpdate':
        default:
            baseIndexingOperation = 'addObject';
            fullRecordUpdate = true;
            break;
    }
    logger.info('indexingMethod parameter: ' + paramIndexingMethod);


    /* --- non-localized attributes --- */
    Object.keys(algoliaProductConfig.attributeConfig).forEach(function(attributeName) {
        if (!algoliaProductConfig.attributeConfig[attributeName].localized &&
            attributesToSend.indexOf(attributeName) >= 0) {
            if (attributeName !== 'categories') {
                nonLocalizedAttributes.push(attributeName);
            }
        }
    });
    logger.info('Non-localized attributes: ' + JSON.stringify(nonLocalizedAttributes));


    /* --- site locales --- */
    siteLocales = Site.getCurrent().getAllowedLocales();
    logger.info('Enabled locales for ' + Site.getCurrent().getName() + ': ' + siteLocales.toArray());
    jobReport.siteLocales = siteLocales.size();


    algoliaIndexingAPI.setJobInfo({
        jobID: stepExecution.getJobExecution().getJobID(),
        stepID: stepExecution.getStepID()
    });

    // ----------------------------- Extracting productIDs from the output of the Delta Export -----------------------------


    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

    // creating working folder (same as the delta export output folder) - if there were no previous changes, the delta export job step won't create it
    l0_deltaExportDir = new File(algoliaConstants.ALGOLIA_DELTA_EXPORT_BASE_FOLDER + paramConsumer + '/' + paramDeltaExportJobName); // Impex/src/platform/outbox/algolia/productDeltaExport

    // return OK if the folder doesn't exist, this means that the CatalogDeltaExport job step finished OK but didn't have any output (there were no changes)
    if (!l0_deltaExportDir.exists()) {
        return; // return with an empty changedProducts object
    }

    // list all the delta export zips in the folder
    deltaExportZips = fileHelper.getDeltaExportZipList(l0_deltaExportDir);

    // if there are no files to process, there's no point in continuing
    if (empty(deltaExportZips)) {
        return; // return with an empty changedProducts object
    }

    // creating empty temporary "_processing" dir
    l1_processingDir = new File(l0_deltaExportDir, '_processing');
    if (l1_processingDir.exists()) {
        fileHelper.removeFolderRecursively(l1_processingDir);
    }
    l1_processingDir.mkdir();

    // creating "_completed" dir
    l1_completedDir = new File(l0_deltaExportDir, '_completed');
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
                    jobReport.processedItems += result.nrProductsRead;
                } else {
                    // abort if error reading from any of the delta export zips
                    let errorMessage = 'Error reading from file: ' + catalogFile;
                    jobHelper.logError(errorMessage);

                    jobReport.error = true;
                    jobReport.errorMessage = errorMessage;
                    jobReport.writeToCustomObject();
                }
            });
        }

        // cleanup: removing unzipped files that are already processed, along with their parent dirs
        // this removes `l4_catalogsDir`, `version.txt` from `l3_uuidDir`, `l3_uuidDir` and `l2_tempZipDir` itself
        fileHelper.removeFolderRecursively(l2_tempZipDir);
    });

    // cleanup - removing "_processing" dir
    fileHelper.removeFolderRecursively(l1_processingDir);

    changedProductsIterator = new CPObjectIterator(changedProducts);
}

/**
 * total-count-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {number} total number of products
 */
exports.getTotalCount = function(parameters, stepExecution) {
    return jobHelper.getObjectsArrayLength(changedProducts);
}

/**
 * read-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {string} productID
 */
exports.read = function(parameters, stepExecution) {
    let cpObject;
    if (changedProductsIterator && (cpObject = changedProductsIterator.next()) !== null) {
        return cpObject;
    }
}

/**
 * process-function (steptypes.json)
 * @param {Object} cpObj an object containing the productID and the availability of the product
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {Array} an array that contains one AlgoliaOperation per locale:
 *                  [ "action": "addObject", "indexName": "sfcc_products_en_US", body: { "id": "008884303989M", "name": "Fitted Shirt" },
 *                    "action": "addObject", "indexName": "sfcc_products_fr_FR", body: { "id": "008884303989M", "name": "Chemise ajustée" } ]
 */
exports.process = function(cpObj, parameters, stepExecution) {
    var product = ProductMgr.getProduct(cpObj.productID);

    let algoliaOperations = [];

    if (!empty(product) && cpObj.available) {
        if (productFilter.isInclude(product)) {

            // Pre-fetch a partial model containing all non-localized attributes, to avoid re-fetching them for each locale
            let baseModel = new AlgoliaLocalizedProduct({ product: product, locale: 'default', attributeList: nonLocalizedAttributes, fullRecordUpdate: fullRecordUpdate });
            for (let l = 0; l < siteLocales.size(); l++) {
                let locale = siteLocales[l];
                let indexName = algoliaData.calculateIndexName('products', locale);
                let localizedProduct = new AlgoliaLocalizedProduct({ product: product, locale: locale, attributeList: attributesToSend, baseModel: baseModel, fullRecordUpdate: fullRecordUpdate });
                algoliaOperations.push(new jobHelper.AlgoliaOperation(baseIndexingOperation, localizedProduct, indexName));
            }
            jobReport.processedItemsToSend++;
        }
    } else {
        for (let l = 0; l < siteLocales.size(); l++) {
            let locale = siteLocales[l];
            let indexName = algoliaData.calculateIndexName('products', locale);
            algoliaOperations.push(new jobHelper.AlgoliaOperation(deleteIndexingOperation, { objectID: cpObj.productID }, indexName));
        }
        jobReport.processedItemsToSend++;
    }

    jobReport.recordsToSend += algoliaOperations.length; // number of records to be sent to Algolia (one per locale per product)
    return algoliaOperations;
}

/**
 * write-function (steptypes.json)
 * Any returns from this function result in the "success" parameter of "afterStep()" to become false.
 * @param {dw.util.List} algoliaOperations a List containing ${chunkSize} of Algolia operations ready to be sent
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.send = function(algoliaOperations, parameters, stepExecution) {
    var status;

    // algoliaOperations contains all returned Algolia operations from process() as a List of arrays
    var algoliaOperationsArray = algoliaOperations.toArray();
    var productCount = algoliaOperationsArray.length;

    var batch = [];
    for (let i = 0; i < productCount; i++) {
        // the array returned by process() is converted to a dw.util.List
        batch = batch.concat(algoliaOperationsArray[i].toArray());
    }

    var retryableBatchRes = reindexHelper.sendRetryableBatch(batch);
    status = retryableBatchRes.result;
    jobReport.recordsFailed += retryableBatchRes.failedRecords;

    if (status.ok) {
        jobReport.recordsSent += batch.length;
        jobReport.chunksSent++;
    } else {
        jobReport.recordsFailed += batch.length;
        jobReport.chunksFailed++;
    }
}

/**
 * after-step-function (steptypes.json)
 * @param {boolean} success any prior return statements and errors will result in this parameter becoming false
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.afterStep = function(success, parameters, stepExecution) {
    // An exit status cannot be defined for a chunk-oriented script module.
    // Chunk modules always finish with either OK or ERROR.
    // "success" conveys whether an error occurred in any previous chunks or not.
    // Any prior return statements will set success to false (even if it returns Status.OK).

    if (success) {

        jobReport.error = false;
        jobReport.errorMessage = '';

        // cleanup: after the products have successfully been sent, move the delta zips from which the productIDs have successfully been extracted and the corresponding products sent to "_completed"
        deltaExportZips.forEach(function(filename) {
            let currentZipFile = new File(l0_deltaExportDir, filename); // 000001.zip, 000002.zip, etc.
            let targetZipFile = new File(l1_completedDir, currentZipFile.getName());
            fileHelper.moveFile(currentZipFile, targetZipFile);

            let currentMetaFile = new File(l0_deltaExportDir, filename.replace('.zip', '.meta')); // each .zip has a corresponding .meta file as well, we'll need to delete these later
            let targetMetaFile = new File(l1_completedDir, currentMetaFile.getName());
            fileHelper.moveFile(currentMetaFile, targetMetaFile);
        });

    } else {
        jobReport.error = true;
        jobReport.errorMessage = 'An error occurred while sending data. Please see the error log for more details.';
    }

    logger.info('Number of productIDs read from B2C delta zips: {0}', jobReport.processedItems);
    logger.info('Number of products marked for sending: {0}', jobReport.processedItemsToSend);
    logger.info('Number of locales configured for the site: {0}', jobReport.siteLocales);
    logger.info('Records sent: {0}; Records failed: {1}', jobReport.recordsSent, jobReport.recordsFailed);
    logger.info('Chunks sent: {0}; Chunks failed: {1}', jobReport.chunksSent, jobReport.chunksFailed);

    jobReport.endTime = new Date();
    jobReport.writeToCustomObject();

    if (jobReport.chunksFailed > 0) {
        throw new Error('Some chunks failed to be sent, check the logs for details.');
    }

    if (success) {
        logger.info('Indexing completed successfully.');
    } else {
        logger.error('Indexing failed.');
    }
}
