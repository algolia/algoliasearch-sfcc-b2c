'use strict';

/* Script Modules */
var ISML = require('dw/template/ISML');
var URLUtils = require('dw/web/URLUtils');
var Logger = require('dw/system/Logger');
var Resource = require('dw/web/Resource');

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaExportAPI = require('*/cartridge/scripts/algoliaExportAPI');
var algoliaIndexingService = require('*/cartridge/scripts/services/algoliaIndexingService');
const BMHelper = require('../scripts/helper/BMHelper');
var algoliaServiceHelper = require('*/cartridge/scripts/services/algoliaServiceHelper');

/**
 * @description Render default template
 * @returns {void} ISML.renderTemplate
 */
function start() {
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
    var applicationID = params.ApplicationID.value;
    var adminApikey = params.AdminApiKey.value || '';
    var searchApikey = params.SearchApiKey.value || '';
    var indexPrefix = params.IndexPrefix.value || '';

    var adminValidation = {};
    var searchValidation = {};

    var currentIndexPrefix = algoliaData.getPreference('IndexPrefix');
    var isIndexPrefixChanged = currentIndexPrefix !== indexPrefix;

    try {
        var algoliaEnable = ('Enable' in params) && (params.Enable.submitted === true);
        var algoliaEnableContentSearch = ('EnableContentSearch' in params) && (params.EnableContentSearch.submitted === true);
        var algoliaEnableRecommend = ('EnableRecommend' in params) && (params.EnableRecommend.submitted === true);
        var algoliaEnablePricingLazyLoad = ('EnablePricingLazyLoad' in params) && (params.EnablePricingLazyLoad.submitted === true);

        // 1) Validate Admin API key - If user left admin key blank and prefix didn't change, skip check.
        if (adminApikey || isIndexPrefixChanged) {
            var serviceAdmin = algoliaIndexingService.getService({
                jobID: 'API_KEY_VALIDATION_ADMIN',
                stepID: 'validatePermissions',
                applicationID: applicationID,
                adminApikey: adminApikey
            });

            adminValidation = algoliaServiceHelper.validateAPIKey(
                serviceAdmin,
                applicationID,
                adminApikey,
                indexPrefix,
                true                  // isAdminKey
            );

            if (adminValidation.error) {
                showDashboardWithMessages(adminValidation, searchValidation);
                return;
            }
        }

        // 2) Validate Search API key (must have 'search' ACL). If user left search key blank and prefix didn't change, skip check.
        if (searchApikey || isIndexPrefixChanged) {
            var serviceSearch = algoliaIndexingService.getService({
                jobID: 'API_KEY_VALIDATION_SEARCH',
                stepID: 'validatePermissions',
                applicationID: applicationID,
                adminApikey: searchApikey
            });

            searchValidation = algoliaServiceHelper.validateAPIKey(
                serviceSearch,
                applicationID,
                searchApikey,
                indexPrefix,
                false                 // isAdminKey = false
            );

            if (searchValidation.error) {
                showDashboardWithMessages(adminValidation, searchValidation);
                return;
            }
        }

        // If we get here, both checks are fine or not applicable. Save settings.

        algoliaData.setPreference('Enable', algoliaEnable);
        algoliaData.setPreference('ApplicationID', applicationID);
        algoliaData.setSetOfStrings('AdditionalAttributes', params.AdditionalAttributes.value);
        algoliaData.setPreference('InStockThreshold', params.InStockThreshold.value * 1);
        algoliaData.setPreference('SearchApiKey', searchApikey);
        algoliaData.setPreference('AdminApiKey', adminApikey);
        algoliaData.setPreference('IndexPrefix', indexPrefix);
        algoliaData.setPreference('RecordModel', params.RecordModel.value);
        algoliaData.setSetOfStrings('LocalesForIndexing', params.LocalesForIndexing.value);
        algoliaData.setPreference('EnableInsights', params.EnableInsights.submitted);
        algoliaData.setPreference('EnableSSR', params.EnableSSR.submitted);
        algoliaData.setPreference('EnableContentSearch', algoliaEnableContentSearch);
        algoliaData.setPreference('EnableRecommend', algoliaEnableRecommend);
        algoliaData.setPreference('EnablePricingLazyLoad', algoliaEnablePricingLazyLoad);

    } catch (error) {
        Logger.error(error);
        showDashboardWithMessages(adminValidation, searchValidation, error.message);
        return;
    }

    if (adminValidation.error || searchValidation.error) {
        showDashboardWithMessages(adminValidation, searchValidation, '');
        return;
    }

    if (adminValidation.warning || searchValidation.warning) {
        showDashboardWithMessages(adminValidation, searchValidation, '');
    } else {
        // Pure success scenario
        start();
    }
}

/**
 * Helper to re-render the dashboard with an error message
 * @param {Object} adminValidation   admin key check results
 * @param {Object} searchValidation  search key check results
 * @param {string} errorMessage      optional error message
 */
function showDashboardWithMessages(adminValidation, searchValidation, errorMessage) {
    ISML.renderTemplate('algoliabm/dashboard/index', {
        setttingsUpdateUrl: URLUtils.https('AlgoliaBM-HandleSettings'),
        algoliaData: algoliaData,
        latestReports: BMHelper.getLatestCOReportsByJob(),
        adminErrorMessage: adminValidation.errorMessage,
        adminWarningMessage: adminValidation.warning,
        searchErrorMessage: searchValidation.errorMessage,
        searchWarningMessage: searchValidation.warning,
        errorMessage: errorMessage
    });
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
