const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();
const algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');

/* --------------------------- Search API methods --------------------------- */

/**
 * Sends an Algolia batch to the Search API `multiple-batch` endpoint
 * https://www.algolia.com/doc/rest-api/search/multiple-batch
 * If records fail to be indexed (because e.g. they are too big), they are removed from the batch and the batch is retried.
 * @param {Object} batch - Algolia multi-indices batch
 * @param {String} [indexName] Target index -- only used with the Ingestion API
 * @return {Object} returns an object with the last call result and the number of failed records.
 */
function sendRetryableBatch(batch) {
    var MAX_ATTEMPTS = 50;
    var attempt = 0;
    var failedRecords = 0;
    let result = algoliaIndexingAPI.sendMultiIndexBatch(batch);

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

/* --------------------------- Ingestion API methods --------------------------- */

/**
 * Groups records to be sent by index name and action to build ingestion API batches.
 * The "deleteObject" action is currently only used with the algoliaProductDeltaIndex job
 * and the real-time inventory update feature.
 * Example input:
 *  recordArray = [
 *      {
 *          action: "addObject",
 *          body: {
 *              defaultVariantID: "...",
 *              image_groups: "[{ ... }, { ... }]",
 *              masterID: "...",
 *              name: "...",
 *              objectID: "...",
 *              short_description: "..."
 *              variants: [{ ... }, { ... }],
 *              ... any other record properties configured in BM ...
 *          },
 *          indexName: "...",
 *      },
 *      {
 *          action: "deleteObject",
 *          body: {
 *              objectID: "..."
 *          },
 *          indexName: "...",
 *      },
 *      ...
 *  ]
 * Example return object:
 *  groupedRecords = {
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
 *  }
 * @param {Object[]} recordArray - record entries with `action` and `records`.
 * @returns {Object} object containing records grouped by target index and action
 */
function groupRecordsForIngestionAPI(recordArray) {

    let groupedRecords = {};

    // group records by indexName and action
    for (let i = 0; i < recordArray.length; i ++) {
        let currentObject = recordArray[i];
        let indexName = currentObject.indexName;
        let action = currentObject.action;

        if (empty(groupedRecords[indexName])) {
            groupedRecords[indexName] = {};
        }

        if (empty(groupedRecords[indexName][action])) {
            groupedRecords[indexName][action] = [];
        }

        groupedRecords[indexName][action].push(currentObject.body);
    }

    return groupedRecords;
}

/**
 * Sends Algolia records to the Ingestion API grouped by indexName and action
 * @param {Object} groupedRecords - Records grouped by `indexName` and `action`.
 * @returns {Object} result object containing status and number of failed records
 */
function sendGroupedIngestionAPIRecords(groupedRecords) {
    let indices = Object.keys(groupedRecords);
    let failedRecords = 0;
    let wasThereAnError = false;
    let runIDs = {};

    for (let i = 0; i < indices.length; i++) {
        let indexName = indices[i];
        let index = groupedRecords[indexName];
        let actions = Object.keys(index);

        for (let j = 0; j < actions.length; j++) {
            let action = actions[j];
            let recordToSend = {
                action: action,
                records: index[action],
            }
            let result = algoliaIndexingAPI.pushByIndexName(recordToSend, indexName);
            if (result.ok) {
                runIDs[indexName] = result.object.body.runID;
            } else {
                wasThereAnError = true;
                failedRecords += recordToSend.records.length;
            }
        }
    }

    return {
        result: {
            ok: !wasThereAnError,
            object: {
                body: { runID: runIDs }
            }
        },
        failedRecords: failedRecords,
    }
}


module.exports.sendRetryableBatch = sendRetryableBatch;
module.exports.groupRecordsForIngestionAPI = groupRecordsForIngestionAPI;
module.exports.sendGroupedIngestionAPIRecords = sendGroupedIngestionAPIRecords;
