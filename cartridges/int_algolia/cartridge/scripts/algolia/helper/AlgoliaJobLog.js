'use strict';

/**
* @class AlgoliaJobLog
* @description Iterator for the changedProducts array of objects structure used in the delta export job
* @param {string} jobID - the ID or name of the job
* @param {string} jobType - 'product' or 'category'
* @constructor
*/
const AlgoliaJobLog = function(jobID, jobType) {
    var that = this;

    this.jobID = jobID;
    this.jobType = jobType;
    this.processedDate;
    this.processedError = false;
    this.processedErrorMessage = '';
    this.processedRecords = 0;
    this.processedRecordsToUpdate = 0;
    this.sendDate;
    this.sendError = false;
    this.sendErrorMessage = '';
    this.sentChunks = 0;
    this.sentRecords = 0;
    this.failedChunks = 0;
    this.failedRecords = 0;
}

AlgoliaJobLog.prototype.writeToCustomObject = function() {
    const CustomObjectMgr = require('dw/object/CustomObjectMgr');
    const Transaction = require('dw/system/Transaction');

    var StringUtils = require('dw/util/StringUtils');
    var uniqueID = StringUtils.encodeBase64(Math.floor(Date.now() / 1000).toString()); // current UNIX timestamp in seconds, base64-encoded

    const customObjectID = this.jobID + '__' + uniqueID;

    let that = this; // context changes inside Transaction.wrap()

    try {
        Transaction.wrap(function() {
            const algoliaJobLogCO = CustomObjectMgr.createCustomObject('AlgoliaJobLog', customObjectID);

            algoliaJobLogCO.custom.jobID = that.jobID;
            algoliaJobLogCO.custom.jobType = that.jobType;
            algoliaJobLogCO.custom.processedDate = empty(that.processedDate) ? null : that.processedDate;
            algoliaJobLogCO.custom.processedError = that.processedError;
            algoliaJobLogCO.custom.processedErrorMessage = that.processedErrorMessage;
            algoliaJobLogCO.custom.processedRecords = that.processedRecords;
            algoliaJobLogCO.custom.processedRecordsToUpdate = that.processedRecordsToUpdate;
            algoliaJobLogCO.custom.sendDate = empty(that.sendDate) ? null : that.sendDate;
            algoliaJobLogCO.custom.sendError = that.sendError;
            algoliaJobLogCO.custom.sendErrorMessage = that.sendErrorMessage;
            algoliaJobLogCO.custom.sentChunks = that.sentChunks;
            algoliaJobLogCO.custom.sentRecords = that.sentRecords;
            algoliaJobLogCO.custom.failedChunks = that.failedChunks;
            algoliaJobLogCO.custom.failedRecords = that.failedRecords;
        });
    } catch (e) {
        return false;
    }

    return true;
}

AlgoliaJobLog.prototype.readFromCustomObject = function(customObject) {
    this.jobID = customObject.custom.jobID;
    this.jobType = customObject.custom.jobType;
    this.processedDate = customObject.custom.processedDate;
    this.processedError = customObject.custom.processedError;
    this.processedErrorMessage = customObject.custom.processedErrorMessage;
    this.processedRecords = customObject.custom.processedRecords;
    this.processedRecordsToUpdate = customObject.custom.processedRecordsToUpdate;
    this.sendDate = customObject.custom.sendDate;
    this.sendError = customObject.custom.sendError;
    this.sendErrorMessage = customObject.custom.sendErrorMessage;
    this.sentChunks = customObject.custom.sentChunks;
    this.sentRecords = customObject.custom.sentRecords;
    this.failedChunks = customObject.custom.failedChunks;
    this.failedRecords = customObject.custom.failedRecords;
}

module.exports = AlgoliaJobLog;
