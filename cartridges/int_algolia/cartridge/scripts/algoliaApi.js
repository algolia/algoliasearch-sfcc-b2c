"use strict";

var serviceHelper = require('*/cartridge/scripts/service/serviceHelper');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var serviceDefinition = require('*/cartridge/scripts/service/serviceDefinition');


var Status = require('dw/system/Status');
var tenantToken = null;

var dwSystem = require('dw/system/System');
var currentSite = require('dw/system/Site').getCurrent();

/**
 * Create tenant id in the form
 * tenant_id = {Algolia_ApplicationID} + '-' + SiteID + '-' + instanceHostname
 * @returns {string} tenant ID
 */
function getTenantID() {
    var instanceHostname;

    instanceHostname = dwSystem.getInstanceHostname();
    // remove the sandbox host
    if (dwSystem.instanceType === dwSystem.DEVELOPMENT_SYSTEM) {
        instanceHostname = instanceHostname.replace('.commercecloud.salesforce.com', '');
        instanceHostname = instanceHostname.replace('.demandware.net', '');
    }
    // replace dots
    instanceHostname = instanceHostname.replace('.', '-');

    return algoliaData.getPreference('ApplicationID') + '-' + currentSite.getID() + '-' + instanceHostname;
}

/**
 * Create request config Object for get TenantToken
 * @returns {Object} - request config Object
 */
function createHandshakeRequest() {
    var config = {
        algolia_app_id         : algoliaData.getPreference('ApplicationID'),
        algolia_api_key        : algoliaData.getPreference('AdminApiKey'),
        algolia_search_api_key : algoliaData.getPreference('SearchApiKey')
    };

    var metadata = {
        https_hostname  : dwSystem.getInstanceHostname(),
        site_id         : currentSite.getID(),
        site_name       : currentSite.getName(),
        locales         : currentSite.getAllowedLocales().toArray(),
        client_id       : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // @TODO replace from configs
        client_password : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        index_prefix    : 'astound', // @TODO replace with environment?
        // @TODO replace from config
        fields          : {
            product  : ['resource_id', 'name', 'description', 'categories', 'image_urls', 'price', 'adjusted_price', 'in_stock', 'url'],
            category : ['id', 'name', 'description', 'image', 'thumbnail', 'parent_category_id', 'subcategory', 'url']
        }
    };

    return {
        config   : config,
        metadata : metadata
    };
}

/**
 * Get TenantToken from Alglia
 * @returns {string} - TenantToken
 */
function requestTenantToken() {
    var callStatus;
    var token = null;
    var body = createHandshakeRequest();
    var service = serviceDefinition.init();
    var baseURL = service.getConfiguration().getCredential().getURL();

    service.setRequestMethod('POST');
    service.setURL(baseURL + '/sfcc/api/algolia_config/' + getTenantID());

    callStatus = serviceHelper.callJsonService('Create Tenant', service, body);
    /*
    {
        "body": {
            "token": "xxx"
        }
    }
    */

    if (callStatus.status === Status.OK) {
        var tokenObj = callStatus.getDetail('object');
        token = tokenObj.body.token;
    }

    return token;
}

/**
 * Get TenantToken for sending data to Alglia API
 * @returns {string} - TenantToken
 */
function getTenantToken() {
    if (tenantToken === null) {
        tenantToken = requestTenantToken();
    }
    return tenantToken;
}

/*
function getEnvironmentId() {
    return 'RefArch';
}
*/

/**
 * Send array of objects to Algolia API
 * @param {Array} itemsArray - array of objects for send to Algolia
 * @returns {boolean} - successful to send
 */
function sendDelta(itemsArray) {
    var service = serviceDefinition.init();
    var baseURL = service.getConfiguration().getCredential().getURL();

    service.setRequestMethod('POST');
    service.setURL(baseURL + '/sfcc/webhooks/' + getTenantID() + '/incremental_operations');
    service.setAuthentication('NONE');
    service.addHeader('Authorization', 'Basic ' + getTenantToken());

    var operationsObj = Object.create(null);
    operationsObj.operations = itemsArray;

    callStatus = serviceHelper.callJsonService('Send Delta', service, operationsObj);

    return callStatus;
}

module.exports.sendDelta = sendDelta;
module.exports.getTenantToken = getTenantToken;
