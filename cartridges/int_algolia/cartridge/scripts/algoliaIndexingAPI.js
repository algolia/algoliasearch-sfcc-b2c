/**
 *  Client to communicate with Algolia's indexing API:
 *  https://www.algolia.com/doc/rest-api/search/#objects-endpoints
 **/

const algoliaIndexingService = require('*/cartridge/scripts/services/algoliaIndexingService');
const retryableCall = require('*/cartridge/scripts/algolia/helper/retryStrategy').retryableCall;
const logger = require('dw/system/Logger').getLogger('algolia');

/**
 * Send a batch of objects to Algolia Indexing API: https://www.algolia.com/doc/rest-api/search/#batch-write-operations
 * @param {string} indexName - name of the index to target
 * @param {Array} requestsArray - array of requests to send to Algolia
 * @returns {dw.system.Status} - successful Status to send
 */
function sendBatch(indexName, requestsArray) {
    var indexingService = algoliaIndexingService.getService();

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
 * @returns {dw.system.Status} - successful Status to send
 */
function sendMultiIndicesBatch(requestsArray) {
    var indexingService = algoliaIndexingService.getService();

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

module.exports.sendBatch = sendBatch;
module.exports.sendMultiIndicesBatch = sendMultiIndicesBatch;
