'use strict';

/* Script Modules */
var ISML = require('dw/template/ISML');
var URLUtils = require('dw/web/URLUtils');
var Logger = require('dw/system/Logger');
var Resource = require('dw/web/Resource');

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaExportAPI = require('*/cartridge/scripts/algoliaExportAPI');
var algoliaIngestionAPI = require('*/cartridge/scripts/algoliaIngestionAPI');

/**
 * @description Render default template
 * @param {string} error - the error to render on the Settings page
 * @returns {void} ISML.renderTemplate
 */
function renderIndex(error) {
    var pdictValues = {
        setttingsUpdateUrl: URLUtils.https('AlgoliaBM-HandleSettings'),
        algoliaData: algoliaData,
        error: error
    };

    ISML.renderTemplate('algoliabm/dashboard/index', pdictValues);
}

/**
 * @description Main pipelet
 * @returns {void} renderIndex
 */
function start() {
    renderIndex();
}

/**
 * @description Handle form for settings
 * @returns {void} renderIndex
 */
function handleSettings() {
    var params = request.httpParameterMap;
    try {
        var algoliaEnable = ('Enable' in params) && (params.Enable.submitted === true);
        var formerAppId = algoliaData.getPreference('ApplicationID');
        var formerAdminApiKey = algoliaData.getPreference('AdminApiKey');
        var appId = params.ApplicationID.value;
        var adminApiKey = params.AdminApiKey.value;

        algoliaData.setPreference('ApplicationID', appId);
        algoliaData.setPreference('AdminApiKey', adminApiKey);

        try {
            updateIngestionConfig(appId, adminApiKey);
        } catch (e) {
            Logger.error('Error when saving Algolia preferences: ' + e);
            algoliaData.setPreference('ApplicationID', formerAppId);
            algoliaData.setPreference('AdminApiKey', formerAdminApiKey);
            renderIndex(e.message);
            return;
        }

        algoliaData.setPreference('Enable', algoliaEnable);
        algoliaData.setPreference('ApplicationID', appId);
        algoliaData.setSetOfStrings('CustomFields', params.CustomFields.value);
        algoliaData.setPreference('HostBase', params.HostBase.value);
        algoliaData.setPreference('InStockThreshold', params.InStockThreshold.value * 1);
        algoliaData.setPreference('SearchApiKey', params.SearchApiKey.value);
        algoliaData.setPreference('AdminApiKey', adminApiKey);
        algoliaData.setPreference('IndexPrefix', params.IndexPrefix.value);
        algoliaData.setPreference('EnableSSR', params.EnableSSR.submitted);
        algoliaData.setPreference('OCAPIClientID', params.OCAPIClientID.value);
        algoliaData.setPreference('OCAPIClientPassword', params.OCAPIClientPassword.value);
    } catch (error) {
        Logger.error('Error when saving Algolia preferences: ' + error);
    }

    renderIndex();
}

/**
 * Registers or updates the Ingestion objects needed by the Ingestion API,
 * and save them as stringified JSON in the Indexing_Config custom parameter.
 * @param {string} appId - Algolia AppID
 * @param {string} adminApiKey - Algolia Admin API Key
 */
function updateIngestionConfig(appId, adminApiKey) {
    var currentSite = algoliaData.getCurrentSite();
    Logger.info("Registering indexing configuration... AppID=" + appId);
    var indexingConfig = JSON.parse(algoliaData.getPreference("Indexing_Config")) || {
        locales: {}
    };
    var sourceID = indexingConfig.sourceID;
    if (!sourceID) {
        Logger.info('No source found. Registering one...');
        sourceID = algoliaIngestionAPI.registerSource('Source of SFCC site ' + currentSite.getName(), currentSite.getID());
        Logger.info('Source registered. SourceID: ' + sourceID);
        indexingConfig.sourceID = sourceID;
    } else {
        Logger.debug('Source already registered: ' + sourceID);
    }

    var authenticationID = indexingConfig.authenticationID;
    if (!authenticationID) {
        Logger.info('No authentication found. Registering one...');
        authenticationID = algoliaIngestionAPI.registerAuthentication({
            name: 'Authentication of SFCC site: ' + currentSite.getID(),
            appId: appId,
            apiKey: adminApiKey
        });
        Logger.info('Authentication registered. AuthenticationID: ' + authenticationID);
        indexingConfig.authenticationID = authenticationID;
    } else {
        Logger.info('Authentication already registered: ' + authenticationID + '. Updating...');
        algoliaIngestionAPI.updateAuthentication(authenticationID, {
            name: 'Authentication of SFCC site: ' + currentSite.getName(),
            appId: appId,
            apiKey: adminApiKey
        });
    }

    var siteLocales = currentSite.getAllowedLocales().toArray();
    for (var i = 0; i < siteLocales.length; ++i) {
        if (!indexingConfig.locales) {
            indexingConfig.locales = {};
        }
        var locale = siteLocales[i];
        var localeConfig = indexingConfig.locales[locale] || {};
        var destinationID = localeConfig.destinationID;
        if (!destinationID) {
            Logger.info('Registering destination for locale: "' + locale + '"...');
            destinationID = algoliaIngestionAPI.registerDestination({
                name: currentSite.getID() + '_' + locale,
                indexName: currentSite.getID() + '_products_' + locale,
                authenticationID: authenticationID
            });
            Logger.info('Destination registered for locale "' + locale + '". DestinationID: ' + destinationID);
            localeConfig.destinationID = destinationID;
        } else {
            Logger.info('Destination already exists for "' + locale + '": ' + destinationID);
            algoliaIngestionAPI.updateDestination(destinationID, {
                name: currentSite.getID() + '_' + locale,
                indexName: currentSite.getID() + '_products_' + locale,
                authenticationID: authenticationID
            });
        }

        var tasks = localeConfig.tasks || {};
        if (!tasks.replace) {
            Logger.info('Registering "replace" task for locale: "' + locale + '"...');
            tasks.replace = algoliaIngestionAPI.registerTask({
                sourceID: sourceID,
                destinationID: destinationID,
                action: 'replace'
            });
            Logger.info('"replace" task created for locale "' + locale + '": ' + tasks.replace);
        }
        localeConfig.tasks = tasks;

        indexingConfig.locales[locale] = localeConfig;
    }

    algoliaData.setPreference('Indexing_Config', JSON.stringify(indexingConfig));
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
