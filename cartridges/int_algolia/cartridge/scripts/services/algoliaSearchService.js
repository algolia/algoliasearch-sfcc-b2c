'use strict';

const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

/**
 * Algolia Search Service definition file
 * @returns {dw.svc.HTTPService} - HTTPService object
 */
function init() {

    const applicationID = algoliaData.getPreference('ApplicationID');
    const searchAPIKey = algoliaData.getPreference('SearchApiKey');
    const indexName = algoliaData.calculateIndexName('products');

    if (empty(applicationID) || empty(searchAPIKey)) return;



    // APPROACH 1

    // var searchService = LocalServiceRegistry.createService('algolia.http.search', {
    //     createRequest: function (service, params) {
    //         // service.addHeader('User-Agent', 'INTEGRATION v1; Algolia for Javascript(SitegGenesis + SFRA); PLATFORM: SFCC ' + dw.system.System.compatibilityMode);
    //         service.addHeader('Content-Type', 'application/json');

    //         service.addHeader('X-Algolia-Application-Id', applicationID);
    //         service.addHeader('X-Algolia-API-Key', searchAPIKey);
    //         service.addHeader('X-Algolia-Agent', 'Algolia Salesforce B2C (SFRA) SSR');


    //         // service URL is https://{{applicationID}}-dsn.algolia.net/1/indexes/{{indexName}}/query, replace placeheolder with actual appID
    //         service.setURL(service.getURL().replace('{{applicationID}}', applicationID).replace('{{indexName}}', indexName));

    //         var params = JSON.stringify('{"params":"face1tFilters=["__primary_category.2:Mens > Clothing > Suits"]"}');

    //         return params;
    //     },

    //     /*
    //     We only get here for 2xx HTTP Status Code
    //     everything else will set or throw the error
    //     */
    //     parseResponse: function (service, client) {
    //         return {
    //             response: client.text,
    //             headers: client.responseHeaders,
    //             statusCode: client.statusCode
    //         };
    //     },
    //     filterLogMessage: function (msg) {
    //         return msg;
    //     }
    // });
    // return searchService;


















    // APPROACH 2



    // Define a script object with callback functions
    var serviceCallback = {
        createRequest: function (service, requestData) {
            service.setURL(service.getURL().replace('{{applicationID}}', applicationID).replace('{{indexName}}', indexName));
            service.addHeader('Content-Type', 'application/json');

            service.addHeader('X-Algolia-Application-Id', applicationID);
            service.addHeader('X-Algolia-API-Key', searchAPIKey);
            service.addHeader('X-Algolia-Agent', 'Algolia Salesforce B2C (SFRA) SSR');
            // service.addHeader('Authorization', 'Bearer ' + service.getConfiguration().getCredential().getAccessToken());
            return JSON.stringify(requestData);
        },
        parseResponse: function (service, response) {
            return JSON.parse(response.text);
        },
        filterLogMessage: function (message) {
            return message;
        }
    };

    // Create a service object using the service configuration name and script object
    var myService = LocalServiceRegistry.createService('algolia.http.search', serviceCallback);

    return myService;





    // // Call the service with the requestData object
    // var requestData = {
    //     "params" : "facetFilters=%5B%22__primary_category.2%3AMens%20%3E%20Clothing%20%3E%20Suits%22%5D"
    // };
    // var result = myService.call(requestData);

    // // Handle the service call results
    // if (result.status === 'OK') {
    //     var serviceResponse = result.object;
    //     // Process the serviceResponse object
    //     Logger.info('Service call successful: {0}', JSON.stringify(serviceResponse));
    // } else {
    //     // Handle service call error
    //     Logger.error('Service call failed: {0}', result.error);
    // }

    // return myService;


}


// APPROACH 3


// var requestBody = {
//     "params" : "facetFilters=%5B%22__primary_category.2%3AMens%20%3E%20Clothing%20%3E%20Suits%22%5D"
// };

// // Execute the request on the service configuration
// function makeCall(svcConfig: Service, params: Object) {

// });

// // Make the service call here
// makeCall(service, requestBody);


module.exports.init = init;
