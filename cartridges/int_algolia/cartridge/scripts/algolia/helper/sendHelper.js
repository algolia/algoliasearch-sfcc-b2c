'use strict';

// initialize
var QUOTA_API_JS_JSON_STRING_LENGTH = 600000; // The maximum allowed length of a JavaScript string created by JSON.stringify().
var MAX_CHUNKS_SIZE = 1000; // Maximum chunk size
var MAX_FAILED_CHUNKS = 3;

var logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();
var Status = require('dw/system/Status');

/**
 * Send array of objects to Algolia API
 * @param {Array} entriesArray - array of objects for send to Algolia
 * @param {string} [resType] (optional, when using multiple endpoints) "price" | "inventory" - passing it over to sendProductObjects()
 * @param {string} [fieldList] (optional) if supplied, it will override the list of fields to be sent in the handshake - passing it over to sendProductObjects()
 * @returns {boolean} - successful to send
 */
function sendChunk(entriesArray, resType, fieldList) {
    var algoliaExportAPI = require('*/cartridge/scripts/algoliaExportAPI');
    var result = algoliaExportAPI.sendProductObjects(entriesArray, resType, fieldList);
    return result;
}

/**
 * Resending unsent objects to Algolia API
 * @param {Array} failedChunks - array of objects for send to Algolia
 * @param {string} [resType] (optional, when using multiple endpoints) "price" | "inventory" - passing it over to sendProductObjects()
 * @param {string} [fieldList] (optional) if supplied, it will override the list of fields to be sent in the handshake - passing it over to sendProductObjects()
 * @returns {boolean} - successful
 */
function sendFailedChunks(failedChunks, resType, fieldList) {
    var status = new Status(Status.OK);

    if (failedChunks.length === 0) {
        return status;
    }

    var chunkLength = Math.floor(failedChunks.length / MAX_FAILED_CHUNKS) + 1;

    for (var startIndex = 0; startIndex < failedChunks.length; startIndex += chunkLength) {
        var elements = failedChunks.slice(startIndex, startIndex + chunkLength);
        status = sendChunk(elements);
        if (!status.ok) { break; }
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
    sendLogData.sendDate = algoliaData.getLocalDateTime(new Date());
    sendLogData.sendError = true;
    sendLogData.sendErrorMessage = '';
    sendLogData.sentChunks = 0;
    sendLogData.sentRecords = 0;
    sendLogData.failedChunks = 0;
    sendLogData.failedRecords = 0;

    var entries = [];
    var failedChunks = [];
    var countFailedChunks = 0;

    var status = new Status(Status.OK);

    if (empty(deltaList) || deltaList.getSize() === 0) {
        logger.info('Delta is empty, no syncronization is needed');
        deltaList.close();
        sendLogData.sendError = false;
        algoliaData.setLogData(logID, sendLogData);
        return status;
    }

    // check if merchant set his preferred number
    var inputMaxNumberOfEntries = Object.hasOwnProperty.call(parameters, 'maxNumberOfEntries') ? parseInt(parameters.maxNumberOfEntries, 10) : MAX_CHUNKS_SIZE;

    // calculate it
    var calcMaxNumberOfEntries = Math.floor(QUOTA_API_JS_JSON_STRING_LENGTH / deltaList.getRecordSize()); // number of objects to fit the quota
    calcMaxNumberOfEntries -= Math.floor(calcMaxNumberOfEntries / 5); // reduce by 20%

    var maxNumberOfEntries = Math.min(inputMaxNumberOfEntries, calcMaxNumberOfEntries);

    while (deltaList.hasNext()) {
        entries.push(deltaList.next());

        if (entries.length >= maxNumberOfEntries || !deltaList.hasNext()) {
            // send the chunks
            status = sendChunk(entries);
            if (!status.ok) {
                failedChunks = failedChunks.concat(entries);
                countFailedChunks += 1;
                sendLogData.failedChunks += 1;
                sendLogData.failedRecords += entries.length;
                sendLogData.sendErrorMessage = status.details.errorMessage ? status.details.errorMessage : 'Error sending chunk. See the log file for details.';

                if (countFailedChunks > MAX_FAILED_CHUNKS) {
                    sendLogData.sendError = true;
                    sendLogData.sendErrorMessage = 'Too many failed chunks. Service might be down. Aborting the job.';
                    algoliaData.setLogData(logID, sendLogData);
                    deltaList.close();
                    return status;
                }
            } else {
                sendLogData.sentChunks += 1;
                sendLogData.sentRecords += entries.length;
            }
            entries.length = 0; // crear the array
        }
    }

    deltaList.close();

    // Resending failed chunks
    status = sendFailedChunks(failedChunks);

    if (!status.ok) {
        sendLogData.sendError = true;
        sendLogData.sendErrorMessage = status.details.errorMessage ? status.details.errorMessage : 'Error sending chunk. See the log file for details.';
    } else {
        sendLogData.sendError = false;
        sendLogData.sentChunks += sendLogData.failedChunks;
        sendLogData.sentRecords += sendLogData.failedRecords;
        sendLogData.failedChunks = 0;
        sendLogData.failedRecords = 0;
    }

    sendLogData.sendDate = algoliaData.getLocalDateTime(new Date());
    algoliaData.setLogData(logID, sendLogData);

    logger.info('Chunks sent: {0}; Failed chunks: {1}\nRecords sent: {2}; Failed records: {3}',
        sendLogData.sentChunks, sendLogData.failedChunks, sendLogData.sentRecords, sendLogData.failedRecords);

    return status;
}

module.exports.sendChunk = sendChunk;
module.exports.sendFailedChunks = sendFailedChunks;
module.exports.sendDelta = sendDelta;
