'use strict';

/**
 * Algolia Export Service definition file
 * @returns {dw.svc.HTTPService} - HTTPService object
 */
function init() {
    var exportService = require('dw/svc/LocalServiceRegistry').createService('algolia.http.export', {
        createRequest: function (service, params) {
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
    return exportService;
}

module.exports.init = init;
