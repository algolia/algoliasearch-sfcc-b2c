'use strict';

const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

/**
 * Algolia Indexing Service definition file
 * The service can be called with the following parameters object:
 * { "method": string, "url": string, "body": {} }
 * @returns {dw.svc.HTTPService} - HTTPService object
 */
function getService() {
    const applicationID = algoliaData.getPreference('ApplicationID');
    const adminAPIKey = algoliaData.getPreference('AdminApiKey');

    if (empty(applicationID) || empty(adminAPIKey)) {
        throw new Error('Indexing service: Missing credentials');
    }

    const defaultHostname = applicationID + '.algolia.net';

    let indexingService = LocalServiceRegistry.createService('algolia.http.search.write', {
        createRequest: function (service, parameters) {
            if (parameters) {
                service.setRequestMethod(parameters.method || 'POST');
                service.setURL(parameters.url);
                return JSON.stringify(parameters.body);
            }
        },
        parseResponse: function (service, response) {
            return {
                body: JSON.parse(response.text),
                headers: response.responseHeaders,
                statusCode: response.statusCode,
            }
        },
    });

    indexingService.addHeader('Content-Type', 'application/json; charset=UTF-8');
    indexingService.addHeader('X-Algolia-Application-Id', applicationID);
    indexingService.addHeader('X-Algolia-API-Key', adminAPIKey);
    indexingService.addHeader('X-Algolia-Agent', 'Algolia Salesforce B2C');

    return indexingService;
}

module.exports.getService = getService;
