var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');


var serviceHelper = require('*/cartridge/scripts/services/algoliaServiceHelper.js');
// var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
// var algoliaProductConfig = require('*/cartridge/scripts/algolia/lib/algoliaProductConfig');
var algoliaSearchService = require('*/cartridge/scripts/services/algoliaSearchService');
// var encryptHelper = require('*/cartridge/scripts/algolia/helper/encryptHelper');


function testCall() {
    var service = algoliaSearchService.init();

    // service.setRequestMethod('POST');
    // service.setAuthentication('NONE');
    // // service.addParam('facetFilters', '[["__primary_category.1:Mens > Clothing"]]');
    // service.addParam('{"params":"facetFilters=%5B%5B%22__primary_category.2%3AMens%20%3E%20Clothing%20%3E%20Suits%22%5D%5D&"}')

    var requestBody = {
        "params" : "facetFilters=%5B%22__primary_category.2%3AMens%20%3E%20Clothing%20%3E%20Suits%22%5D"
    };

    var result = service.call(requestBody);


    var x = result;







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











}

module.exports.testCall = testCall;


// service: "algolia.http.search"
// cred: "algolia.http.search.cred"
// profile: "algolia.http.search.profile"



// get service
// get applicationID and search API key from site preferences and use those

// sitePrefIDs: "Algolia_ApplicationID", "Algolia_SearchApiKey"


// replace {{applicationID}} in service credential URL with the applicationID from site preferences


// write mock
