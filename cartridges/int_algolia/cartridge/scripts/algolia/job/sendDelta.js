'use strict';

// initialize
var QUOTA_API_JS_JSON_STRING_LENGTH = 600000; // The maximum allowed length of a JavaScript string created by JSON.stringify().
var MAX_FAILED_CHUNKS = 3;

var logger = require('dw/system/Logger').getLogger('algolia', 'Algolia');
var Status = require('dw/system/Status');

/**
 * Send array of objects to Algolia API
 * @param {Array} entriesArray - array of objects for send to Algolia
 * @returns {boolean} - successful to send
 */
function sendChunk(entriesArray) {
    var algoliaApi = require('*/cartridge/scripts/algoliaApi');
    var result = algoliaApi.sendDelta(entriesArray);
    return result;
}

/**
 * Resending unsent objects to Algolia API
 * @param {Array} failedChunks - array of objects for send to Algolia
 * @returns {boolean} - successful
 */
function sendFailedChunks(failedChunks) {
    if (failedChunks.length === 0) {
        return new Status(Status.OK);
    }

    var chunkLength = Math.floor(failedChunks.length / MAX_FAILED_CHUNKS) + 1;

    for (var startIndex = 0; startIndex < failedChunks.length; startIndex += chunkLength) {
        var elements = failedChunks.slice(startIndex, startIndex + chunkLength);
        var status = sendChunk(elements);
        if (!status.error) {
            return status;
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
    sendLogData.sendError = true;
    sendLogData.sendErrorMessage = '';
    sendLogData.sendedChunk = 0;
    sendLogData.sendedRecords = 0;
    sendLogData.failedChunk = 0;
    sendLogData.failedRecords = 0;

    var entries = [];
    var maxNumberOfEntries;
    var failedChunks = [];
    var countFailedShunks = 0;

    var status = null;

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
            status = sendChunk(entries);
            if (!status.error) {
                failedChunks = failedChunks.concat(entries);
                countFailedShunks += 1;
                sendLogData.failedChunk += 1;
                sendLogData.failedRecords += entries.length;
                if (countFailedShunks > MAX_FAILED_CHUNKS) {
                    sendLogData.sendError = true;
                    sendLogData.sendErrorMessage = 'Too many failed chunks. Service might be down. Aborting the job.';
                    algoliaData.setLogData('LastProductSyncLog', sendLogData);
                    deltaList.close();
                    return new Status(Status.ERROR);
                    // throw new Error('Too many failed chunks. Service might be down. Aborting the job.');
                }
            } else {
                sendLogData.sendError = true;
                sendLogData.sendErrorMessage = status.details.errorMessage ? status.details.errorMessage : 'Error sending chunk. See the log file for details.';
                algoliaData.setLogData('LastProductSyncLog', sendLogData);
                deltaList.close();
                return status;
            }
            sendLogData.sendedChunk += 1;
            sendLogData.sendedRecords += entries.length;
            entries.length = 0; // crear the array
        }
    }

    deltaList.close();

    // Resending failed chunks
    status = sendFailedChunks(failedChunks);
    date = new Date();
    if (!status.error) {
        jobHelper.updateProductSnapshotFile();
        algoliaData.setPreference('LastProductSyncDate', date);
    }

    sendLogData.sendDate = date.toISOString();
    sendLogData.sendError = false;
    algoliaData.setLogData('LastProductSyncLog', sendLogData);

    logger.info('Sended chunk: {0}; Failed chunk: {1}\nSended records: {2}; Failed records: {3}',
        sendLogData.sendedChunk, sendLogData.failedChunk, sendLogData.sendedRecords, sendLogData.failedRecords);

    return status;
};
