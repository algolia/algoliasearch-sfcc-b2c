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
 * Wait for multiple Search API tasks to complete.
 * Polls each task via /1/indexes/{indexName}/task/{taskID} until status is 'published'.
 * @param {Object} taskIDs - { "<indexName>": <taskID> }
 */
function waitForTasks(taskIDs) {
    Object.keys(taskIDs).forEach(function (indexName) {
        logger.info('Waiting for Search API task ' + taskIDs[indexName] + ' on index ' + indexName);
        algoliaIndexingAPI.waitTask(indexName, taskIDs[indexName]);
    });
}

/**
 * Wait for multiple Ingestion API events to become available.
 * Polls each event via /1/runs/{runID}/events/{eventID} until it returns a non-404 response.
 * Ingestion events have no sequential processing guarantee, so all must be tracked and waited on.
 * @param {Object} eventsByIndex - { "<indexName>": [{ runID: <string>, eventID: <string> }, ...] }
 */
function waitForEvents(eventsByIndex) {
    Object.keys(eventsByIndex).forEach(function (indexName) {
        var events = eventsByIndex[indexName];
        events.forEach(function (event) {
            logger.info('Waiting for Ingestion API event ' + event.eventID + ' (run ' + event.runID + ') on index ' + indexName);
            algoliaIndexingAPI.waitForRunEvent(event.runID, event.eventID);
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
 * @param {Object} lastIndexingTasks - Search API: { indexName: taskID }; Ingestion API: { indexName: [runID, ...] }
 * @param {string} [indexingAPI] - 'search-api' (default) or 'ingestion-api'
 */
function finishAtomicReindex(indexType, locales, lastIndexingTasks, indexingAPI) {
    logger.info('[FinishReindex] copying index settings from production...');
    var copySettingsTasks = copySettingsFromProdIndices(indexType, locales);

    logger.info('[FinishReindex] Waiting for the last indexing tasks...');
    switch (indexingAPI) {
        default:
        case INDEXING_APIS.SEARCH_API:
            waitForTasks(lastIndexingTasks);
            break;
        case INDEXING_APIS.INGESTION_API:
            waitForEvents(lastIndexingTasks);
            break;
    }

    logger.info('[FinishReindex] Waiting for copy settings tasks...');
    waitForTasks(copySettingsTasks);

    logger.info('[FinishReindex] Moving temporary indices to production...');
    moveTemporaryIndices(indexType, locales);
}

module.exports.deleteTemporaryIndices = deleteTemporaryIndices;
module.exports.finishAtomicReindex = finishAtomicReindex;
module.exports.waitForTasks = waitForTasks;
module.exports.waitForEvents = waitForEvents;

// For unit testing
module.exports.copySettingsFromProdIndices = copySettingsFromProdIndices;
module.exports.moveTemporaryIndices = moveTemporaryIndices;
