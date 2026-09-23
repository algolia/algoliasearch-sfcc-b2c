const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();
const algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');

/* --------------------------- Search API methods --------------------------- */

/**
 * Sends an Algolia batch to the Search API `multiple-batch` endpoint
 * https://www.algolia.com/doc/rest-api/search/multiple-batch
 * If records fail to be indexed (because e.g. they are too big), they are removed from the batch and the batch is retried.
 * Note: this function mutates the batch array by splicing out failed records.
 * @param {Object[]} batch - Algolia multi-indices batch
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

// Push failures known to repeat for every remaining chunk, each identified by the status
// and the message Algolia returns with it. Algolia documents no status other than 400
// for this endpoint, so a status alone concludes nothing: both parts have to match a
// case reproduced against a live application. Extend the list as more are found.
// Each entry matches on what went wrong rather than on the remedy Algolia suggests,
// since the same remedy can accompany other errors. Every fragment has to be present.
var UNRECOVERABLE_PUSH_FAILURES = [
    // No task resolves for the index name:
    // {"error":{"code":"resource_not_found"}, "message":"cannot find task INDEX","status":404}
    { status: 404, messageContains: ['cannot find task'] },

    // More than one task targets the index name. The "invalid_payload" code is shared
    // with genuine payload errors, and the task IDs and index name vary, so the two
    // fixed halves of the sentence identify it:
    // {"error":{"code":"invalid_payload"},
    //  "message":"multiple tasks (ID, ID) found for the Push connector with indexName
    //  INDEX, please use /2/tasks/:id/push instead","status":400}
    { status: 400, messageContains: ['multiple tasks', 'found for the Push connector'] },
];

/**
 * Checks whether a failed push matches a known unrecoverable case, meaning it is about
 * the index or the request rather than the records, and will fail the same way for the
 * rest of the run. Anything unrecognized counts as recoverable, so the run continues and
 * failureThresholdPercentage decides the outcome as it did before.
 * @param {dw.svc.Result} result the result of a push call
 * @returns {boolean} true if the failure matches a known unrecoverable case
 */
function isKnownUnrecoverableFailure(result) {
    var status = result.getError ? result.getError() : 0;
    var message = result.getErrorMessage ? result.getErrorMessage() : '';

    if (!message) {
        return false;
    }

    return UNRECOVERABLE_PUSH_FAILURES.some(function (knownFailure) {
        return knownFailure.status === status && knownFailure.messageContains.every(function (fragment) {
            return message.indexOf(fragment) !== -1;
        });
    });
}

/**
 * Sends Algolia records to the Ingestion API grouped by indexName and action
 * @param {Object} groupedRecords - Records grouped by `indexName` and `action`.
 * @param {string} [indexingMethod] - the indexing method (e.g. 'fullCatalogReindex'), forwarded to pushByIndexName
 * @returns {Object} result object containing
 * { result, failedRecords, sentRecords, errorMessages, unrecoverableFailure }
 */
function sendGroupedIngestionAPIRecords(groupedRecords, indexingMethod) {
    let indices = Object.keys(groupedRecords);
    let failedRecords = 0;
    let sentRecords = 0;
    let wasThereAnError = false;
    let indexingEvents = {};
    let errorMessages = [];
    let unrecoverableFailure = false;

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
            let result = algoliaIndexingAPI.pushByIndexName(recordToSend, indexName, indexingMethod);
            if (result.ok) {
                sentRecords += recordToSend.records.length;
                let runID = result.object.body.runID;
                let eventID = result.object.body.eventID;
                if (!indexingEvents[runID]) {
                    indexingEvents[runID] = [];
                }
                indexingEvents[runID].push(eventID);
            } else {
                wasThereAnError = true;
                failedRecords += recordToSend.records.length;

                // Keep what the API said so the job report can name the cause instead of
                // pointing at the log. A missing task or a conflicting destination fails
                // every chunk of an index with identical text, hence the deduplication.
                let message = result.getErrorMessage ? result.getErrorMessage() : null;
                if (message && errorMessages.indexOf(message) === -1) {
                    errorMessages.push(message);
                }

                if (isKnownUnrecoverableFailure(result)) {
                    unrecoverableFailure = true;
                }
            }
        }
    }

    return {
        result: {
            ok: !wasThereAnError,
            object: {
                body: { indexingEvents: indexingEvents }
            }
        },
        failedRecords: failedRecords,
        sentRecords: sentRecords,
        errorMessages: errorMessages,
        unrecoverableFailure: unrecoverableFailure,
    }
}


module.exports.sendRetryableBatch = sendRetryableBatch;
module.exports.groupRecordsForIngestionAPI = groupRecordsForIngestionAPI;
module.exports.sendGroupedIngestionAPIRecords = sendGroupedIngestionAPIRecords;
