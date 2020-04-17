/**
 * Algolia API Service definition file
 */

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');

/**
 * Check if response type is JSON
 * @param {dw.net.HTTPClient} client
 * @returns {boolean}
 */
function isResponseJSON(client) {
    var contentTypeHeader = client.getResponseHeader('Content-Type');
    return contentTypeHeader && contentTypeHeader.split(';')[0].toLowerCase() === 'application/json';
}

module.exports = LocalServiceRegistry.createService('algolia.api', {
    createRequest: function (service, params) {
        // @TODO add SG or SFRA detection
        service.addHeader('User-Agent', 'INTEGRATION v1; Algolia for Javascript(SitegGenesis + SFRA); PLATFORM: SFCC ' + dw.system.System.compatibilityMode);
        service.addHeader('Content-Type', 'application/json');
        return params;
    },

    /*
      We only get here for 2xx HTTP Status Code
      everything else will set or throw the error
     */
    parseResponse: function (service, client) {
        return {
            response: client.text,
            headers: client.responseHeaders,
            statusCode: client.statusCode
        };
    },
    filterLogMessage: function (msg) {
        return msg;
    }
});

