/**
 * Create tenant id in the form
 * tenant_id = {Algolia_ApplicationID} + '-' + SiteID + '-' + instanceHostname
 * @returns {string} tenant ID
 */
function createTenantID() {
    var dwSystem = require('dw/system/System');
    var dwSite = require('dw/system/Site');
    var instanceHostname;

    instanceHostname = dwSystem.getInstanceHostname();
    // remove the sandbox host
    if (dwSystem.instanceType === dwSystem.DEVELOPMENT_SYSTEM) {
        instanceHostname = instanceHostname.replace('.commercecloud.salesforce.com', '');
        instanceHostname = instanceHostname.replace('.demandware.net', '');
    }
    // replace dots
    instanceHostname = instanceHostname.replace('.', '-');

    return dwSite.current.preferences.custom.Algolia_ApplicationID + '-' + dwSite.getCurrent().ID + '-' + instanceHostname;
}

module.exports.createTenantID = createTenantID;
