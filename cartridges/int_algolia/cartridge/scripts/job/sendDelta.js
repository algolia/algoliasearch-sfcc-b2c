// initialize
const QUOTA_API_JS_JSON_STRING_LENGTH = 600000; // The maximum allowed length of a JavaScript string created by JSON.stringify().
const MAX_FAILED_CHUNKS = 3;

var logger = require('dw/system/Logger').getLogger('algolia', 'Algolia');
var failedChunks = [];

function sendChunk(entriesArray){
    var result = algoliaApi.sendDelta(entriesArray);
    if (result.error) {
        // save chunks for retry
        failedChunks = failedChunks.push(entriesArray);
        if (failedChunks.length > MAX_FAILED_CHUNKS) {
            throw new Error('Too many failed chunks. Service might be down. Aborting the job.');
        }
    }
    return null;
}

function sendFailedChunks(){
    failedChunks.forEach( function (elements) {
        sendChunk(elements);
    });
}

exports.sendDelta = function(parameters, stepExecution) {
    var deltaList = require('~/scripts/helper/productDeltaIterator');
    var algoliaApi = require('~/scripts/helper/algoliaApi');
    var entries = [];

    if (deltaList.getSize() == 0) {
        logger.info('Delta is empty, no syncronization is needed');
    }

    // check if merchant set his preferred number
    if (parameters.maxNumberOfEntries == '' ){
        maxNumberOfEntries = parameters.maxNumberOfEntries;
    } else {
        // calculate it

        var firstEntry = deltaList.next(); // get first product record
        entries.push(firstEntry); // store it to be sent
        
        // calculate size of one object
        //@TODO: clculate average product length when creating a delta file and add it to the delta xml header.
        var sampleEntryLength = JSON.stringify(firstEntry).length;
        var maxNumberOfEntries = Math.floor( QUOTA_API_JS_JSON_STRING_LENGTH / sampleEntryLength ); // number of objects to fit the quota
        maxNumberOfEntries -= Math.floor( maxNumberOfEntries / 5 ); // reduce by 20%
        
        logger.debug('Calculated maximum product in a chunk (maxNumberOfEntries) : {0}', maxNumberOfEntries);
    }

    while (deltaList.hasNext()){
        if (entries.length >= maxNumberOfEntries) {
            sendChunk(entries); //send the chunks
            entries.length = 0; // crear the array 
        } else {
            entries.push(deltaList.next());
        }
    }
    // send the chunks left
    sendChunk(entries);

    // send failed chunks

    sendFailedChunks();
}