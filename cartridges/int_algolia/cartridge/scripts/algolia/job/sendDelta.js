'use strict';

// initialize
var QUOTA_API_JS_JSON_STRING_LENGTH = 600000; // The maximum allowed length of a JavaScript string created by JSON.stringify().
var MAX_FAILED_CHUNKS = 3;

var logger = require('dw/system/Logger').getLogger('algolia', 'Algolia');

/**
 * Send array of objects to Algolia API
 * @param {Array} entriesArray - array of objects for send to Algolia
 * @returns {boolean} - successful to send
 */
function sendChunk(entriesArray) {
    var algoliaApi = require('*/cartridge/scripts/algoliaApi');
    var result = algoliaApi.sendDelta(entriesArray);
    return !result.error;
}

/**
 * Resending unsent objects to Algolia API
 * @param {Array} failedChunks - array of objects for send to Algolia
 * @returns {boolean} - successful
 */
function sendFailedChunks(failedChunks) {
    if (failedChunks.length === 0) {
        return true;
    }

    var chunkLength = Math.floor(failedChunks.length / MAX_FAILED_CHUNKS) + 1;

    for (var startIndex = 0; startIndex < failedChunks.length; startIndex += chunkLength) {
        var elements = failedChunks.slice(startIndex, startIndex + chunkLength);
        if (!sendChunk(elements)) {
            return false;
        }
    }

    return true;
}

module.exports.execute = function (parameters) {
    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    var productDeltaIterator = require('*/cartridge/scripts/algolia/helper/productDeltaIterator');
    var date = new Date();
    var sendLogData = algoliaData.getLogData('LastProductSyncLog');
    sendLogData.sendDate = date.toISOString();
    sendLogData.sendError = false;
    sendLogData.sendErrorMessage = '';
    sendLogData.sendedChunk = 0;
    sendLogData.sendedRecords = 0;
    sendLogData.failedChunk = 0;
    sendLogData.failedRecords = 0;

    var entries = [];
    var maxNumberOfEntries;
    var failedChunks = [];
    var countFailedShunks = 0;

    var deltaList = productDeltaIterator.create();

    if (deltaList.getSize() === 0) {
        logger.info('Delta is empty, no syncronization is needed');
        deltaList.close();
        return true;
    }

    // check if merchant set his preferred number
    if (parameters.maxNumberOfEntries === '') {
        maxNumberOfEntries = parameters.maxNumberOfEntries;
    } else {
        // calculate it
        maxNumberOfEntries = Math.floor(QUOTA_API_JS_JSON_STRING_LENGTH / deltaList.getRecordSize()); // number of objects to fit the quota
        maxNumberOfEntries -= Math.floor(maxNumberOfEntries / 5); // reduce by 20%

        logger.debug('Calculated maximum product in a chunk (maxNumberOfEntries) : {0}', maxNumberOfEntries);
    }

    while (deltaList.hasNext()) {
        entries.push(deltaList.next());

        if (entries.length >= maxNumberOfEntries || !deltaList.hasNext()) {
            // send the chunks
            if (!sendChunk(entries)) {
                failedChunks = failedChunks.concat(entries);
                countFailedShunks += 1;
                sendLogData.failedChunk += 1;
                sendLogData.failedRecords += entries.length;
                if (countFailedShunks > MAX_FAILED_CHUNKS) {
                    sendLogData.sendErrorMessage = 'Too many failed chunks. Service might be down. Aborting the job.';
                    algoliaData.setLogData('LastProductSyncLog', sendLogData);
                    throw new Error('Too many failed chunks. Service might be down. Aborting the job.');
                    // break;
                }
            }
            sendLogData.sendedChunk += 1;
            sendLogData.sendedRecords += entries.length;
            entries.length = 0; // crear the array
        }
    }

    deltaList.close();

    // Resending failed chunks
    if (sendFailedChunks(failedChunks)) {
        jobHelper.updateProductSnapshotFile();
        algoliaData.setPreference('LastProductSyncDate', new Date());
    }

    date = new Date();
    sendLogData.sendDate = date.toISOString();
    algoliaData.setLogData('LastProductSyncLog', sendLogData);

    logger.info('Sended chunk: {0}; Failed chunk: {1}\nSended records: {2}; Failed records: {3}',
        sendLogData.sendedChunk, sendLogData.failedChunk, sendLogData.sendedRecords, sendLogData.failedRecords);

    return true;
};
