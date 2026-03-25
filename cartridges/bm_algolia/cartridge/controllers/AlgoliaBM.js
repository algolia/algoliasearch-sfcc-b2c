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
    renderDashboard(getDashboardPdict());
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
    var algoliaAttributeSlicedRecordModel_GroupingAttribute = params.AttributeSlicedRecordModel_GroupingAttribute.value || '';
    var indexingAPI = params.IndexingAPI.value || 'search-api';
    var analyticsRegion = (params.AnalyticsRegion.value || '').trim().toLowerCase();

    var adminValidation = {};
    var pdictValues = getDashboardPdict();

    try {
        var algoliaEnable = ('Enable' in params) && (params.Enable.submitted === true);
        var algoliaEnableContentSearch = ('EnableContentSearch' in params) && (params.EnableContentSearch.submitted === true);
        var algoliaEnableRecommend = ('EnableRecommend' in params) && (params.EnableRecommend.submitted === true);
        var algoliaEnablePricingLazyLoad = ('EnablePricingLazyLoad' in params) && (params.EnablePricingLazyLoad.submitted === true);
        var algoliaEnableRealTimeInventoryHook = ('EnableRealTimeInventoryHook' in params) && (params.EnableRealTimeInventoryHook.submitted === true);

        // If the user typed an empty prefix, the cartridge logic eventually
        // uses the default <hostname>__<siteID>
        var typedPrefix = indexPrefix.trim();
        var finalIndexPrefix = typedPrefix || algoliaData.getDefaultIndexPrefix();

        // 1) Validate indexing key
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
            finalIndexPrefix
        );

        // validate AdminApiKey
        if (adminValidation.error) {
            pdictValues.errors.adminErrorMessage = adminValidation.errorMessage;
            pdictValues.errors.adminWarningMessage = adminValidation.warning || '';
        }

        if (adminValidation.warning) {
            pdictValues.errors.adminWarningMessage = adminValidation.warning;
        }

        // validate AnalyticsRegion (empty allowed so that it doesn't force a value for initial setup; non-empty must be eu or us)
        if (analyticsRegion && analyticsRegion !== 'eu' && analyticsRegion !== 'us') {
            pdictValues.errors.analyticsRegionErrorMessage = Resource.msg('algolia.error.analyticsregion.invalid', 'algolia', null);
        }

        // if any of the errors are set, render the dashboard with the errors before saving the preferences
        let errorKeys = Object.keys(pdictValues.errors);
        for (let i = 0; i < errorKeys.length; i++) {
            let errorKey = errorKeys[i];
            if (!empty(pdictValues.errors[errorKey])) {
                return renderDashboard(pdictValues);
            }
        }

        // If we get here, the check is fine or not applicable. Save settings:
        algoliaData.setPreference('Enable', algoliaEnable);
        algoliaData.setPreference('ApplicationID', applicationID);
        algoliaData.setSetOfStrings('AdditionalAttributes', params.AdditionalAttributes.value);
        algoliaData.setPreference('InStockThreshold', params.InStockThreshold.value * 1);
        algoliaData.setPreference('SearchApiKey', searchApikey);
        algoliaData.setPreference('AdminApiKey', adminApikey);
        algoliaData.setPreference('IndexPrefix', indexPrefix);
        algoliaData.setPreference('RecordModel', params.RecordModel.value);
        algoliaData.setPreference('AttributeSlicedRecordModel_GroupingAttribute', algoliaAttributeSlicedRecordModel_GroupingAttribute);
        algoliaData.setPreference('IndexingAPI', indexingAPI);
        algoliaData.setPreference('AnalyticsRegion', analyticsRegion);
        algoliaData.setSetOfStrings('LocalesForIndexing', params.LocalesForIndexing.value);
        algoliaData.setPreference('EnableInsights', params.EnableInsights.submitted);
        algoliaData.setPreference('EnableSSR', params.EnableSSR.submitted);
        algoliaData.setPreference('EnableContentSearch', algoliaEnableContentSearch);
        algoliaData.setPreference('EnableRecommend', algoliaEnableRecommend);
        algoliaData.setPreference('EnablePricingLazyLoad', algoliaEnablePricingLazyLoad);
        algoliaData.setPreference('IndexOutOfStock', params.IndexOutOfStock.submitted);
        algoliaData.setPreference('EnableRealTimeInventoryHook', algoliaEnableRealTimeInventoryHook);
    } catch (error) {
        Logger.error(error);
        pdictValues.errors.errorMessage = error.message;
        return renderDashboard(pdictValues);
    }

    renderDashboard(pdictValues);
}

/**
 * @description Render dashboard ISML (refreshes latestReports so data is current at render time).
 * @param {Object} pdictValues pdict to be passed to the template
 * @returns {void}
 */
function renderDashboard(pdictValues) {
    pdictValues.latestReports = BMHelper.getLatestCOReportsByJob();
    ISML.renderTemplate('algoliabm/dashboard/index', pdictValues);
}

/**
 * @description Fresh dashboard pdict per call (empty errors); set pdictValues.errors.* when needed.
 * latestReports is assigned in renderDashboard immediately before the template runs since it shouldn't be cached.
 * @returns {Object} pdict for index.isml
 */
function getDashboardPdict() {
    return {
        setttingsUpdateUrl: URLUtils.https('AlgoliaBM-HandleSettings'),
        algoliaData: algoliaData,
        errors: {
            adminErrorMessage: '',
            adminWarningMessage: '',
            analyticsRegionErrorMessage: '',
            errorMessage: ''
        }
    };
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
