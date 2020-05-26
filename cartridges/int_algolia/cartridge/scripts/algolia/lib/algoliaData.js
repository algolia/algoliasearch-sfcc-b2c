'use strict';

var currentSite = require('dw/system/Site').getCurrent();
var Transaction = require('dw/system/Transaction');
var dwSystem = require('dw/system/System');

var logHelper = require('int_algolia/cartridge/scripts/algolia/helper/logHelper');

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
 *   SearchApiKey           | Authorization key for Algolia                     | String
 *   AdminApiKey            | Authorization Admin key for Algolia               | String
 *   OCAPIClientID          | Authorization OCAPI SFCC Client ID                | String
 *   OCAPIClientPassword    | Authorization OCAPI SFCC Client passwrd           | String
 * -------------------------------------------------------------------------------------------------
 * Preferences stored in the XML file
 *   id                     | Description                                             |type of preference
 *   -----------------------------------------------------------------------------------------------
 *   LastCategorySyncDate   | Date of the last Category index sync job run (read only)| String
 *   LastProductSyncDate    | Date of the last product index sync job run (read only) | String
 *   LastProductSyncLog     | Last product sync job log                               | String
 *   LastCategorySyncLog    | Last category sync job log                              | String
 * -------------------------------------------------------------------------------------------------
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
function getSetOfArray(id) {
    var values = currentSite.getCustomPreferenceValue('Algolia_' + id);
    return values.length ? values.map(function (element) { return element; }) : [];
}

/**
 * @description Getting preference (as set of strings) for Algolia
 * @param {string} id - name of preference
 * @returns {string} - value of preference
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
 * @description Get category and product log data from log file for current Site
 * @param {string} id - name of preference [LastProductSyncLog, LastCategorySyncLog]
 * @returns {Object} - log data
 */
function getLogData(id) {
    var productLog = null;
    if (id === 'LastCategorySyncLog') productLog = logHelper.getLogData('category');
    else if (id === 'LastProductSyncLog') productLog = logHelper.getLogData('product');
    return productLog;
}

/**
 * @description Save product and category log data to file for current Site
 * @param {string} id - name of preference [LastProductSyncLog, LastCategorySyncLog]
 * @param {Object} productLog - ploduct log Object
 * @returns {bullean} - Log data write success
 */
function setLogData(id, productLog) {
    var result = false;
    if (id === 'LastCategorySyncLog') result = logHelper.setLogData('category', productLog);
    else if (id === 'LastProductSyncLog') result = logHelper.setLogData('product', productLog);
    return result;
}

/**
 * @description Get category and product log data from log file for all Sites
 * @returns {Array} - array of Sites log data
 */
function getLogDataAllSites() {
    return logHelper.getLogDataAllSites();
}

/**
 * Get instance hostname replacing dots with dashes and skipping
 * the general parts from the sandbox hostnames.
 * @returns {string} hostname
 */
function getInstanceHostName() {
    var instanceHostname = dwSystem.getInstanceHostname();

    // remove the sandbox host
    if (dwSystem.instanceType === dwSystem.DEVELOPMENT_SYSTEM) {
        instanceHostname = instanceHostname.replace('.commercecloud.salesforce.com', '');
        instanceHostname = instanceHostname.replace('.demandware.net', '');
    }
    // replace dots
    return instanceHostname.replace(/[\.|-]/g, '_'); /* eslint-disable-line */
}

/**
 * Create index id for search results request
 * @param {string} type - type of indices: products | categories
 * @returns {string} indexId
 */
function calculateIndexId(type) {
    return getInstanceHostName() + '__' + currentSite.getID() + '__' + type + '__' + request.getLocale();
}

/**
 * @description Convert Date to local DateTime format string
 * @param {Date} date - Date
 * @returns {string} - local formated DateTime
 */
function getLocalDateTime(date) {
    return empty(date) ? '---' : date.toLocaleDateString() + ' | ' + date.toLocaleTimeString();
}

/**
 * @description Get Date preference to local DateTime format string
 * @param {string} id - name of Date preference [LastCategorySyncDate, LastProductSyncDate]
 * @returns {string} - local formated DateTime
 */
function getSyncLocalDateTime(id) {
    var productLog = null;
    if (id === 'LastCategorySyncDate') productLog = logHelper.getLogData('category');
    else if (id === 'LastProductSyncDate') productLog = logHelper.getLogData('product');
    return empty(productLog) ? '---' : productLog.sendDate;
}

module.exports = {
    getPreference: getPreference,
    setPreference: setPreference,
    getSetOfArray: getSetOfArray,
    getSetOfStrings: getSetOfStrings,
    setSetOfStrings: setSetOfStrings,
    getLogData: getLogData,
    setLogData: setLogData,
    getLogDataAllSites: getLogDataAllSites,
    getInstanceHostName: getInstanceHostName,
    calculateIndexId: calculateIndexId,
    getLocalDateTime: getLocalDateTime,
    getSyncLocalDateTime: getSyncLocalDateTime
};
