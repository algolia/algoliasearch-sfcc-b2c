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
    var status = new Status(Status.OK);

    if (failedChunks.length === 0) {
        return status;
    }

    var chunkLength = Math.floor(failedChunks.length / MAX_FAILED_CHUNKS) + 1;

    for (var startIndex = 0; startIndex < failedChunks.length; startIndex += chunkLength) {
        var elements = failedChunks.slice(startIndex, startIndex + chunkLength);
        status = sendChunk(elements);
        if (status.error) { break; }
    }

    return status;
}

/**
 * Send Delta to Algolia API
 * @param {DeltaIterator} deltaList - DeltaIterator object
 * @param {string} logID - name of logData in preferences
 * @param {Object} parameters - additional parameters
 * @returns {dw.system.Status} - status
 */
function sendDelta(deltaList, logID, parameters) {
    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

    var sendLogData = algoliaData.getLogData(logID);
    sendLogData.sendDate = algoliaData.dateToLocalTimeStamp(new Date());
    sendLogData.sendError = true;
    sendLogData.sendErrorMessage = '';
    sendLogData.sendedChunk = 0;
    sendLogData.sendedRecords = 0;
    sendLogData.failedChunk = 0;
    sendLogData.failedRecords = 0;

    var maxNumberOfEntries;
    var entries = [];
    var failedChunks = [];
    var countFailedShunks = 0;

    var status = null;

    if (deltaList.getSize() === 0) {
        logger.info('Delta is empty, no syncronization is needed');
        deltaList.close();
        sendLogData.sendError = false;
        algoliaData.setLogData(logID, sendLogData);
        return new Status(Status.OK);
    }

    // check if merchant set his preferred number
    if (parameters.maxNumberOfEntries === '') {
        maxNumberOfEntries = parameters.maxNumberOfEntries;
    } else {
        // calculate it
        maxNumberOfEntries = Math.floor(QUOTA_API_JS_JSON_STRING_LENGTH / deltaList.getRecordSize()); // number of objects to fit the quota
        maxNumberOfEntries -= Math.floor(maxNumberOfEntries / 5); // reduce by 20%
    }

    while (deltaList.hasNext()) {
        entries.push(deltaList.next());

        if (entries.length >= maxNumberOfEntries || !deltaList.hasNext()) {
            // send the chunks
            status = sendChunk(entries);
            if (status.error) {
                failedChunks = failedChunks.concat(entries);
                countFailedShunks += 1;
                sendLogData.failedChunk += 1;
                sendLogData.failedRecords += entries.length;
                sendLogData.sendErrorMessage = status.details.errorMessage ? status.details.errorMessage : 'Error sending chunk. See the log file for details.';

                if (countFailedShunks > MAX_FAILED_CHUNKS) {
                    sendLogData.sendError = true;
                    sendLogData.sendErrorMessage = 'Too many failed chunks. Service might be down. Aborting the job.';
                    algoliaData.setLogData(logID, sendLogData);
                    deltaList.close();
                    return new Status(Status.ERROR);
                }
            } else {
                sendLogData.sendedChunk += 1;
                sendLogData.sendedRecords += entries.length;
            }
            entries.length = 0; // crear the array
        }
    }

    deltaList.close();

    // Resending failed chunks
    status = sendFailedChunks(failedChunks);

    if (status.error) {
        sendLogData.sendError = true;
        sendLogData.sendErrorMessage = status.details.errorMessage ? status.details.errorMessage : 'Error sending chunk. See the log file for details.';
    } else {
        algoliaData.setPreference(logID, new Date());
        sendLogData.sendError = false;
        sendLogData.sendedChunk += sendLogData.failedChunk;
        sendLogData.sendedRecords += sendLogData.failedRecords;
        sendLogData.failedChunk = 0;
        sendLogData.failedRecords = 0;
    }

    sendLogData.sendDate = algoliaData.dateToLocalTimeStamp(new Date());
    algoliaData.setLogData(logID, sendLogData);

    logger.info('Sended chunk: {0}; Failed chunk: {1}\nSended records: {2}; Failed records: {3}',
        sendLogData.sendedChunk, sendLogData.failedChunk, sendLogData.sendedRecords, sendLogData.failedRecords);

    return status;
}

module.exports = sendDelta;
