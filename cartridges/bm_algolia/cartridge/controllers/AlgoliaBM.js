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
        var algoliaEnableDI = ('EnableDI' in params) && (params.EnableDI.submitted === true);
        var formerAppId = algoliaData.getPreference('ApplicationID');
        var formerAdminApiKey = algoliaData.getPreference('AdminApiKey');
        var appId = params.ApplicationID.value;
        var adminApiKey = params.AdminApiKey.value;

        algoliaData.setPreference('ApplicationID', appId);
        algoliaData.setPreference('AdminApiKey', adminApiKey);

        try {
            if (algoliaEnableDI) {
                updateIngestionConfig(appId, adminApiKey);
            }
        } catch (e) {
            Logger.error('Error when updating Ingestion config: ' + e);
            algoliaData.setPreference('ApplicationID', formerAppId);
            algoliaData.setPreference('AdminApiKey', formerAdminApiKey);
            renderIndex(e.message);
            return;
        }

        algoliaData.setPreference('Enable', algoliaEnable);
        algoliaData.setPreference('EnableDI', algoliaEnableDI);
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
 * The stored config has the following format:
 * {
 *   "sourceID": "f0b9058a-3618-4e70-be96-81000ae0190e",
 *   "authenticationID": "318a9273-6068-4ef9-86bb-dba87800b72b",
 *   "locales": {
 *     "default": {
 *       "products": {
 *         "destinationID": "beccfdd9-8069-4a95-bcee-638341138bed",
 *         "tasks": {
 *           "replace": "7b023377-6ecf-4b3c-9a3b-b1f41bb20ec1"
 *         }
 *       },
 *       "categories": {
 *         "destinationID": "cd6729c3-608c-4683-826b-581584d12acf",
 *         "tasks": {
 *           "replace": "6a853b8f-cb4d-4d1f-bbfd-d2d1c3b65f5f"
 *         }
 *       }
 *     },
 *     "en_US": {
 *       "products": {
 *         "destinationID": "b1276044-05ea-4c9f-adb9-20937f412cc6",
 *         "tasks": {
 *           "replace": "39e91a77-0c03-45d5-a8c7-d5106d89e900"
 *         }
 *       },
 *       "categories": {
 *         // ...
 *       }
 *     }
 *   }
 * }
 *
 * @param {string} appId - Algolia AppID
 * @param {string} adminApiKey - Algolia Admin API Key
 */
function updateIngestionConfig(appId, adminApiKey) {
    var currentSite = algoliaData.getCurrentSite();
    Logger.info("Updating indexing configuration... AppID=" + appId);
    var indexingConfig = JSON.parse(algoliaData.getPreference("Indexing_Config")) || {
        locales: {}
    };
    var sourceID = indexingConfig.sourceID;
    if (!sourceID) {
        Logger.info('No source found. Registering one...');
        sourceID = algoliaIngestionAPI.registerSource('Source of SFCC site ' + currentSite.getName(), currentSite.getID());
        Logger.info('Source registered. SourceID: ' + sourceID);
        indexingConfig.sourceID = sourceID;
        algoliaData.setPreference('Indexing_Config', JSON.stringify(indexingConfig));
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
        algoliaData.setPreference('Indexing_Config', JSON.stringify(indexingConfig));
    } else {
        Logger.info('Authentication already registered: ' + authenticationID + '. Updating...');
        algoliaIngestionAPI.updateAuthentication(authenticationID, {
            name: 'Authentication of SFCC site: ' + currentSite.getName(),
            appId: appId,
            apiKey: adminApiKey
        });
    }

    // The Ingestion API expects one destination per Algolia index.
    // So we have to register two destinations for each locale: one for the products and one for the categories
    var siteLocales = currentSite.getAllowedLocales().toArray();
    var indicesTypes = ['products', 'categories']
    for (var i = 0; i < siteLocales.length; ++i) {
        var locale = siteLocales[i];
        if (!indexingConfig.locales[locale]) {
            indexingConfig.locales[locale] = {};
        }

        for (var j = 0; j < indicesTypes.length; ++j) {
            var type = indicesTypes[j];
            if (!indexingConfig.locales[locale][type]) {
                indexingConfig.locales[locale][type] = {};
            }
            var destinationID = registerOrUpdateDestination({
                siteID: currentSite.getID(),
                authenticationID: authenticationID,
                locale: locale,
                type: type,
                existingDestinationID: indexingConfig.locales[locale][type].destinationID,
            });
            indexingConfig.locales[locale][type].destinationID = destinationID;
            algoliaData.setPreference('Indexing_Config', JSON.stringify(indexingConfig));

            var tasks = registerTasks({
                sourceID: sourceID,
                destinationID: destinationID,
                locale: locale,
                type: type,
                existingTasks: indexingConfig.locales[locale][type].tasks,
            });
            indexingConfig.locales[locale][type].tasks = tasks;
            algoliaData.setPreference('Indexing_Config', JSON.stringify(indexingConfig));
        }
    }
}

/**
 * Registers or updates the Destination on the Ingestion API.
 * @param {Object} params
 * @param {string} params.siteID - SFCC Site ID
 * @param {string} params.authenticationID - Algolia AuthenticationID
 * @param {string} params.locale - Targeted locale
 * @param {string} params.type - Type: 'products' or 'categories'
 * @param {string?} params.existingDestinationID - The destinationID if it has already been registered
 *
 * @returns {string} destinationID
 */
function registerOrUpdateDestination({siteID, authenticationID, locale, type, existingDestinationID}) {
    if (!existingDestinationID) {
        Logger.info('Registering "' + type + '" destination for locale: "' + locale + '"...');
        var destinationID = algoliaIngestionAPI.registerDestination({
            name: siteID + '_' + type + '_' + locale,
            indexName: algoliaData.getIndexPrefix() + '_' + type + '_' + locale,
            authenticationID: authenticationID
        });
        Logger.info(`Destination "${type}" registered for locale "` + locale + '". DestinationID: ' + destinationID);
        return destinationID;
    } else {
        Logger.info('Updating "' + type + '" destination for "' + locale + '": ' + locale + '" (' + existingDestinationID + ')...');
        return algoliaIngestionAPI.updateDestination(existingDestinationID, {
            name: siteID + '_' + type + '_' + locale,
            indexName: algoliaData.getIndexPrefix() + '_' + type + '_' + locale,
            authenticationID: authenticationID
        });
    }
}

/**
 * Registers or updates the Destination on the Ingestion API.
 * @param {Object} params
 * @param {string} params.sourceID - Algolia sourceID
 * @param {string} params.destinationID - Algolia DestinationID
 * @param {string} params.locale - Targeted locale
 * @param {string} params.type - Type: 'products' or 'categories'
 * @param {object?} params.existingTasks - An object containing the registered task IDs
 *
 * @returns {Object} An object containing the registered task IDs
 */
function registerTasks({sourceID, destinationID, locale, type, existingTasks}) {
    var tasks = existingTasks || {};
    if (!tasks.replace) {
        Logger.info('Registering "replace" task for "' + type + '" and locale: "' + locale + '"...');
        tasks.replace = algoliaIngestionAPI.registerTask({
            sourceID: sourceID,
            destinationID: destinationID,
            action: 'replace'
        });
        Logger.info('"replace" task created for "' + type + '" and locale "' + locale + '": ' + tasks.replace);
    } else {
        Logger.info('"replace" task already exists for "' + type + '" and locale "' + locale + '": ' + tasks.replace);
    }
    return tasks;
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
