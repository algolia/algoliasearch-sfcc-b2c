// CAN BE REMOVED?


var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');


var serviceHelper = require('*/cartridge/scripts/services/algoliaServiceHelper.js');
// var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
// var algoliaProductConfig = require('*/cartridge/scripts/algolia/lib/algoliaProductConfig');
var algoliaSearchService = require('*/cartridge/scripts/services/algoliaSearchService');
// var encryptHelper = require('*/cartridge/scripts/algolia/helper/encryptHelper');


function testCall() {
    var searchService = algoliaSearchService.createSearchService();

    var requestBody = {
        params: "facetFilters=" + encodeURIComponent('["__primary_category.2:Mens > Clothing > Suits"]'),
    };

    var result = searchService.setThrowOnError().call(requestBody);


    if (result.ok) {
        //res.print(JSON.stringify(result.object.body.hits));
        return result;
    }

    return null;




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
