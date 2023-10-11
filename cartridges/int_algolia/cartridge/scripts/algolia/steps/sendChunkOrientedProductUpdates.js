'use strict';

var Site = require('dw/system/Site');
var ProductMgr = require('dw/catalog/ProductMgr');
var logger;

// job step parameters
var paramFieldListOverride, paramIndexingMethod;

// Algolia requires
var algoliaData, AlgoliaLocalizedProduct, algoliaProductConfig, jobHelper, reindexHelper, algoliaIndexingAPI, sendHelper, productFilter, AlgoliaJobReport;
var indexingOperation;

// logging-related variables
var jobReport;

var products = [], siteLocales, nonLocalizedAttributes = [], fieldsToSend;
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
    AlgoliaJobReport = require('*/cartridge/scripts/algolia/helper/AlgoliaJobReport');

    /* --- initializing custom object logging --- */
    jobReport = new AlgoliaJobReport(stepExecution.getJobExecution().getJobID(), 'product');
    jobReport.startTime = new Date();


    /* --- parameters --- */
    paramFieldListOverride = algoliaData.csvStringToArray(parameters.fieldListOverride); // fieldListOverride - pass it along to sending method
    paramIndexingMethod = parameters.indexingMethod || 'partialRecordUpdate'; // 'partialRecordUpdate' (default), 'fullRecordUpdate' or 'fullCatalogReindex'


    /* --- fieldListOverride parameter --- */
    if (empty(paramFieldListOverride)) {
        const customFields = algoliaData.getSetOfArray('CustomFields');
        fieldsToSend = algoliaProductConfig.defaultAttributes.concat(customFields);
    } else {
        fieldsToSend = paramFieldListOverride;
    }
    logger.info('fieldListOverride parameter: ' + paramFieldListOverride);
    logger.info('Actual fields to be sent: ' + JSON.stringify(fieldsToSend));


    /* --- indexingMethod parameter --- */
    switch (paramIndexingMethod) {
        case 'fullRecordUpdate':
        case 'fullCatalogReindex':
            indexingOperation = 'addObject';
            break;
        case 'partialRecordUpdate':
        default:
            indexingOperation = 'partialUpdateObject';
            break;
    }
    logger.info('indexingMethod parameter: ' + paramIndexingMethod);


    /* --- non-localized attributes --- */
    Object.keys(algoliaProductConfig.attributeConfig).forEach(function(attributeName) {
        if (!algoliaProductConfig.attributeConfig[attributeName].localized &&
          fieldsToSend.indexOf(attributeName) >= 0) {
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

    /* --- removing any leftover temporary indices --- */
    if (paramIndexingMethod === 'fullCatalogReindex') {
        logger.info('Deleting existing temporary indices...');
        var deletionTasks = reindexHelper.deleteTemporaryIndices('products', siteLocales.toArray());
        reindexHelper.waitForTasks(deletionTasks);
        logger.info('Temporary indices deleted.');
    }


    /* --- getting all products assigned to the site --- */
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

    jobReport.processedItems++; // counts towards the total number of products processed

    if (productFilter.isInclude(product)) {
        var algoliaOperations = [];

        // Pre-fetch a partial model containing all non-localized attributes, to avoid re-fetching them for each locale
        var baseModel = new AlgoliaLocalizedProduct(product, 'default', nonLocalizedAttributes);
        for (let l = 0; l < siteLocales.size(); ++l) {
            var locale = siteLocales[l];
            var indexName = algoliaData.calculateIndexName('products', locale);

            if (paramIndexingMethod === 'fullCatalogReindex') indexName += '.tmp';

            let localizedProduct = new AlgoliaLocalizedProduct(product, locale, paramFieldListOverride, baseModel);
            algoliaOperations.push(new jobHelper.AlgoliaOperation(indexingOperation, localizedProduct, indexName));
        }

        jobReport.processedItemsToSend++; // number of actual products processed
        jobReport.recordsToSend += algoliaOperations.length; // number of records to be sent to Algolia (one per locale per product)

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
    if (!status.error) {
        jobReport.recordsSent += batch.length;
        jobReport.chunksSent++;

        // Store Algolia indexing task IDs.
        // When performing a fullCatalogReindex, afterStep will wait for the last indexing tasks to complete.
        var taskIDs = status.object.body.taskID;
        Object.keys(taskIDs).forEach(function (taskIndexName) {
            lastIndexingTasks[taskIndexName] = taskIDs[taskIndexName];
        });
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

    products.close();

    if (success) {
        jobReport.error = false;
        jobReport.errorMessage = '';
    } else {
        jobReport.error = true;
        jobReport.errorMessage = 'An error occurred during the job. Please see the error log for more details.';
    }

    // don't proceed with the atomic reindexing if there were errors
    if (paramIndexingMethod === 'fullCatalogReindex') {
        reindexHelper.finishAtomicReindex('products', siteLocales.toArray(), lastIndexingTasks);
    }

    logger.info('Total number of products: {0}', jobReport.processedItems);
    logger.info('Number of products marked for sending: {0}', jobReport.processedItemsToSend);
    logger.info('Number of locales configured for the site: {0}', jobReport.siteLocales);
    logger.info('Records sent: {0}; Records failed: {1}', jobReport.recordsSent, jobReport.recordsFailed);
    logger.info('Chunks sent: {0}; Chunks failed: {1}', jobReport.chunksSent, jobReport.chunksFailed);

    jobReport.endTime = new Date();
    jobReport.writeToCustomObject();

    if (success) {
        logger.info('Indexing completed successfully.');
    } else {
        logger.error('Indexing failed.');
    }
}

// For testing
exports.__setLastIndexingTasks = function(indexingTasks) {
    lastIndexingTasks = indexingTasks;
};
