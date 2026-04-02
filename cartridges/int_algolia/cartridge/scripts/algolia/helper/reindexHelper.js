const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();

const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
const algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');
const algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

const INDEXING_APIS = algoliaConstants.INDEXING_APIS;

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
 * @param {string} [indexingAPI] - which API to poll: 'search-api' (default) or 'ingestion-api'
 */
function waitForTasks(taskIDs, indexingAPI) {
    indexingAPI = indexingAPI || INDEXING_APIS.SEARCH_API;
    Object.keys(taskIDs).forEach(function (indexName) {
        logger.info('Waiting for task ' + taskIDs[indexName] + ' on index ' + indexName);
        algoliaIndexingAPI.waitTask(indexName, taskIDs[indexName], indexingAPI);
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
 * @param {string} [indexingAPI] - which API is used for indexing: 'search-api' (default) or 'ingestion-api'. Determines how to poll for task completion.
 */
function finishAtomicReindex(indexType, locales, lastIndexingTasks, indexingAPI) {
    logger.info('[FinishReindex] copying index settings from production...');
    var copySettingsTasks = copySettingsFromProdIndices(indexType, locales);

    logger.info('[FinishReindex] Waiting for the last indexing tasks...');
    waitForTasks(lastIndexingTasks, indexingAPI);

    logger.info('[FinishReindex] Waiting for copy settings tasks...');
    waitForTasks(copySettingsTasks); // defaults to Search API

    logger.info('[FinishReindex] Moving temporary indices to production...');
    moveTemporaryIndices(indexType, locales);
}

module.exports.deleteTemporaryIndices = deleteTemporaryIndices;
module.exports.finishAtomicReindex = finishAtomicReindex;
module.exports.waitForTasks = waitForTasks;

// For unit testing
module.exports.copySettingsFromProdIndices = copySettingsFromProdIndices;
module.exports.moveTemporaryIndices = moveTemporaryIndices;
