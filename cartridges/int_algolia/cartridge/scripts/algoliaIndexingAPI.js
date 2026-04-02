/**
 *  Client to communicate with Algolia's indexing API:
 *  https://www.algolia.com/doc/rest-api/search/#objects-endpoints
 **/

const waitTaskTimeout = require('*/algoliaconfig').waitTaskTimeout;
const algoliaIndexingService = require('*/cartridge/scripts/services/algoliaIndexingService');
const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
const retryableCall = require('*/cartridge/scripts/algolia/helper/retryStrategy').retryableCall;
const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();

var __jobInfo = {};

const algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');
const INDEXING_APIS = algoliaConstants.INDEXING_APIS;

const analyticsRegion = algoliaData.getPreference('AnalyticsRegion');

/**
 * Set information about the job using the API Client
 * @param {Object} jobInfo - object with the following structure: { "jobID": "", "stepID": "", "indexingMethod": "" }
 */
function setJobInfo(jobInfo) {
    __jobInfo = jobInfo;
}

/* --------------------------- Search API methods --------------------------- */

/**
 * Send a batch of objects to Algolia Indexing API: https://www.algolia.com/doc/rest-api/search/#batch-write-operations
 * @param {string} indexName - name of the index to target
 * @param {Array} requestsArray - array of requests to send to Algolia
 * @returns {dw.svc.Result} - result of the call
 */
function sendBatch(indexName, requestsArray) {
    var indexingService = algoliaIndexingService.getService(__jobInfo);

    var result = retryableCall(
        indexingService,
        {
            method: 'POST',
            path: '/1/indexes/' + indexName + '/batch',
            body: {
                requests: requestsArray,
            }
        }
    );

    if (!result.ok) {
        logger.error(result.getErrorMessage());
    }

    return result;
}

/**
 * Send a batch of objects to Algolia Search API's `multiple-batch` endpoint
 * https://www.algolia.com/doc/rest-api/search/multiple-batch
 * @param {Array} requestsArray - array of requests to send to Algolia. Each operation must contain the `indexName` to target.
 * @returns {dw.svc.Result} - result of the call
 */
function sendMultiIndexBatch(requestsArray) {
    var indexingService = algoliaIndexingService.getService(__jobInfo);

    var result = retryableCall(
        indexingService,
        {
            method: 'POST',
            path: '/1/indexes/*/batch',
            body: {
                requests: requestsArray,
            }
        }
    );

    if (!result.ok) {
        logger.error(result.getErrorMessage());
    }

    return result;
}

/**
 * Delete index
 * @param {string} indexName - index to delete
 * @returns {dw.svc.Result} - result of the call
 */
function deleteIndex(indexName) {
    var indexingService = algoliaIndexingService.getService(__jobInfo);

    var result = retryableCall(
        indexingService,
        {
            method: 'DELETE',
            path: '/1/indexes/' + indexName,
        }
    );

    if (!result.ok) {
        logger.error(result.getErrorMessage());
    }

    return result;
}

/**
 * Get index settings. https://www.algolia.com/doc/rest-api/search/#get-settings
 * @param {string} indexName - index to get the settings from
 * @returns {dw.svc.Result} - result of the call
 */
function getIndexSettings(indexName) {
    var indexingService = algoliaIndexingService.getService(__jobInfo);

    var result = retryableCall(
        indexingService,
        {
            method: 'GET',
            path: '/1/indexes/' + indexName + '/settings',
        }
    );

    if (!result.ok) {
        if (result.error === 404) {
            logger.info('Index ' + indexName + ' does not exist.');
        } else {
            logger.error(result.getErrorMessage());
        }
    }

    return result;
}

/**
 * Set index settings. https://www.algolia.com/doc/rest-api/search/#set-settings
 * @param {string} indexName - targeted index
 * @param {string} indexSettings - index settings to set
 * @returns {dw.svc.Result} - result of the call
 */
function setIndexSettings(indexName, indexSettings) {
    var indexingService = algoliaIndexingService.getService(__jobInfo);

    var result = retryableCall(
        indexingService,
        {
            method: 'PUT',
            path: '/1/indexes/' + indexName + '/settings',
            body: indexSettings,
        }
    );

    if (!result.ok) {
        logger.error(result.getErrorMessage());
    }

    return result;
}

/**
 * Copy the settings of an index to another. https://www.algolia.com/doc/rest-api/search/#copymove-index
 * @param {string} indexNameSrc - index to copy
 * @param {string} indexNameDest - name of the destination index
 * @returns {dw.svc.Result} - result of the call
 */
function copyIndexSettings(indexNameSrc, indexNameDest) {
    var indexingService = algoliaIndexingService.getService(__jobInfo);

    var result = retryableCall(
        indexingService,
        {
            method: 'POST',
            path: '/1/indexes/' + indexNameSrc + '/operation',
            body: {
                operation: 'copy',
                destination: indexNameDest,
                scope: ['settings', 'synonyms', 'rules'],
            }
        }
    );

    if (!result.ok) {
        logger.error(result.getErrorMessage());
    }

    return result;
}

