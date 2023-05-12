
var algoliaSearchService = require('*/cartridge/scripts/services/algoliaSearchService');
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Logger = require('dw/system/Logger');

/**
 * Server-side rendering of CLP search results: retrieves the first page of results from Algolia for the given category
 * @param {string} cgid categoryID to get the search results for
 * @returns {Array} the array of objects containing the search result hits or an empty array in case of error
 */
function getCategoryProductHits(cgid) {
    var facetFiltersParamValue = require('*/cartridge/scripts/algolia/helper/ssrHelper').facetFiltersParamValueFromBreadcrumbs(cgid);

    var searchService = algoliaSearchService.getService();

    if (!empty(searchService)) {
        var requestBody = {
            // unencoded example:
            // params: "facetFilters=" + encodeURIComponent('["__primary_category.2:Mens > Clothing > Suits"]')
            params: "facetFilters=" + encodeURIComponent(facetFiltersParamValue)
                + "&hitsPerPage=9",
        };

        // any problems with the request will result in the script simply returning an empty array as server-side rendering
        // is not vital to the functioning of the site (the results will be replaced by the client-side script anyway)
        try {
            var result = searchService.setThrowOnError().call(requestBody);
            if (result.ok) {
                return result.object.body.hits;
            }
        } catch(e) {
            Logger.error(e.message + ': ' + e.stack);
        }
    }

    // return empty array in case of any error or if the service is disabled
    return [];
}

module.exports.getCategoryProductHits = getCategoryProductHits;
