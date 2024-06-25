'use strict';

/* Script Modules */
var ISML = require('dw/template/ISML');
var URLUtils = require('dw/web/URLUtils');
var Logger = require('dw/system/Logger');
var Resource = require('dw/web/Resource');

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaExportAPI = require('*/cartridge/scripts/algoliaExportAPI');

/**
 * @description Render default template
 * @returns {void} ISML.renderTemplate
 */
function start() {
    const BMHelper = require('../scripts/helper/BMHelper');

    var pdictValues = {
        setttingsUpdateUrl: URLUtils.https('AlgoliaBM-HandleSettings'),
        algoliaData: algoliaData,
        latestReports: BMHelper.getLatestCOReportsByJob(),
    };

    ISML.renderTemplate('algoliabm/dashboard/index', pdictValues);
}

/**
 * @description Handle form for settings
 */
function handleSettings() {
    var params = request.httpParameterMap;
    try {
        var algoliaEnable = ('Enable' in params) && (params.Enable.submitted === true);
        var algoliaEnableContentSearch = ('EnableContentSearch' in params) && (params.EnableContentSearch.submitted === true);
        var algoliaEnableRecommend = ('EnableRecommend' in params) && (params.EnableRecommend.submitted === true);
        algoliaData.setPreference('Enable', algoliaEnable);
        algoliaData.setPreference('ApplicationID', params.ApplicationID.value);
        algoliaData.setSetOfStrings('AdditionalAttributes', params.AdditionalAttributes.value);
        algoliaData.setPreference('InStockThreshold', params.InStockThreshold.value * 1);
        algoliaData.setPreference('SearchApiKey', params.SearchApiKey.value);
        algoliaData.setPreference('AdminApiKey', params.AdminApiKey.value);
        algoliaData.setPreference('IndexPrefix', params.IndexPrefix.value);
        algoliaData.setPreference('RecordModel', params.RecordModel.value);
        algoliaData.setSetOfStrings('LocalesForIndexing', params.LocalesForIndexing.value);
        algoliaData.setPreference('EnableInsights', params.EnableInsights.submitted);
        algoliaData.setPreference('EnableSSR', params.EnableSSR.submitted);
        algoliaData.setPreference('EnableContentSearch', algoliaEnableContentSearch);
        algoliaData.setPreference('EnableRecommend', algoliaEnableRecommend);
    } catch (error) {
        Logger.error(error);
    }

    start();
}

/**
 * @description Handles indexing requests depending on the request type (get indexing status/clean queue/resume indexing)
 */
function indexing() {
    var requestType = request.httpParameterMap.requestType.stringValue;
    var responseData = {};
    var status = algoliaExportAPI.makeIndexingRequest(requestType);

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