/**
 * Move an index. https://www.algolia.com/doc/rest-api/search/#copymove-index
 * @param {string} indexNameSrc - index to move
 * @param {string} indexNameDest - new name of the index
 * @returns {dw.svc.Result} - result of the call
 */
function moveIndex(indexNameSrc, indexNameDest) {
    var indexingService = algoliaIndexingService.getService(__jobInfo);

    var result = retryableCall(
        indexingService,
        {
            method: 'POST',
            path: '/1/indexes/' + indexNameSrc + '/operation',
            body: {
                operation: 'move',
                destination: indexNameDest,
            }
        }
    );

    if (!result.ok) {
        logger.error(result.getErrorMessage());
    }

    return result;
}

/**
 * Wait for an Algolia task to complete.
 * For Search API: polls /1/indexes/{indexName}/task/{taskID} until status is 'published'.
 * For Ingestion API: polls /1/runs/{runID} until status is 'finished' (throws on failure outcome).
 * @param {string} indexName - index name where the task was executed
 * @param {string|number} taskID - Search API taskID or Ingestion API runID
 * @param {string} [indexingAPI] - 'search-api' (default) or 'ingestion-api'
 */
function waitTask(indexName, taskID, indexingAPI) {
    indexingAPI = indexingAPI || INDEXING_APIS.SEARCH_API;
    var indexingService = algoliaIndexingService.getService(__jobInfo);
    var maxWait = waitTaskTimeout || 10 * 60 * 1000;
    var start = Date.now();
    var nbRequestsSent = 0;
    var path;

    switch (indexingAPI) {
        case INDEXING_APIS.SEARCH_API:
            path = '/1/indexes/' + indexName + '/task/' + taskID;
            break;
        case INDEXING_APIS.INGESTION_API:
            path = '/1/runs/' + taskID;
            break;
    }

    while (Date.now() < start + maxWait) {
        ++nbRequestsSent;
        var result = retryableCall(
            indexingService,
            {
                method: 'GET',
                path: path,
                indexingAPI: indexingAPI,
            }
        );

        if (!result.ok) {
            logger.error(result.getErrorMessage());
        } else {
            switch (indexingAPI) {
                case INDEXING_APIS.SEARCH_API:
                    if (result.object.body.status === 'published') {
                        logger.info('Task ' + taskID + ' published. (' + nbRequestsSent + ' requests sent).');
                        return;
                    }
                    break;
                case INDEXING_APIS.INGESTION_API:
                    if (result.object.body.status === 'finished') {
                        if (result.object.body.outcome === 'failure') {
                            logger.error('Run ' + taskID + ' failed: ' + result.object.body.reason);
                            throw new Error('Run ' + taskID + ' failed: ' + result.object.body.reason);
                        }
                        logger.info('Run ' + taskID + ' finished. (' + nbRequestsSent + ' requests sent).');
                        return;
                    }
                    break;
            }
        }
    }
    logger.error('Max wait time reached... TaskID: ' + taskID + '; index: ' + indexName);
    throw new Error('Max wait time reached. TaskID: ' + taskID + '; index: ' + indexName);
}

/* --------------------------- Ingestion API methods --------------------------- */

/**
 * Sends a request to the Ingestion API's `push` endpoint (https://www.algolia.com/doc/rest-api/ingestion/push)
 * The `push` endpoint can only accept single-index and single-action requests.
 * When using the Ingestion API, requests have already been grouped by indexName and action by this point.
* @param {Object} requestPayload payload object to be sent to the Ingestion API
* @param {String} indexName name of the target index (for Ingestion only), used in the endpoint URL
* @returns {dw.svc.Result} - result of the call
*/
function pushByIndexName(requestPayload, indexName) {
    var indexingService = algoliaIndexingService.getService(__jobInfo);
    var referenceIndexName = indexName.replace('.tmp', ''); // used for atomic reindexing

    let retryableCallParameters = {
        method: 'POST',
        url: 'https://data.' + analyticsRegion + '.algolia.com',
        path: '/1/push/' + indexName + '?referenceIndexName=' + referenceIndexName,
        body: requestPayload,
        indexingAPI: INDEXING_APIS.INGESTION_API,
    }

    var result = retryableCall(indexingService, retryableCallParameters);

    if (!result.ok) {
        logger.error(result.getErrorMessage());
    }

    return result;
}

module.exports.setJobInfo = setJobInfo;
module.exports.sendBatch = sendBatch;
module.exports.sendMultiIndexBatch = sendMultiIndexBatch;
module.exports.deleteIndex = deleteIndex;
module.exports.getIndexSettings = getIndexSettings;
module.exports.setIndexSettings = setIndexSettings;
module.exports.copyIndexSettings = copyIndexSettings;
module.exports.moveIndex = moveIndex;
module.exports.waitTask = waitTask;
module.exports.pushByIndexName = pushByIndexName;
