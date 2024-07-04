
var algoliaSearchService = require('*/cartridge/scripts/services/algoliaSearchService');
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Logger = require('dw/system/Logger');

/**
 * Server-side rendering of query search results: retrieves the first page of results from Algolia for the given search
 * @param {string} query search query to get the search results
 * @param {string} type search type (category or query)
 * @param {string} indexType index type (products or contents)
 * @returns {Array} the array of objects containing the search result hits or an empty array in case of error
 */
function getServerSideHits(query, type, indexType) {
    var searchService = algoliaSearchService.getService(indexType);

    if (!empty(searchService)) {
        var params = '';
        if (type === 'category') {
            var facetFiltersParamValue = require('*/cartridge/scripts/algolia/helper/ssrHelper').facetFiltersParamValueFromBreadcrumbs(query);
        }

        var params = type === 'category' ? "facetFilters=" + encodeURIComponent(facetFiltersParamValue) : "query=" + query;

        var additionalSSRParams = "hitsPerPage=9&analytics=false&enableABTest=false";

        var requestBody = {
            params: params + "&" + additionalSSRParams,
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

module.exports.getServerSideHits = getServerSideHits;

