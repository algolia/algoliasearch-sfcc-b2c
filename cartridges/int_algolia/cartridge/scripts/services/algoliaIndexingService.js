'use strict';

const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

/**
 * Algolia Indexing Service definition file
 * @returns {dw.svc.HTTPService} - HTTPService object
 */
function getService() {

    const applicationID = algoliaData.getPreference('ApplicationID');
    const adminAPIKey = algoliaData.getPreference('AdminApiKey');

    if (empty(applicationID) || empty(adminAPIKey)) return null;

    let indexingService = LocalServiceRegistry.createService('algolia.http.indexing', {
        createRequest: function (service, requestBody) {
            service.setURL(service.getURL().replace('{{applicationID}}', applicationID));

            service.addHeader('Content-Type', 'application/json; charset=UTF-8');
            service.addHeader('X-Algolia-Application-Id', applicationID);
            service.addHeader('X-Algolia-API-Key', adminAPIKey);
            service.addHeader('X-Algolia-Agent', 'Algolia Salesforce B2C');

            return JSON.stringify(requestBody);
        },
        parseResponse: function (service, response) {
            // we only return this for HTTP 2xx status codes, everything else will be error-handled
            return {
                body: JSON.parse(response.text),
                headers: response.responseHeaders,
                statusCode: response.statusCode,
            }
        },
        filterLogMessage: function (message) {
            return message;
        },
    });

    return indexingService;
}

module.exports.getService = getService;
