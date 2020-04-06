'use strict';

var currentSite = require('dw/system/Site').getCurrent();

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
 *   SearchApiKeyLimit      | Authorization key for Algolia                     | String
 */   -----------------------------------------------------------------------------------------------
 //   Example:
 //    var siftPref = require('*/cartridge/scripts/algolia/lib/algoliaData');
 //    siftPref('Enable');
 //   -----------------------------------------------------------------------------------------------
 

/**
 * @description Getting preferences for Algolia
 * @param {string} id - name of preference
 * @returns {*} - value of preference
 */
function getPreference(id) {
	var value = currentSite.getCustomPreferenceValue('Algolia_' + id);
	if (value !== null) {
		return value;
	}
    return false;
}

module.exports = getPreference;