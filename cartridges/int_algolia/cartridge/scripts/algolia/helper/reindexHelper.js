var logger = require('dw/system/Logger').getLogger('algolia', 'Algolia');

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');

/**
 * Delete the temporary indices corresponding to the given type and locales
 * @param {string} indexType - type of the index (products or categories)
 * @param {string[]} locales - locales for which we want to delete the indices
 * @return {Object} Algolia taskIDs, in the form: { indexName1: <taskID>, indexName2: <taskID> }
 */
function deleteTemporariesIndices(indexType, locales) {
    var deletionTasks = {};
    locales.forEach(function(locale) {
        var tmpIndexName = algoliaData.calculateIndexName(indexType, locale) + '.tmp';
        var res = algoliaIndexingAPI.deleteIndex(tmpIndexName);
        if (res.ok) {
            logger.info(tmpIndexName + ' deleted. ' + JSON.stringify(res.object.body));
            deletionTasks[tmpIndexName] = res.object.body.taskID;
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
            logger.info('Settings copied to ' + tmpIndexName);
            copySettingsTasks[tmpIndexName] = res.object.body.taskID;
        }
    });
    return copySettingsTasks;
}

/**
 * Copy the temporary indices to production
 * @param {string} indexType - type of the index (products or categories)
 * @param {string[]} locales - locales for which we want to move the indices
 */
function moveTemporariesIndices(indexType, locales) {
    locales.forEach(function(locale) {
        var indexName = algoliaData.calculateIndexName(indexType, locale);
        var tmpIndexName = indexName + '.tmp';
        var res = algoliaIndexingAPI.moveIndex(tmpIndexName, indexName);
        if (res.ok) {
            logger.info('Index ' + tmpIndexName + ' moved to ' + indexName);
        } else {
            logger.error('Error while moving ' + tmpIndexName + ' to ' + indexName)
        }
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
    algoliaIndexingAPI.waitForTasks(lastIndexingTasks);
    logger.info('[FinishReindex] Waiting for the last copy settings tasks to complete... ' + JSON.stringify(copySettingsTasks));
    algoliaIndexingAPI.waitForTasks(copySettingsTasks);

    logger.info('[FinishReindex] Moving temporary indices to production...');
    moveTemporariesIndices(indexType, locales);
}

module.exports.deleteTemporariesIndices = deleteTemporariesIndices;
module.exports.finishAtomicReindex = finishAtomicReindex;

// For unit testing
module.exports.copySettingsFromProdIndices = copySettingsFromProdIndices;
module.exports.moveTemporariesIndices = moveTemporariesIndices;
