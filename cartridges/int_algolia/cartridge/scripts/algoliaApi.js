var serviceHelper = require('./service/serviceHelper');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

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
        client_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // @TODO replace from configs
        client_password: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        index_prefix: 'custom-prefix--', // @TODO replace with environment?
        fields: {
            product: ['resource_id', 'name', 'description', 'categories', 'image_urls', 'price', 'adjusted_price', 'in_stock', 'url'],
            category: ['id', 'name', 'description', 'image', 'thumbnail', 'parent_category_id', 'subcategory', 'url']
        }
    };

    return {
        config: config,
        metadata: metadata
    };
}

function requestTenantToken() {
    var callStatus;
    var token = null;
    var body = createHandshakeRequest();
    var service = require('./service/serviceDefinition');
    var baseURL = service.getConfiguration().getCredential().getURL();

    service.setRequestMethod('POST');
    service.setURL(baseURL + '/sfcc/api/algolia_config/' + getTenantID());

    callStatus = serviceHelper.callJsonService('Create Tenant', service, body);

    if (callStatus.status === Status.OK) {
        token = callStatus.getDetail('object');
    }

    return token;
}

function getTenantToken() {
    if (tenantToken === null) {
        tenantToken = requestTenantToken();
    }
    return tenantToken;
}

function getEnvironmentId() {
    return 'RefArch'
}

function sendDelta(itemsArray) {
    var service = require('./service/serviceDefinition');
    var baseURL = service.getConfiguration().getCredential().getURL();

    service.setRequestMethod('POST');
    service.setURL(baseURL + ' /webhooks/sfcc/' + getTenantID() + '/' + getEnvironmentId() + '/incremental_operations');
    service.setAuthentication('NONE');
    service.addHeader('Authorization', 'Bearer ' + getTenantToken());

    var operationsObj = Object.create(null);
    operationsObj.operations = itemsArray;

}

module.exports.sendDelta = sendDelta;
module.exports.getTenantToken = getTenantToken;
