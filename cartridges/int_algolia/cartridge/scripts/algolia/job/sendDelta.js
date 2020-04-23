"use strict";

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
    if (failedChunks.length == 0) {
        return true;
    }

    var chunkLength = Math.floor(failedChunks.length / MAX_FAILED_CHUNKS) + 1;

    for(var startIndex = 0; startIndex < failedChunks.length; startIndex += chunkLength ) {
        var elements = failedChunks.slice(startIndex, startIndex + chunkLength);
        if (!sendChunk(elements)) {
            return false;
        };
    };

    return true;
}

module.exports.execute = function (parameters) {
    var productDeltaIterator = require('*/cartridge/scripts/algolia/helper/productDeltaIterator');
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
                if (++countFailedShunks > MAX_FAILED_CHUNKS) {
                    throw new Error('Too many failed chunks. Service might be down. Aborting the job.');
                    break;
                }
            };
            entries.length = 0; // crear the array            
        }
    }

    deltaList.close();
    
    //Resending failed chunks
    sendFailedChunks(failedChunks);
    return true;
};
