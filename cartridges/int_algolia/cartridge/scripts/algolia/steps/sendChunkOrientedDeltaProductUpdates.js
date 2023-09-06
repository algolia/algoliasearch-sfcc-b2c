'use strict';

var ProductMgr = require('dw/catalog/ProductMgr');
var Status = require('dw/system/Status');
var logger;

// job step parameters
var consumer, deltaExportJobName, fieldListOverride;

// Algolia requires
var algoliaData, AlgoliaProduct, jobHelper, algoliaExportAPI, sendHelper, productFilter;

// logging-related variables and constants
var logData;
const resourceType = 'productdelta';
const updateLogType = 'LastProductDeltaSyncLog';

var products = [];

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
    sendHelper = require('*/cartridge/scripts/algolia/helper/sendHelper');
    logger = require('dw/system/Logger').getLogger('algolia', 'Algolia');
    productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');

    // checking mandatory parameters
    if (empty(parameters.consumer) || empty(parameters.deltaExportJobName)) {
        let errorMessage = 'Mandatory job step parameters missing!';
        jobHelper.logError(errorMessage);
        return;
    }

    // parameters
    consumer = parameters.consumer;
    deltaExportJobName = parameters.deltaExportJobName;
    fieldListOverride = algoliaData.csvStringToArray(parameters.fieldListOverride); // fieldListOverride - pass it along to sendChunk()

    // initializing logs
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

    // getting all products assigned to the site
    products = ProductMgr.queryAllSiteProducts();
}

/**
 * total-count-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {number} total number of products
 */
exports.getTotalCount = function(parameters, stepExecution) {
    return products.count;
}

/**
 * read-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {dw.catalog.Product} B2C Product object
 */
exports.read = function(parameters, stepExecution) {
    if (products.hasNext()) {
        return products.next();
    }
}

/**
 * process-function (steptypes.json)
 * @param {dw.catalog.Product} product one single product
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {UpdateProductModel} the product object in the form in which it will be sent to Algolia
 */
exports.process = function(product, parameters, stepExecution) {

    if (productFilter.isInclude(product)) {

        // enrich product
        var algoliaProduct = new AlgoliaProduct(product, fieldListOverride);
        var productUpdateObj = new jobHelper.UpdateProductModel(algoliaProduct);

        logData.processedRecords++;
        logData.processedToUpdateRecords++;

        return productUpdateObj;

    } else {
        return;
    }
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
        status = sendHelper.sendChunk(algoliaProductsArray, resourceType, fieldListOverride);
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

    products.close();

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
