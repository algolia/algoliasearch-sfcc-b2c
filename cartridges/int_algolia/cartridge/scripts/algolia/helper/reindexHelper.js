const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();

const INDEXING_APIS = {
    SEARCH_API: 'search-api',
    INGESTION_API: 'ingestion-api',
}

const ANALYTICS_REGIONS = {
    EU: 'eu',
    US: 'us',
}

// TODO: make these into site preferences -- return analyticsRegion programmatically if possible - getIndexSettings?
const indexingAPI = INDEXING_APIS.INGESTION_API;
const analyticsRegion = ANALYTICS_REGIONS.EU;

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');

/**
 * Delete the temporary indices corresponding to the given type and locales
 * @param {string} indexType - type of the index (products or categories)
 * @param {string[]} locales - locales for which we want to delete the indices
 * @return {Object} Algolia taskIDs, in the form: { indexName1: <taskID>, indexName2: <taskID> }
 */
function deleteTemporaryIndices(indexType, locales) {
    var deletionTasks = {};
    locales.forEach(function(locale) {
        var tmpIndexName = algoliaData.calculateIndexName(indexType, locale) + '.tmp';
        var res = algoliaIndexingAPI.deleteIndex(tmpIndexName);
        if (res.ok) {
            logger.info(tmpIndexName + ' deleted. ' + JSON.stringify(res.object.body));
            deletionTasks[tmpIndexName] = res.object.body.taskID;
        } else {
            throw new Error('Error while deleting temporary indices: ' + res.getErrorMessage())
        }
    });
    return deletionTasks;
}

/**
 * Copy the settings of the production indices to the matching temporary index
 * @param {string} indexType - type of the index (products or categories)
 * @param {string[]} locales - locales for which we want to copy the index settings
 * @return {Object} Algolia taskIDs, in the form: { indexName1: <taskID>, indexName2: <taskID> }
 */
function copySettingsFromProdIndices(indexType, locales) {
    var copySettingsTasks = {};
    locales.forEach(function(locale) {
        var indexName = algoliaData.calculateIndexName(indexType, locale);
        var tmpIndexName = indexName + '.tmp';
        var getSettingsRes = algoliaIndexingAPI.getIndexSettings(indexName);
        if (getSettingsRes.ok) {
            var copySettingsRes = algoliaIndexingAPI.copyIndexSettings(indexName, tmpIndexName);
            if (copySettingsRes.ok) {
                logger.info('Settings copied to ' + tmpIndexName + '. ' + JSON.stringify(copySettingsRes.object.body));
                copySettingsTasks[tmpIndexName] = copySettingsRes.object.body.taskID;
            } else {
                throw new Error('Error while copying index settings: ' + copySettingsRes.getErrorMessage())
            }
        } else if (getSettingsRes.error !== 404) {
            throw new Error('Error while getting index settings from ' + indexName + ': ' + getSettingsRes.getErrorMessage())
        }
    });
    return copySettingsTasks;
}

/**
 * Copy the temporary indices to production
 * @param {string} indexType - type of the index (products or categories)
 * @param {string[]} locales - locales for which we want to move the indices
 */
function moveTemporaryIndices(indexType, locales) {
    locales.forEach(function(locale) {
        var indexName = algoliaData.calculateIndexName(indexType, locale);
        var tmpIndexName = indexName + '.tmp';
        var res = algoliaIndexingAPI.moveIndex(tmpIndexName, indexName);
        if (res.ok) {
            logger.info('Index ' + tmpIndexName + ' moved to ' + indexName + '. ' + JSON.stringify(res.object.body));
        } else {
            logger.error('Error while moving ' + tmpIndexName + ' to ' + indexName + ': ' + res.getErrorMessage());
        }
    });
}

/**
 * Wait for multiple Algolia tasks to complete.
 * This method takes the "taskID" object structure returned by the multi-indices batch write operation and wait for each task to complete.
 * https://www.algolia.com/doc/rest-api/search/#batch-write-operations-multiple-indices
 * @param {Object} taskIDs - object containing a map of { "<indexName>": <taskID>, "<indexName2>: <taskID> }
 */
function waitForTasks(taskIDs) {
    Object.keys(taskIDs).forEach(function (indexName) {
        logger.info('Waiting for task ' + taskIDs[indexName] + ' on index ' + indexName);
        algoliaIndexingAPI.waitTask(indexName, taskIDs[indexName]);
    });
}

/**
 * Finalize an atomic reindex. For each locale:
 *   - Copy the index settings from the production index to the temporary index
 *   - Wait for all tasks to complete: the last reindex tasks + the copy settings tasks
 *   - Move the temporary indices to production
 * @param {string} indexType - 'products' or 'categories'
 * @param {string[]} locales - locales for which the reindex was triggered
 * @param {Object} lastIndexingTasks - Task IDs of the last reindex tasks to wait for, for each locale. Under the form: { "<indexName1>": <taskID>, "<indexName2>": <taskID> }
 */
function finishAtomicReindex(indexType, locales, lastIndexingTasks) {
    logger.info('[FinishReindex] copying index settings from production...');
    var copySettingsTasks = copySettingsFromProdIndices(indexType, locales);

    logger.info('[FinishReindex] Waiting for the last indexing tasks to complete... ' + JSON.stringify(lastIndexingTasks));
    waitForTasks(lastIndexingTasks);
    logger.info('[FinishReindex] Waiting for the last copy settings tasks to complete... ' + JSON.stringify(copySettingsTasks));
    waitForTasks(copySettingsTasks);

    logger.info('[FinishReindex] Moving temporary indices to production...');
    moveTemporaryIndices(indexType, locales);
}

