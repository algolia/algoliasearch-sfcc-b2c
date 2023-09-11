'use strict';

var ProductMgr = require('dw/catalog/ProductMgr');
var Status = require('dw/system/Status');
var logger;

// job step parameters
var paramConsumer, paramDeltaExportJobName, paramFieldListOverride;

// Algolia requires
var algoliaData, AlgoliaProduct, jobHelper, algoliaExportAPI, sendHelper, productFilter;

// logging-related variables and constants
var logData;
const updateLogType = 'LastProductDeltaSyncLog';
const resourceType = 'productdelta';

var changedProducts = [];
var changedProductsIterator;
var deltaExportZips;

const MAX_TRIES = 5;

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
    AlgoliaProduct = require('*/cartridge/scripts/algolia/model/algoliaProduct');
    jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    algoliaExportAPI = require('*/cartridge/scripts/algoliaExportAPI');
    logger = require('dw/system/Logger').getLogger('algolia', 'Algolia');
    productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');
    sendHelper = require('*/cartridge/scripts/algolia/helper/sendHelper');

    // checking mandatory parameters
    if (empty(parameters.consumer) || empty(parameters.deltaExportJobName)) {
        let errorMessage = 'Mandatory job step parameters missing!';
        jobHelper.logError(errorMessage);
        return;
    }

    // parameters
    paramConsumer = parameters.consumer.trim();
    paramDeltaExportJobName = parameters.deltaExportJobName.trim();
    paramFieldListOverride = algoliaData.csvStringToArray(parameters.fieldListOverride); // fieldListOverride - pass it along to sendChunk()

    // initializing log data
    logData = algoliaData.getLogData(updateLogType) || {};
    logData.processedDate = algoliaData.getLocalDateTime(new Date());
    logData.processedError = true;
    logData.processedErrorMessage = '';
    logData.processedRecords = 0;
    logData.processedToUpdateRecords = 0;

    logData.sendDate = algoliaData.getLocalDateTime(new Date());
    logData.sendError = true;
    logData.sendErrorMessage = '';
    logData.sentChunks = 0;
    logData.sentRecords = 0;
    logData.failedChunks = 0;
    logData.failedRecords = 0;






    // ----------------------------- Extracting productIDs from the output of the Delta Export -----------------------------

    var File = require('dw/io/File');
    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');
    var fileHelper = require('*/cartridge/scripts/algolia/helper/fileHelper');


    // creating working folder (same as the delta export output folder) - if there were no previous changes, the delta export job step won't create it
    var l0_deltaExportDir = new File(algoliaConstants.ALGOLIA_DELTA_EXPORT_BASE_FOLDER + paramConsumer + '/' + paramDeltaExportJobName); // Impex/src/platform/outbox/algolia/productDeltaExport

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
                    logData.processedRecords += result.nrProductsRead;
                } else {
                    // abort if error reading from any of the delta export zips
                    let errorMessage = 'Error reading from file: ' + catalogFile;
                    jobHelper.logError(errorMessage);
                    logData.processedErrorMessage = errorMessage;
                    algoliaData.setLogData(updateLogType, logData);
                    return;
                }
            });
        }

        // cleanup: removing unzipped files that are already processed, along with their parent dirs
        // this removes `l4_catalogsDir`, `version.txt` from `l3_uuidDir`, `l3_uuidDir` and `l2_tempZipDir` itself
        fileHelper.removeFolderRecursively(l2_tempZipDir);
    });

    // writing number of records read from the B2C delta zips
    jobHelper.logInfo(logData.processedRecords + ' records read from B2C delta zips');

    // cleanup - removing "_processing" dir
    fileHelper.removeFolderRecursively(l1_processingDir);

    changedProductsIterator = new jobHelper.CPObjectIterator(changedProducts);



    // ---------------------------------------------------------------------------------------------------------------------






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
    if (changedProductsIterator && changedProductsIterator.hasNext()) {
        return changedProductsIterator.next();
    }
}

/**
 * process-function (steptypes.json)
 * @param {Object} cpObj an object containing the productID and the availability of the product
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {UpdateProductModel} the product object in the form in which it will be sent to Algolia
 */
exports.process = function(cpObj, parameters, stepExecution) {
    var product = ProductMgr.getProduct(cpObj.productID);
    var productUpdateObj;

    if (!empty(product) && cpObj.available) {
        if (productFilter.isInclude(product)) {

            // enrich product
            var algoliaProduct = new AlgoliaProduct(product, paramFieldListOverride);
            productUpdateObj = new jobHelper.UpdateProductModel(algoliaProduct);

            logData.processedRecords++;
            logData.processedToUpdateRecords++;
            return productUpdateObj;
        }
    } else {
        productUpdateObj = new jobHelper.DeleteProductModel(cpObj.productID);
        logData.processedRecords++;
        logData.processedToUpdateRecords++;
        return productUpdateObj;
    }

    return;
}

/**
 * write-function (steptypes.json)
 * Any returns from this function result in the "success" parameter of "afterStep()" to become false.
 * @param {dw.util.List} algoliaProducts a List containing ${chunkSize} UpdateProductModel objects
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.send = function(algoliaProducts, parameters, stepExecution) {
    var status;

    // algoliaProducts contains all the returned products from process() as a List
    var algoliaProductsArray = algoliaProducts.toArray();
    var productCount = algoliaProductsArray.length;

    // retrying
    for (var i = 0; i < MAX_TRIES; i++) {
        status = sendHelper.sendChunk(algoliaProductsArray, resourceType, paramFieldListOverride);
        if (!status.error) {
            // don't retry if managed to send
            break;
        }
    }

    // if still couldn't send after MAX_TRIES attempts, return
    if (status.error) {
        logData.failedChunks++;
        logData.failedRecords += productCount;
        return; // results in `success` in afterStep() becoming false - can't return a Status inside chunks
    }

    // sending was successful
    logData.sentChunks++;
    logData.sentRecords += productCount;
}

/**
 * after-step-function (steptypes.json)
 * @param {boolean} success any prior return statements and errors will result in this parameter becoming false
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.afterStep = function(success, parameters, stepExecution) {
    // You can't define the exit status for a chunk-oriented script module.
    // Chunk modules always finish with either OK or ERROR.
    // "sucess" conveys whether an error occurred in any previous chunks or not.
    // Any prior return statements will set success to false (even if it returns Status.OK).

    // TODO: add cleanup, move file, etc.

    if (success) {
        logData.processedError = false;
        logData.processedErrorMessage = '';
        logData.sendError = false;
        logData.sendErrorMessage = '';
    } else {
        let errorMessage = 'An error occurred during the job. Please see the error log for more details.';
        logData.processedError = true;
        logData.processedErrorMessage = errorMessage;
        logData.sendError = true;
        logData.sendErrorMessage = errorMessage;
    }

    logData.processedDate = algoliaData.getLocalDateTime(new Date());
    logData.sendDate = algoliaData.getLocalDateTime(new Date());
    algoliaData.setLogData(updateLogType, logData);

    logger.info('Chunks sent: {0}; Failed chunks: {1}\nRecords sent: {2}; Failed records: {3}',
        logData.sentChunks, logData.failedChunks, logData.sentRecords, logData.failedRecords);
}
