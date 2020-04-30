'use strict';

var currentSite = require('dw/system/Site').getCurrent();
var Transaction = require('dw/system/Transaction');

/**
 * Log Data Object
 */
function LogJob() {
    var date = new Date();
    this.processedDate = date.toISOString();
    this.processedError = false;
    this.processedErrorMessage = '';
    this.processedRecords = 0;
    this.processedToUpdateRecords = 0;
    this.sendDate = date.toISOString();
    this.sendError = false;
    this.sendErrorMessage = '';
    this.sendedChunk = 0;
    this.sendedRecords = 0;
    this.failedChunk = 0;
    this.failedRecords = 0;
}

/*
 * Function for getting preferences for Algolia
 *
 *   id                     | Description                                       |type of preference
 *   -----------------------------------------------------------------------------------------------
 *   ApplicationID          | Identifies the application for this site          | String
 *   CustomFields           | Any additional attributes of Product Object       | Set-of-string
 *   Enable                 | Enable/disable all Algolia                        | Boolean
 *   HostBase               | Host for read operations                          | String
 *   InStockThreshold       | Stock Threshold                                   | Double
 *   LastCategorySyncDate   | Timestamp of the last Category index sync job run | Datetime
 *   LastProductSyncDate    | Timestamp of the last product index sync job run  | Datetime
 *   SearchApiKey           | Authorization key for Algolia                     | String
 *   AdminApiKey            | Authorization Admin key for Algolia               | String
 *   LastProductSyncLog     | Last product sync job log                         | String
 *   LastCategorySyncLog    | Last category sync job log                        | String
 * -----------------------------------------------------------------------------------------------
 */
//   Example:
//    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
//    algoliaData.getPreference('Enable');
//    algoliaData.setPreference('Enable', true);
//   -----------------------------------------------------------------------------------------------

/**
 * @description Getting preference for Algolia
 * @param {string} id - name of preference
 * @returns {*} - value of preference
 */
function getPreference(id) {
    return currentSite.getCustomPreferenceValue('Algolia_' + id);
}

/**
 * @description Set preference for Algolia
 * @param {string} id - name of preference
 * @param {string} value - value to save
 * @returns {void}
 */
function setPreference(id, value) {
    Transaction.wrap(function () {
        currentSite.setCustomPreferenceValue('Algolia_' + id, value);
    });
}

/**
 * @description Getting preference (as set of strings) for Algolia
 * @param {string} id - name of preference
 * @returns {array} - value of preference
 */
function getSetOfStrings(id) {
    var values = currentSite.getCustomPreferenceValue('Algolia_' + id);
    return values.length ? values.join() : ', ';
}

/**
 * @description Set preference (as set of strings) for Algolia
 * @param {string} id - name of preference
 * @param {string} value - value to save
 * @returns {void}
 */
function setSetOfStrings(id, value) {
    Transaction.wrap(function () {
        var toSave = value.replace(/ /g, ''); // remove white spaces
        toSave = toSave.split(','); // create array
        currentSite.setCustomPreferenceValue('Algolia_' + id, toSave);
    });
}

/**
 * @description Get product log data from preference
 * @param {string} id - name of preference [LastProductSyncLog, LastCategorySyncLog]
 * @returns {Object} - log data
 */
function getLogData(id) {
    var productLogAsString = getPreference(id);
    var productLog = new LogJob();

    if (!empty(productLogAsString)) {
        try {
            productLog = JSON.parse(productLogAsString);
        } catch (error) {
            productLog = new LogJob();
        }
    }
    return productLog;
}

/**
 * @description Set product log data from preference
 * @param {string} id - name of preference [LastProductSyncLog, LastCategorySyncLog]
 * @param {Object} productLog - ploduct log Object
 * @returns {null} - log data
 */
function setLogData(id, productLog) {
    var productLogAsString;
    try {
        productLogAsString = JSON.stringify(productLog);
    } catch (error) {
        productLogAsString = JSON.stringify(new LogJob());
    }
    setPreference(id, productLogAsString);
    return null;
}

module.exports = {
    getPreference: getPreference,
    setPreference: setPreference,
    getSetOfStrings: getSetOfStrings,
    setSetOfStrings: setSetOfStrings,
    getLogData: getLogData,
    setLogData: setLogData
};
