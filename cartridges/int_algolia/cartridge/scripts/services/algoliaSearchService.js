'use strict';

const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

const version = require('*/algoliaconfig').version;

/**
 * Algolia Search Service definition file
 * @returns {dw.svc.HTTPService} - HTTPService object
 */
function getService() {

    const applicationID = algoliaData.getPreference('ApplicationID');
    const searchAPIKey = algoliaData.getPreference('SearchApiKey');
    const indexName = algoliaData.calculateIndexName('products');

    if (empty(applicationID) || empty(searchAPIKey)) return null;

    let searchService = LocalServiceRegistry.createService('algolia.http.search', {
        createRequest: function (service, requestBody) {

            // service URL is "https://{{applicationID}}-dsn.algolia.net/1/indexes/{{indexName}}/query"
            service.setURL(service.getURL().replace('{{applicationID}}', applicationID).replace('{{indexName}}', indexName));

            service.addHeader('Content-Type', 'application/json; charset=UTF-8');
            service.addHeader('X-Algolia-Application-Id', applicationID);
            service.addHeader('X-Algolia-API-Key', searchAPIKey);
            service.addHeader('x-algolia-agent', 'Algolia Salesforce B2C (SFRA) SSR v' + version);

            // request body that is sent to Algolia should look like this:
            // '{"params":"facetFilters=%5B%22__primary_category.2%3AMens%20%3E%20Clothing%20%3E%20Suits%22%5D"}'
            // the value of the facetFilters parameter is URL-encoded, then the whole object stringified
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

    return searchService;
}

module.exports.getService = getService;
