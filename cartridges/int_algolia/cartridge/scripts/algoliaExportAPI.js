'use strict';

var serviceHelper = require('*/cartridge/scripts/services/algoliaServiceHelper');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaProductConfig = require('*/cartridge/scripts/algolia/lib/algoliaProductConfig');
var algoliaExportService = require('*/cartridge/scripts/services/algoliaExportService');
var encryptHelper = require('*/cartridge/scripts/algolia/helper/encryptHelper');

var Status = require('dw/system/Status');
var tenantToken = null;
var tenantCallStatus = new Status(Status.ERROR);

var dwSystem = require('dw/system/System');
var currentSite = algoliaData.getCurrentSite();

/**
 * Create tenant id in the form
 * tenant_id = {Algolia_ApplicationID} + '_' + SiteID + '_' + instanceHostname
 * @returns {string} tenant ID
 */
function calculateTenantID() {
    return algoliaData.getPreference('ApplicationID') + '_' + currentSite.getID() + '_' + algoliaData.getInstanceHostName();
}

/**
 * Create request config Object for get TenantToken
 * @returns {Object} - request config Object
 */
function createHandshakeRequest() {
    var config = {
        algolia_app_id: algoliaData.getPreference('ApplicationID'),
        algolia_api_key: algoliaData.getPreference('AdminApiKey'),
        algolia_search_api_key: algoliaData.getPreference('SearchApiKey')
    };

    var metadata = {
        https_hostname: dwSystem.getInstanceHostname(),
        site_id: currentSite.getID(),
        site_name: currentSite.getName(),
        locales: currentSite.getAllowedLocales().toArray(),
        currencies: currentSite.getAllowedCurrencies().toArray(),
        index_prefix: algoliaData.getIndexPrefix(),
        fields: {
            product: algoliaProductConfig.defaultAttributes.concat(algoliaData.getSetOfArray('CustomFields')),
            category: ['id', 'name', 'description', 'image', 'thumbnail', 'parent_category_id', 'subCategories', 'url']
        }
    };

    var ocapiEncrypted = encryptHelper.encryptOcapiCredentials(
        algoliaData.getPreference('OCAPIClientID') || 'aaaaaaaaaaaaaaaaaaaaaaa',
        algoliaData.getPreference('OCAPIClientPassword' || 'aaaaaaaaaaaaaaaaaaaaaaa'),
        algoliaData.getPreference('AdminApiKey'),
        algoliaData.getPreference('SearchApiKey')
    );

    if (ocapiEncrypted) {
        metadata.client_id = ocapiEncrypted.clientId;
        metadata.client_password = ocapiEncrypted.clientPassword;
    }

    return {
        config: config,
        metadata: metadata
    };
}

/**
 * Get TenantToken from Algolia
 * @returns {string} - TenantToken
 */
function requestTenantToken() {
    var body = createHandshakeRequest();
    var service = algoliaExportService.init();
    var baseURL = service.getConfiguration().getCredential().getURL();

    service.setRequestMethod('POST');
    service.setURL(baseURL + '/sfcc/api/algolia_config/' + calculateTenantID());

    var callStatus = serviceHelper.callJsonService('Create Tenant', service, body);
    return callStatus;
}

/**
 * Get TenantToken for sending data to Algolia API
 * @returns {dw.system.Status} - TenantToken
 */
function getTenantToken() {
    if (tenantToken === null) {
        tenantCallStatus = requestTenantToken();
        if (tenantCallStatus.status === Status.OK) {
            var tokenObj = tenantCallStatus.getDetail('object');
            tenantToken = tokenObj.body.token;
            /*
                {
                    "body": {
                        "token": "xxx"
                    }
                }
            */
        }
    }
    return tenantToken;
}

/**
 * Send array of objects to Algolia API
 * @param {Array} itemsArray - array of objects for send to Algolia
 * @returns {dw.system.Status} - successful Status to send
 */
function sendDelta(itemsArray) {
    if (empty(getTenantToken())) {
        return tenantCallStatus;
    }

    var service = algoliaExportService.init();
    var baseURL = service.getConfiguration().getCredential().getURL();

    service.setRequestMethod('POST');
    service.setURL(baseURL + '/sfcc/webhooks/' + calculateTenantID() + '/incremental_operations');
    service.setAuthentication('NONE');
    service.addHeader('Authorization', 'Basic ' + getTenantToken());

    var operationsObj = Object.create(null);
    operationsObj.operations = itemsArray;

    var callStatus = serviceHelper.callJsonService('Send Delta', service, operationsObj);

    return callStatus;
}

/**
 * Makes get indexing status/clean queue/resume indexing API calls
 * @param {string} requestType - request type
 * @returns {dw.system.Status} - successful Status to send
 */
function makeIndexingRequest(requestType) {
    if (empty(getTenantToken())) {
        return tenantCallStatus;
    }

    var requestTypeToUrlparam = {
        status: 'status',
        clean: 'clean_queues',
        resume: 'resume_indexing'
    };

    var service = algoliaExportService.init();
    var baseURL = service.getConfiguration().getCredential().getURL();

    if (requestType === 'status') {
        service.setRequestMethod('GET');
    }

    service.setURL(baseURL + '/sfcc/api/algolia_config/' + calculateTenantID() + '/' + requestTypeToUrlparam[requestType]);
    service.setAuthentication('NONE');
    service.addHeader('Authorization', 'Basic ' + getTenantToken());

    var callStatus = serviceHelper.callJsonService(requestType, service);

    return callStatus;
}

module.exports.sendDelta = sendDelta;
module.exports.makeIndexingRequest = makeIndexingRequest;
