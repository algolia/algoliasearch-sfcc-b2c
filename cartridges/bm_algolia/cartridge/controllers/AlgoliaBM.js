'use strict';

/* Script Modules */
var ISML = require('dw/template/ISML');
var URLUtils = require('dw/web/URLUtils');
var Logger = require('dw/system/Logger');

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

/**
 * @description Render default template
 * @returns {void} - ISML.renderTemplate
 */
function renderIndex() {
    var pdictValues = {
        setttingsUpdateUrl: URLUtils.https('AlgoliaBM-HandleSettings'),
        algoliaData: algoliaData
    };

    ISML.renderTemplate('algoliabm/dashboard/index', pdictValues);
}

/**
 * @description Main pipelet
 * @returns {void} - renderIndex
 */
function start() {
    renderIndex();
}

/**
 * @description Handle form for settings
 * @returns {void} - renderIndex
 */
function handleSettings() {
    var params = request.httpParameterMap;
    try {
        var algoliaEnable = ('Enable' in params) && (params.Enable.submitted === true);
        algoliaData.setPreference('Enable', algoliaEnable);
        algoliaData.setPreference('ApplicationID', params.ApplicationID.value);
        algoliaData.setSetOfStrings('CustomFields', params.CustomFields.value);
        algoliaData.setPreference('HostBase', params.HostBase.value);
        algoliaData.setPreference('InStockThreshold', params.InStockThreshold.value * 1);
        algoliaData.setPreference('SearchApiKey', params.SearchApiKey.value);
        algoliaData.setPreference('AdminApiKey', params.AdminApiKey.value);
        algoliaData.setPreference('OCAPIClientID', params.OCAPIClientID.value);
        algoliaData.setPreference('OCAPIClientPassword', params.OCAPIClientPassword.value);
    } catch (error) {
        Logger.error(error);
    }

    renderIndex();
}

exports.Start = start;
exports.Start.public = true;
exports.HandleSettings = handleSettings;
exports.HandleSettings.public = true;