/**
 * Sends an Algolia batch to either the multi-indices batch endpoint or the Ingestion push endpoint.
 * If records fail to be indexed (because e.g. they are too big), they are removed from the batch and the batch is retried.
 * @param {Object} batch - Algolia multi-indices batch
 * @param {String} [indexName] Target index -- only used with the Ingestion API
 * @return {Object} returns an object with the last call result and the number of failed records.
 */
function sendRetryableBatch(batch, indexName) {
    var MAX_ATTEMPTS = 50;
    var attempt = 0;
    var failedRecords = 0;
    var result = algoliaIndexingAPI.sendPayload(batch, indexName);

    while (result.error && attempt < MAX_ATTEMPTS) {
        ++attempt;
        try {
            var apiResponse = JSON.parse(result.getErrorMessage());
            // When records are failing, Algolia returns the following (those are examples for records too big):
            // - For Classic: {"message":"Record at the position 6 objectID=008884303996M is too big size=11072/10000 bytes. Please have a look at [...]", "position":6,"objectID":"008884303996M","status":400}
            // - For Current: {"message":"Record 008884303996M is too big: size: 11072 byte(s), maximum allowed: 100000 byte(s). Please have a look at [...]","status":400}
            if (!apiResponse.objectID && (!apiResponse.message || !(apiResponse.message.indexOf('is too big') > 0))) {
                // No identified objectID, and not an "is too big" error. Nothing else to do
                break;
            }
            var objectIdToRemove;
            if (apiResponse.objectID) {
                objectIdToRemove = apiResponse.objectID
            } else {
                var match = apiResponse.message.match(/^Record (.*) is too big/);
                if (match) {
                    objectIdToRemove = match[1];
                }
            }
            logger.info('[Retryable batch] Removing records for product "' + objectIdToRemove + '"');
            var removedRecords = 0;

            // TODO: adapt this logic to be able to work with Ingestion payloads as well

            for (var i = batch.length - 1; i >= 0; --i) {
                if (batch[i].body.objectID === objectIdToRemove) {
                    batch.splice(i, 1);
                    failedRecords++;
                    removedRecords++;
                }
            }
            if (removedRecords === 0) {
                logger.warn('[Retryable batch] could not remove any record. Not retrying the batch.');
                break;
            }
            logger.info('[Retryable batch] Removed ' + removedRecords + ' records. Retrying batch...');
            result = algoliaIndexingAPI.sendPayload(batch, indexName);
        } catch(e) {
            // Error message is not JSON, ignoring
            logger.error('[Retryable batch] Error while parsing response: ' + e.message);
            break;
        }
    }
    if (attempt === MAX_ATTEMPTS) {
        logger.error('[Retryable batch] Too many products are in error, aborting the batch...');
    }
    return {
        result: result,
        failedRecords: failedRecords,
    }
}

/**
 * Groups payload records by index name and action to build ingestion API batches.
 * Example sortedPayloads:
 * sortedPayloads = {
 *     'indexName1': {
 *         'addObject': [
 *             { <recordBody10> }, { <recordBody11> }, ...
 *         ],
 *         'deleteObject': [
 *             { <recordBody20> }, { <recordBody21> }, ...
 *         ],
 *         ...
 *     },
 *     'indexName2': { ... },
 *     ...
 * }
 * @param {Object[]} payloadArray - Payload entries with `action` and `records`.
 * @returns {Object} Result from the batch send operation.
 */
function groupPayloadsForIngestionAPI(payloadArray) {

    let sortedPayloads = {};
    let result;
    let failedRecords = 0;

    // sort records by indexName and action
    for (let i = 0; i < payloadArray.length; i ++) {
        let currentObject = payloadArray[i];
        let indexName = currentObject.indexName;
        let action = currentObject.action;

        if (empty(sortedPayloads[indexName])) {
            sortedPayloads[indexName] = {};
        }

        if (empty(sortedPayloads[indexName][action])) {
            sortedPayloads[indexName][action] = [];
        }

        sortedPayloads[indexName][action].push(currentObject.body);
    }

   let indices = Object.keys(sortedPayloads);

    // iterate over the sorted batches by indexName and action, and send them
    for (let i = 0; i < indices.length; i++) {
        let indexName = indices[i];
        let index = sortedPayloads[indexName];
        let actions = Object.keys(index);

        for (let j = 0; j < actions.length; j++) {
            let action = actions[j];
            let records = index[action];

            let payloadToSend = {
                action: action,
                records: records,
            }

            result = sendRetryableBatch(payloadToSend, indexName);
            failedRecords += result.failedRecords;
            if (!(result.ok)) {
                break;
            }
        }
    }

    // returns the last OK result or the first failed one -- since we only need the OK/NOK from it, it's representative of the entire batch
    return result;
}

module.exports.deleteTemporaryIndices = deleteTemporaryIndices;
module.exports.finishAtomicReindex = finishAtomicReindex;
module.exports.waitForTasks = waitForTasks;
module.exports.sendRetryableBatch = sendRetryableBatch;
module.exports.groupPayloadsForIngestionAPI = groupPayloadsForIngestionAPI;

// For unit testing
module.exports.copySettingsFromProdIndices = copySettingsFromProdIndices;
module.exports.moveTemporaryIndices = moveTemporaryIndices;
