'use strict';

/* Script Modules */
var ISML = require('dw/template/ISML');
var URLUtils = require('dw/web/URLUtils');
var Logger = require('dw/system/Logger');
var Resource = require('dw/web/Resource');

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaApi = require('*/cartridge/scripts/algoliaApi');

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
        algoliaData.setPreference('IndexPrefix', params.IndexPrefix.value);
        algoliaData.setPreference('OCAPIClientID', params.OCAPIClientID.value);
        algoliaData.setPreference('OCAPIClientPassword', params.OCAPIClientPassword.value);
    } catch (error) {
        Logger.error(error);
    }

    renderIndex();
}

/**
 * @description Handles indexing requests depending on the request type (get indexing status/clean queue/resume indexing)
 */
function indexing() {
    var requestType = request.httpParameterMap.requestType.stringValue;
    var responseData = {};
    var status = algoliaApi.makeIndexingRequest(requestType);

    if (status.error) {
        responseData.errorMessage = status.details.errorMessage ? status.details.errorMessage : Resource.msg('algolia.error.service', 'algolia', null);
    } else {
        responseData = status.details.object.body;
    }

    response.setContentType('application/json'); // eslint-disable-line no-undef
    response.writer.print(JSON.stringify(responseData)); // eslint-disable-line no-undef
}

exports.Start = start;
exports.Start.public = true;
exports.HandleSettings = handleSettings;
exports.HandleSettings.public = true;
exports.Indexing = indexing;
exports.Indexing.public = true;
