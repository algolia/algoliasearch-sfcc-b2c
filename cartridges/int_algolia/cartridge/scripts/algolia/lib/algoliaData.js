'use strict';

var currentSite = require('dw/system/Site').getCurrent();
var Transaction = require('dw/system/Transaction');
var dwSystem = require('dw/system/System');

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

module.exports = {
    getPreference: getPreference,
    setPreference: setPreference,
    getSetOfStrings: getSetOfStrings,
    setSetOfStrings: setSetOfStrings,
    getInstanceHostName: getInstanceHostName,
    calculateIndexId: calculateIndexId
};
