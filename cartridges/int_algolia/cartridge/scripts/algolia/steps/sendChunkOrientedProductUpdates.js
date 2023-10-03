'use strict';

var Site = require('dw/system/Site');
var ProductMgr = require('dw/catalog/ProductMgr');
var logger;

// job step parameters
var resourceType, fieldListOverride;

// Algolia requires
var algoliaData, AlgoliaLocalizedProduct, algoliaProductConfig, jobHelper, reindexHelper, algoliaIndexingAPI, sendHelper, productFilter;
var indexingOperation;

// logging-related variables
var logData, updateLogType;

var products = [], siteLocales, nonLocalizedAttributes = [], fieldsToSend;
var indexingMethod;
var lastIndexingTasks = {};

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
    jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    reindexHelper = require('*/cartridge/scripts/algolia/helper/reindexHelper');
    algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');
    sendHelper = require('*/cartridge/scripts/algolia/helper/sendHelper');
    logger = require('dw/system/Logger').getLogger('algolia', 'Algolia');
    productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');
    algoliaProductConfig = require('*/cartridge/scripts/algolia/lib/algoliaProductConfig');

    // checking mandatory parameters
    if (empty(parameters.resourceType)) {
        let errorMessage = 'Mandatory job step parameter "resourceType" missing!';
        jobHelper.logError(errorMessage);
        return;
    }

    // parameters
    resourceType = parameters.resourceType; // resouceType ( price | inventory | product ) - pass it along to sendChunk()
    fieldListOverride = algoliaData.csvStringToArray(parameters.fieldListOverride); // fieldListOverride - pass it along to sendChunk()
    indexingMethod = parameters.indexingMethod;

    if (empty(fieldListOverride)) {
        const customFields = algoliaData.getSetOfArray('CustomFields');
        fieldsToSend = algoliaProductConfig.defaultAttributes.concat(customFields);
    } else {
        fieldsToSend = fieldListOverride;
    }

    Object.keys(algoliaProductConfig.attributeConfig).forEach(function(attributeName) {
        if (!algoliaProductConfig.attributeConfig[attributeName].localized &&
          fieldsToSend.indexOf(attributeName) >= 0) {
            if (attributeName !== 'categories') {
                nonLocalizedAttributes.push(attributeName);
            }
        }
    });
    logger.info('Non-localized attributes: ' + JSON.stringify(nonLocalizedAttributes));

    indexingOperation = indexingMethod === 'partialRecordUpdate' ? 'partialUpdateObject' : 'addObject';
    siteLocales = Site.getCurrent().getAllowedLocales();
    logger.info('Enabled locales for ' + Site.getCurrent().getName() + ': ' + siteLocales.toArray())

    // configure logging
    switch (resourceType) {
        case 'price': updateLogType = 'LastPartialPriceSyncLog'; break;
        case 'inventory': updateLogType = 'LastPartialInventorySyncLog'; break;
        case 'product': updateLogType = 'LastProductSyncLog'; break;
    }

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

    if (indexingMethod === 'fullCatalogReindex') {
        indexingOperation = 'addObject';
        logger.info('Deleting existing temporary indices...');
        var deletionTasks = reindexHelper.deleteTemporariesIndices('products', siteLocales.toArray());
        algoliaIndexingAPI.waitForTasks(deletionTasks);
        logger.info('Temporary indices deleted.');
    }

    // getting all products assigned to the site
    products = ProductMgr.queryAllSiteProducts();
    logger.info('Starting indexing...')
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
 * @returns {Array} an array that contains one AlgoliaOperation per locale:
 *                  [ "action": "addObject", "indexName": "sfcc_products_en_US", body: { "id": "008884303989M", "name": "Fitted Shirt" },
 *                    "action": "addObject", "indexName": "sfcc_products_fr_FR", body: { "id": "008884303989M", "name": "Chemise ajustée" } ]
 */
exports.process = function(product, parameters, stepExecution) {

    if (productFilter.isInclude(product)) {
        var algoliaOperations = [];

        // Pre-fetch a partial model containing all non-localized attributes, to avoid re-fetching them for each locale
        var baseModel = new AlgoliaLocalizedProduct(product, 'default', nonLocalizedAttributes);
        for (let l = 0; l < siteLocales.size(); ++l) {
            var locale = siteLocales[l];
            var indexName = algoliaData.calculateIndexName('products', locale);
            if (indexingMethod === 'fullCatalogReindex') {
                indexName += '.tmp'
            }
            let localizedProduct = new AlgoliaLocalizedProduct(product, locale, fieldListOverride, baseModel);
            algoliaOperations.push(new jobHelper.AlgoliaOperation(indexingOperation, localizedProduct, indexName))
        }

        logData.processedRecords++;
        logData.processedToUpdateRecords++;

        return algoliaOperations;

    }
}

/**
 * write-function (steptypes.json)
 * Any returns from this function result in the "success" parameter of "afterStep()" to become false.
 * @param {dw.util.List} algoliaOperations a List containing ${chunkSize} of Algolia operations Lists ready to be sent
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.send = function(algoliaOperations, parameters, stepExecution) {
    var status;

    // algoliaOperations contains all the returned Algolia operations from process() as a List of arrays
    var algoliaOperationsArray = algoliaOperations.toArray();
    var productCount = algoliaOperationsArray.length;

    var batch = [];
    for (let i = 0; i < productCount; ++i) {
        // The array returned by the 'process' function is converted to a dw.util.List
        batch = batch.concat(algoliaOperationsArray[i].toArray());
    }

    status = algoliaIndexingAPI.sendMultiIndicesBatch(batch);
    if (status.error) {
        logData.failedChunks++;
        logData.failedRecords += batch.length;
    }
    else {
        logData.sentRecords += batch.length;
        logData.sentChunks++;

        // Store Algolia indexing tasks ids.
        // When doing a fullCatalogReindex, we will wait to the last indexing tasks in the afterStep.
        var taskIDs = status.object.body.taskID;
        Object.keys(taskIDs).forEach(function (taskIndexName) {
            lastIndexingTasks[taskIndexName] = taskIDs[taskIndexName];
        });
    }
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
    // "success" conveys whether an error occurred in any previous chunks or not.
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

    if (indexingMethod === 'fullCatalogReindex') {
        reindexHelper.finishAtomicReindex('products', siteLocales.toArray(), lastIndexingTasks);
    }

    logData.processedDate = algoliaData.getLocalDateTime(new Date());
    logData.sendDate = algoliaData.getLocalDateTime(new Date());
    algoliaData.setLogData(updateLogType, logData);

    logger.info('Chunks sent: {0}; Failed chunks: {1}\nRecords sent: {2}; Failed records: {3}',
        logData.sentChunks, logData.failedChunks, logData.sentRecords, logData.failedRecords);
}

// For testing
exports.__setLastIndexingTasks = function(indexingTasks) {
    lastIndexingTasks = indexingTasks;
};
