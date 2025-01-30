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
    var algoliaEnableRecommend = ('EnableRecommend' in params) && (params.EnableRecommend.submitted === true);
    var algoliaEnableContentSearch = ('EnableContentSearch' in params) && (params.EnableContentSearch.submitted === true);

    var localesInput = params.LocalesForIndexing.value || 'default';
    var locales = algoliaData.csvStringToArray(localesInput, ',');
    var adminValidation = {};
    var searchValidation = {};

    try {
        // 1) Validate Admin API key - If user left search key blank, skip the check. 
        if (adminApikey) {
            var serviceAdmin = algoliaIndexingService.getService({
                jobID: 'API_KEY_VALIDATION_ADMIN',
                stepID: 'validatePermissions',
                applicationID: applicationID,
                adminApikey: adminApikey
            });

            adminValidation = algoliaServiceHelper.validateAPIKey(serviceAdmin,
                applicationID,
                adminApikey,
                indexPrefix,
                locales,
                true,
                algoliaEnableRecommend,
                algoliaEnableContentSearch
            );

            if (adminValidation.error) {
                showDashboardWithMessages(adminValidation, searchValidation);
                return;
            }
        }

        // 2) Validate Search API key (must have 'search' ACL). If user left search key blank, skip the check. 
        if (searchApikey) {
            var serviceSearch = algoliaIndexingService.getService({
                jobID: 'API_KEY_VALIDATION_SEARCH',
                stepID: 'validatePermissions',
                applicationID: applicationID,
                adminApikey: searchApikey
            });

            searchValidation = algoliaServiceHelper.validateAPIKey(serviceSearch,
                applicationID,
                searchApikey,
                indexPrefix,
                locales,
                false,
                algoliaEnableRecommend,
                algoliaEnableContentSearch
            );

            if (searchValidation.error) {
                showDashboardWithMessages(adminValidation, searchValidation);
                return;
            }
        }

        // If we get here, both checks are fine or not applicable. Save settings.
        var algoliaEnable = ('Enable' in params) && (params.Enable.submitted === true);
        var algoliaEnablePricingLazyLoad = ('EnablePricingLazyLoad' in params) && (params.EnablePricingLazyLoad.submitted === true);

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
 * @param {string} errorMessage - The error message to display
 * @param {string} warningMessage - Any associated warning
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
