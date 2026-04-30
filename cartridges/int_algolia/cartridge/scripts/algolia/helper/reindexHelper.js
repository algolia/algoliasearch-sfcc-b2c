const jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
const logger = jobHelper.getAlgoliaLogger();
const toTmp = jobHelper.toTmp;

const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
const algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');
const { INDEXING_APIS } = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

/**
 * Delete the temporary indices corresponding to the given type and locales
 * @param {string} indexType - type of the index (products or categories)
 * @param {string[]} locales - locales for which we want to delete the indices
 * @return {Object} Algolia taskIDs, in the form: { indexName1: <taskID>, indexName2: <taskID> }
 */
function deleteTemporaryIndices(indexType, locales) {
    var deletionTasks = {};
    locales.forEach(function(locale) {
        var tmpIndexName = toTmp(algoliaData.calculateIndexName(indexType, locale));
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
        var tmpIndexName = toTmp(indexName);
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
        var tmpIndexName = toTmp(indexName);
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
        logger.debug('[waitForTasks][SearchAPI][indexName: ' + indexName + '][taskID: ' + taskIDs[indexName] + '] Waiting for task...');
        algoliaIndexingAPI.waitTask(indexName, taskIDs[indexName]);
    });
}

/**
 * Wait for multiple Ingestion API events to become available.
 * Polls each event via /1/runs/{runID}/events/{eventID} until it returns a non-404 response.
 * Ingestion events have no sequential processing guarantee, so all must be tracked and waited on.
 * @param {Object} indexingEvents - { "<runID>": [<eventID>, ...] }
 */
function waitForEvents(indexingEvents) {
    Object.keys(indexingEvents).forEach(function (runID) {
        indexingEvents[runID].forEach(function (eventID) {
            logger.debug('[waitForEvents][IngestionAPI][runID: ' + runID + '][eventID: ' + eventID + '] Waiting for event...');
            algoliaIndexingAPI.waitForRunEvent(runID, eventID);
        });
    });
}

/**
 * Finalize an atomic reindex. For each locale:
 *   - Copy the index settings from the production index to the temporary index
 *   - Wait for all tasks to complete: the last reindex tasks + the copy settings tasks
 *   - Move the temporary indices to production
 * @param {string} indexType - 'products' or 'categories'
 * @param {string[]} locales - locales for which the reindex was triggered
 * @param {Object} indexingTasksToWaitFor - Search API: { indexName: taskID }; Ingestion API: { runID: [eventID, ...] }
 * @param {string} [indexingAPI] - 'search-api' (default) or 'ingestion-api'
 */
function finishAtomicReindex(indexType, locales, indexingTasksToWaitFor, indexingAPI) {

    logger.info('[finishAtomicReindex] Copying index settings from production...');
    var copySettingsTasks = copySettingsFromProdIndices(indexType, locales);
    logger.info('[finishAtomicReindex] Index settings copied.');

    switch (indexingAPI) {
        case INDEXING_APIS.INGESTION_API:
            logger.info('[finishAtomicReindex][IngestionAPI] Waiting for indexing events to finish...');
            waitForEvents(indexingTasksToWaitFor);
            break;
        case INDEXING_APIS.SEARCH_API:
        default:
            logger.info('[finishAtomicReindex][SearchAPI] Waiting for indexing tasks to finish...');
            waitForTasks(indexingTasksToWaitFor);
            break;
    }

    logger.info('[finishAtomicReindex] Indexing tasks finished. Waiting for copy settings tasks to finish...');
    waitForTasks(copySettingsTasks);

    logger.info('[finishAtomicReindex] Settings copied. Moving temporary indices to production...');
    moveTemporaryIndices(indexType, locales);

    logger.info('[finishAtomicReindex] Temporary indices moved to production.');
}

module.exports.deleteTemporaryIndices = deleteTemporaryIndices;
module.exports.finishAtomicReindex = finishAtomicReindex;
module.exports.waitForTasks = waitForTasks;
module.exports.waitForEvents = waitForEvents;

// For unit testing
module.exports.copySettingsFromProdIndices = copySettingsFromProdIndices;
module.exports.moveTemporaryIndices = moveTemporaryIndices;
