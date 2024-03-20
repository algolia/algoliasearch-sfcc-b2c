'use strict';

var Site = require('dw/system/Site');
var ProductMgr = require('dw/catalog/ProductMgr');
var logger;

// job step parameters
var paramAttributeListOverride, paramIndexingMethod, paramFailureThresholdPercentage;
var paramRecordModel;

// Algolia requires
var algoliaData, AlgoliaLocalizedProduct, algoliaProductConfig, algoliaIndexingAPI, productFilter, AlgoliaJobReport;
var jobHelper, modelHelper, reindexHelper, sendHelper;
var indexingOperation;
var fullRecordUpdate = false;

// logging-related variables
var jobReport;

var products = [], siteLocales, attributesToSend;
var masterAttributes = [], variantAttributes = [];
var nonLocalizedAttributes = [], nonLocalizedMasterAttributes = [];
var attributesComputedFromBaseProduct = [];
var lastIndexingTasks = {};

const VARIANT_LEVEL = 'variant-level';
const MASTER_LEVEL = 'master-level';

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
    modelHelper = require('*/cartridge/scripts/algolia/helper/modelHelper');
    reindexHelper = require('*/cartridge/scripts/algolia/helper/reindexHelper');
    algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');
    sendHelper = require('*/cartridge/scripts/algolia/helper/sendHelper');
    logger = jobHelper.getAlgoliaLogger();
    productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');
    algoliaProductConfig = require('*/cartridge/scripts/algolia/lib/algoliaProductConfig');
    AlgoliaJobReport = require('*/cartridge/scripts/algolia/helper/AlgoliaJobReport');

    /* --- initializing custom object logging --- */
    jobReport = new AlgoliaJobReport(stepExecution.getJobExecution().getJobID(), 'product');
    jobReport.startTime = new Date();


    /* --- parameters --- */
    paramAttributeListOverride = algoliaData.csvStringToArray(parameters.attributeListOverride); // attributeListOverride - pass it along to sending method
    paramIndexingMethod = parameters.indexingMethod || 'partialRecordUpdate'; // 'partialRecordUpdate' (default), 'fullRecordUpdate' or 'fullCatalogReindex'
    paramFailureThresholdPercentage = parameters.failureThresholdPercentage || 0;
    paramRecordModel = algoliaData.getPreference('RecordModel') || VARIANT_LEVEL; // 'variant-level' (default), 'master-level'

    /* --- attributeListOverride parameter --- */
    if (empty(paramAttributeListOverride)) {
        attributesToSend = algoliaProductConfig.defaultAttributes_v2.slice();
        const additionalAttributes = algoliaData.getSetOfArray('AdditionalAttributes');
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
        case 'fullRecordUpdate':
        case 'fullCatalogReindex':
            indexingOperation = 'addObject';
            fullRecordUpdate = true;
            break;
        case 'partialRecordUpdate':
        default:
            indexingOperation = 'partialUpdateObject';
            break;
    }
    logger.info('indexingMethod parameter: ' + paramIndexingMethod);
    logger.info('Record model: ' + paramRecordModel);

    /* --- master/variant attributes --- */
    variantAttributes = algoliaProductConfig.defaultVariantAttributes_v2.slice();
    masterAttributes = algoliaProductConfig.defaultMasterAttributes_v2.slice();
    attributesToSend.forEach(function(attribute) {
        if (algoliaProductConfig.attributeConfig_v2[attribute] &&
            algoliaProductConfig.attributeConfig_v2[attribute].variantAttribute) {
            if (variantAttributes.indexOf(attribute) < 0) {
                variantAttributes.push(attribute);
            }
        } else if (masterAttributes.indexOf(attribute) < 0) {
            masterAttributes.push(attribute);
        }
    });

    /* --- non-localized/shared attributes --- */
    nonLocalizedAttributes = [];
    nonLocalizedMasterAttributes = [];
    Object.keys(algoliaProductConfig.attributeConfig_v2).forEach(function(attributeName) {
        if (algoliaProductConfig.attributeConfig_v2[attributeName].computedFromBaseProduct) {
            if (attributesToSend.indexOf(attributeName) >= 0) {
                attributesComputedFromBaseProduct.push(attributeName);
            }
        } else if (!algoliaProductConfig.attributeConfig_v2[attributeName].localized) {
            if (attributesToSend.indexOf(attributeName) >= 0) {
                nonLocalizedAttributes.push(attributeName);
            }
            if (masterAttributes.indexOf(attributeName) >= 0) {
                nonLocalizedMasterAttributes.push(attributeName);
            }
        }
    });
    logger.info('Non-localized attributes: ' + JSON.stringify(nonLocalizedAttributes));
    logger.info('Attributes computed from base product and shared with siblings: ' + JSON.stringify(attributesComputedFromBaseProduct));

    if (paramRecordModel === MASTER_LEVEL) {
        logger.info('Master attributes: ' + JSON.stringify(masterAttributes));
        logger.info('Non-localized master attributes: ' + JSON.stringify(nonLocalizedMasterAttributes));
        logger.info('Variant attributes: ' + JSON.stringify(variantAttributes));
        if (paramIndexingMethod === 'partialRecordUpdate' && variantAttributes.length > 0) {
            jobReport.endTime = new Date();
            jobReport.error = true;
            jobReport.errorMessage = 'partialRecordUpdate is not compatible with Base Product level indexing';
            jobReport.writeToCustomObject();
            throw new Error(jobReport.errorMessage);
        }
    }

    /* --- site locales --- */
    siteLocales = Site.getCurrent().getAllowedLocales();
    logger.info('Enabled locales for ' + Site.getCurrent().getName() + ': ' + siteLocales.toArray());
    jobReport.siteLocales = siteLocales.size();

    algoliaIndexingAPI.setJobInfo({
        jobID: stepExecution.getJobExecution().getJobID(),
        stepID: stepExecution.getStepID(),
        indexingMethod: paramIndexingMethod,
    });

    /* --- removing any leftover temporary indices --- */
    if (paramIndexingMethod === 'fullCatalogReindex') {
        try {
            logger.info('Deleting existing temporary indices...');
            var deletionTasks = reindexHelper.deleteTemporaryIndices('products', siteLocales.toArray());
            reindexHelper.waitForTasks(deletionTasks);
            logger.info('Temporary indices deleted. Copying index settings from production and starting indexing...');
            reindexHelper.copySettingsFromProdIndices('products', siteLocales.toArray());
        } catch (e) {
            jobReport.endTime = new Date();
            jobReport.error = true;
            jobReport.errorMessage = 'Failed to delete temporary indices: ' + e.message;
            jobReport.writeToCustomObject();
            throw e;
        }
    }


    /* --- getting all products assigned to the site --- */
    products = ProductMgr.queryAllSiteProducts();
    logger.info('failureThresholdPercentage parameter: ' + paramFailureThresholdPercentage);
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

    if (paramRecordModel === MASTER_LEVEL || attributesComputedFromBaseProduct.length > 0) {
        if (product.isVariant()) {
            // To generate 'colorVariations' or for master-level indexing, we need to work with the master products.
            // This variant will be indexed when we treat its master product, skip it.
            return [];
        }
        if (product.master) {
            var algoliaOperations = [];
            var processedVariantsToSend = 0;

            if (paramRecordModel !== MASTER_LEVEL) {
                // Variant-level indexing
                var recordsPerLocale = jobHelper.generateVariantRecords({
                    masterProduct: product,
                    locales: siteLocales,
                    attributeList: attributesToSend,
                    nonLocalizedAttributes: nonLocalizedAttributes,
                    attributesComputedFromBaseProduct: attributesComputedFromBaseProduct,
                    fullRecordUpdate: fullRecordUpdate,
                });
                for (let l = 0; l < siteLocales.size(); ++l) {
                    var locale = siteLocales[l];
                    var indexName = algoliaData.calculateIndexName('products', locale);
                    if (paramIndexingMethod === 'fullCatalogReindex') {
                        indexName += '.tmp';
                    }
                    var records = recordsPerLocale[locale];
                    processedVariantsToSend = records.length;
                    records.forEach(function(record) {
                        algoliaOperations.push(new jobHelper.AlgoliaOperation(indexingOperation, record, indexName));
                    });
                }
            } else {
                // Master-level indexing
                var baseModel = new AlgoliaLocalizedProduct({ product: product, locale: 'default', attributeList: nonLocalizedMasterAttributes });
                for (let l = 0; l < siteLocales.size(); ++l) {
                    var locale = siteLocales[l];
                    var indexName = algoliaData.calculateIndexName('products', locale);
                    if (paramIndexingMethod === 'fullCatalogReindex') {
                        indexName += '.tmp';
                    }
                    var localizedMaster = new AlgoliaLocalizedProduct({
                        product: product,
                        locale: locale,
                        attributeList: masterAttributes,
                        variantAttributes: variantAttributes,
                        baseModel: baseModel,
                    });
                    processedVariantsToSend = localizedMaster.variants ? localizedMaster.variants.length : 0;
                    algoliaOperations.push(new jobHelper.AlgoliaOperation(indexingOperation, localizedMaster, indexName));
                }
            }

            jobReport.processedItemsToSend += processedVariantsToSend;
            jobReport.recordsToSend += algoliaOperations.length;
            return algoliaOperations;
        }
    }

    if (productFilter.isInclude(product)) {
        var algoliaOperations = [];

        // Pre-fetch a partial model containing all non-localized attributes, to avoid re-fetching them for each locale
        var baseModel = new AlgoliaLocalizedProduct({ product: product, locale: 'default', attributeList: nonLocalizedAttributes, fullRecordUpdate: fullRecordUpdate });
        for (let l = 0; l < siteLocales.size(); ++l) {
            var locale = siteLocales[l];
            var indexName = algoliaData.calculateIndexName('products', locale);

            if (paramIndexingMethod === 'fullCatalogReindex') indexName += '.tmp';

            let localizedProduct = new AlgoliaLocalizedProduct({ product: product, locale: locale, attributeList: attributesToSend, baseModel: baseModel, fullRecordUpdate: fullRecordUpdate });
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
    // algoliaOperations contains all the returned Algolia operations from process() as a List of arrays
    var algoliaOperationsArray = algoliaOperations.toArray();
    var productCount = algoliaOperationsArray.length;

    var batch = [];
    for (let i = 0; i < productCount; ++i) {
        // The array returned by the 'process' function is converted to a dw.util.List
        batch = batch.concat(algoliaOperationsArray[i].toArray());
    }
    if (!batch.length) {
        return;
    }

    var retryableBatchRes = reindexHelper.sendRetryableBatch(batch);
    var result = retryableBatchRes.result;
    jobReport.recordsFailed += retryableBatchRes.failedRecords;

    if (result.ok) {
        jobReport.recordsSent += batch.length;
        jobReport.chunksSent++;

        // Store Algolia indexing task IDs.
        // When performing a fullCatalogReindex, afterStep will wait for the last indexing tasks to complete.
        var taskIDs = result.object.body.taskID;
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

    logger.info('Total number of products: {0}', jobReport.processedItems);
    logger.info('Number of products marked for sending: {0}', jobReport.processedItemsToSend);
    logger.info('Number of locales configured for the site: {0}', jobReport.siteLocales);
    logger.info('Records sent: {0}; Records failed: {1}', jobReport.recordsSent, jobReport.recordsFailed);
    logger.info('Chunks sent: {0}; Chunks failed: {1}', jobReport.chunksSent, jobReport.chunksFailed);

    const failurePercentage = +((jobReport.recordsFailed / jobReport.recordsToSend * 100).toFixed(2)) || 0;

    if (paramIndexingMethod === 'fullCatalogReindex') {
        if (failurePercentage <= paramFailureThresholdPercentage) {
            reindexHelper.finishAtomicReindex('products', siteLocales.toArray(), lastIndexingTasks);
        } else {
            // don't proceed with the atomic reindexing
            jobReport.error = true;
            jobReport.errorMessage = 'The percentage of records that failed to be indexed (' + failurePercentage + '%) exceeds the failureThresholdPercentage (' +
                 paramFailureThresholdPercentage + '%). Not moving temporary indices to production. Check the logs for details.';
        }
    } else if (failurePercentage > paramFailureThresholdPercentage) {
        jobReport.error = true;
        jobReport.errorMessage = 'The percentage of records that failed to be indexed (' + failurePercentage + '%) exceeds the failureThresholdPercentage (' +
            paramFailureThresholdPercentage + '%). Check the logs for details.';
    } else if (jobReport.chunksFailed > 0) {
        jobReport.error = true;
        jobReport.errorMessage = 'Some chunks failed to be sent, check the logs for details.';
    }

    jobReport.endTime = new Date();
    jobReport.writeToCustomObject();

    if (!jobReport.error) {
        logger.info('Indexing completed successfully.');
    } else {
        // Showing the job in ERROR in the history
        throw new Error(jobReport.errorMessage);
    }
}

// For testing
exports.__setLastIndexingTasks = function(indexingTasks) {
    lastIndexingTasks = indexingTasks;
};
exports.__getAttributesToSend = function() {
    return attributesToSend;
}
exports.__getJobReport = function() {
    return jobReport;
}
