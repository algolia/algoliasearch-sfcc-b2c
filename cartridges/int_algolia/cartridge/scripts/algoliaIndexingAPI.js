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

const INDEXING_APIS = {
    SEARCH_API: 'search-api',
    INGESTION_API: 'ingestion-api',
}

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
 * This method will call the /task endpoint until its status become 'published'
 * https://www.algolia.com/doc/rest-api/search/#get-a-tasks-status
 * @param {string} indexName - index name where the task was executed
 * @param {number} taskID - id of the task
 */
function waitTask(indexName, taskID) {
    var indexingService = algoliaIndexingService.getService(__jobInfo);
    var maxWait = waitTaskTimeout || 10 * 60 * 1000;
    var start = Date.now();
    var nbRequestsSent = 0;

    while (Date.now() < start + maxWait) {
        ++nbRequestsSent;
        var result = retryableCall(
            indexingService,
            {
                method: 'GET',
                path: '/1/indexes/' + indexName + '/task/' + taskID,
            }
        );

        if (!result.ok) {
            logger.error(result.getErrorMessage());
        } else {
            if (result.object.body.status === 'published') {
                logger.info('Task ' + taskID + ' published. (' + nbRequestsSent + ' requests sent).');
                return;
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

    let retryableCallParameters = {
        method: 'POST',
        url: 'https://data.' + analyticsRegion + '.algolia.com',
        path: '/1/push/' + indexName,
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
