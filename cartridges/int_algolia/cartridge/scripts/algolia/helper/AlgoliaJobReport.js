'use strict';

const System = require('dw/system/System');

/**
* @class AlgoliaJobReport
* @description Iterator for the changedProducts array of objects structure used in the delta export job
* @param {string} jobID - the ID or name of the job
* @param {string} jobType - 'product' or 'category'
* @constructor
*/
const AlgoliaJobReport = function(jobID, jobType) {

    this.jobID = jobID;
    this.jobType = jobType;

    this.startTime;
    this.endTime;

    this.processedItems = 0;
    this.processedItemsToSend = 0;
    this.siteLocales = 0;
    this.recordsToSend = 0;
    this.recordsSent = 0;
    this.recordsFailed = 0;
    this.chunksSent = 0;
    this.chunksFailed = 0;

    this.error = false;
    this.errorMessage = '';
}

AlgoliaJobReport.prototype.writeToCustomObject = function() {
    const CustomObjectMgr = require('dw/object/CustomObjectMgr');
    const Transaction = require('dw/system/Transaction');
    const StringUtils = require('dw/util/StringUtils');

    const customObjectID = this.jobID + '__' + StringUtils.formatCalendar(System.getCalendar(), 'yyMMdd-HHmmss'); // returns GMT time

    let that = this; // context changes inside Transaction.wrap()

    try {
        Transaction.wrap(function() {
            const algoliaJobReportCO = CustomObjectMgr.createCustomObject('AlgoliaJobReport', customObjectID);

            algoliaJobReportCO.custom.jobID = that.jobID;
            algoliaJobReportCO.custom.jobType = that.jobType;

            algoliaJobReportCO.custom.startTime = empty(that.startTime) ? null : that.startTime;
            algoliaJobReportCO.custom.endTime = empty(that.endTime) ? null : that.endTime;

            algoliaJobReportCO.custom.processedItems = that.processedItems;
            algoliaJobReportCO.custom.processedItemsToSend = that.processedItemsToSend;
            algoliaJobReportCO.custom.siteLocales = that.siteLocales;

            algoliaJobReportCO.custom.recordsToSend = that.recordsToSend;
            algoliaJobReportCO.custom.recordsSent = that.recordsSent;
            algoliaJobReportCO.custom.recordsFailed = that.recordsFailed;
            algoliaJobReportCO.custom.chunksSent = that.chunksSent;
            algoliaJobReportCO.custom.chunksFailed = that.chunksFailed;

            algoliaJobReportCO.custom.error = that.error;
            algoliaJobReportCO.custom.errorMessage = that.errorMessage;


        });
    } catch (e) {
        require('dw/system/Logger').getLogger('algolia', 'Algolia').error('Failed to write AlgoliaJobReport to custom object: ' + e.message);
        return false;
    }

    return true;
}

AlgoliaJobReport.prototype.formatCustomObject = function(customObject) {
    const StringUtils = require('dw/util/StringUtils');
    const Calendar = require('dw/util/Calendar');

    const timeZone = System.getInstanceTimeZone();

    this.jobID = customObject.custom.jobID;
    this.jobType = customObject.custom.jobType;

    let startTime = new Calendar(customObject.custom.startTime);
    startTime.setTimeZone(timeZone);
    this.startTime = StringUtils.formatCalendar(startTime);

    let endTime = new Calendar(customObject.custom.endTime);
    endTime.setTimeZone(timeZone);
    this.endTime = StringUtils.formatCalendar(endTime);

    this.processedItems = customObject.custom.processedItems.toFixed();
    this.processedItemsToSend = customObject.custom.processedItemsToSend.toFixed();
    this.siteLocales = customObject.custom.siteLocales.toFixed();
    this.recordsToSend = customObject.custom.recordsToSend.toFixed();
    this.recordsSent = customObject.custom.recordsSent.toFixed();
    this.recordsFailed = customObject.custom.recordsFailed.toFixed();
    this.chunksSent = customObject.custom.chunksSent.toFixed();
    this.chunksFailed = customObject.custom.chunksFailed.toFixed();

    this.error = customObject.custom.error || false;
    this.errorMessage = customObject.custom.errorMessage;

    return this;
}

module.exports = AlgoliaJobReport;
