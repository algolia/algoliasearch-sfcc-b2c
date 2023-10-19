/**
 *  Client to communicate with Algolia's indexing API:
 *  https://www.algolia.com/doc/rest-api/search/#objects-endpoints
 **/

const algoliaIndexingService = require('*/cartridge/scripts/services/algoliaIndexingService');
const retryableCall = require('*/cartridge/scripts/algolia/helper/retryStrategy').retryableCall;
const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();

var __jobInfo = {};

/**
 * Set information about the job using the API Client
 * @param {Object} jobInfo - object with the following structure: { "jobID": "", "stepID": "" }
 */
function setJobInfo(jobInfo) {
    __jobInfo = jobInfo;
}

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
 * Send a batch of objects to Algolia Indexing API (multiple indices):
 * https://www.algolia.com/doc/rest-api/search/#batch-write-operations-multiple-indices
 * @param {AlgoliaOperation[]} requestsArray - array of requests to send to Algolia. Each operation must contain the `indexName` to target.
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
    var maxWait = 5 * 60 * 1000;
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

module.exports.setJobInfo = setJobInfo;
module.exports.sendBatch = sendBatch;
module.exports.sendMultiIndexBatch = sendMultiIndexBatch;
module.exports.deleteIndex = deleteIndex;
module.exports.copyIndexSettings = copyIndexSettings;
module.exports.moveIndex = moveIndex;
module.exports.waitTask = waitTask;
