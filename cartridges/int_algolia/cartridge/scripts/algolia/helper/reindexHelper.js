const logger = require('dw/system/Logger').getLogger('algolia');

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
        var res = algoliaIndexingAPI.copyIndexSettings(indexName, tmpIndexName);
        if (res.ok) {
            logger.info('Settings copied to ' + tmpIndexName + '. ' + JSON.stringify(res.object.body));
            copySettingsTasks[tmpIndexName] = res.object.body.taskID;
        } else {
            throw new Error('Error while copying index settings: ' + res.getErrorMessage())
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
 * Sends an Algolia batch to the multi-indices batch endpoint.
 * If records fail to be indexed (because e.g. they are too big), they are removed from the batch and the batch is retried.
 * @param {Object} batch - Algolia multi-indices batch
 * @return {{failedRecords: number}} returns an object with the last call result and the number of failed records.
 */
function sendRetryableBatch(batch) {
    var MAX_ATTEMPTS = 50;
    var attempt = 0;
    var failedRecords = 0;
    var result = algoliaIndexingAPI.sendMultiIndexBatch(batch);
    while (result.error && attempt < MAX_ATTEMPTS) {
        ++attempt;
        try {
            var apiResponse = JSON.parse(result.getErrorMessage());
            // When records are failing, Algolia returns the following:
            // {"message":"Record at the position 6 objectID=008884303996M is too big size=11072/10000 bytes. Please have a look at [...]", "position":6,"objectID":"008884303996M","status":400}
            if (!apiResponse.objectID || !apiResponse.message || !apiResponse.message.startsWith('Record at the position')) {
                // No faulty record detected, nothing else to do
                break;
            }
            logger.info('[Retryable batch] Removing records for product ' + apiResponse.objectID);
            for (var i = batch.length - 1; i >= 0; --i) {
                if (batch[i].body.objectID === apiResponse.objectID) {
                    logger.info('[Retryable batch] Removing record for product ' + apiResponse.objectID + ' from the batch (index '+ batch[i].indexName + ')');
                    batch.splice(i, 1);
                    failedRecords++;
                }
            }
            logger.info('[Retryable batch] Retrying batch...');
            result = algoliaIndexingAPI.sendMultiIndexBatch(batch);
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

module.exports.deleteTemporaryIndices = deleteTemporaryIndices;
module.exports.finishAtomicReindex = finishAtomicReindex;
module.exports.waitForTasks = waitForTasks;
module.exports.sendRetryableBatch = sendRetryableBatch;

// For unit testing
module.exports.copySettingsFromProdIndices = copySettingsFromProdIndices;
module.exports.moveTemporaryIndices = moveTemporaryIndices;
