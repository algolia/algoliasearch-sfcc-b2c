/* global algoliasearch, algoliaData, enableAutocomplete, enableInstantSearch, enableInsights, enableRecommendations */

document.addEventListener('DOMContentLoaded', function () {
    var $suggestionsWrapper = $('#suggestions-wrapper');

    var categoryDisplayNamePath = $suggestionsWrapper.attr('data-category-display-name-path');  // path of the current category
    var categoryDisplayNamePathSeparator = $suggestionsWrapper.attr('data-category-display-name-path-separator'); // separator used to serialize the category path (by default: '>')
    var urlQuery = $suggestionsWrapper.attr('data-q'); // onload search query - for search page - URL param: q
    var searchPageRoot = $suggestionsWrapper.attr('data-search-page-root'); // onload search query - for search page - URL param: q

    var searchClient = algoliasearch(algoliaData.applicationID, algoliaData.searchApiKey);
    searchClient.addAlgoliaAgent('Algolia Salesforce B2C (SFRA)', 'v' + algoliaData.version);

    var recommendClient = null;

    if (algoliaData.enableRecommend) {
        const algoliarecommend = window['@algolia/recommend'];
        recommendClient = algoliarecommend(algoliaData.applicationID, algoliaData.searchApiKey);
        recommendClient.addAlgoliaAgent('Algolia Salesforce B2C (SFRA)', 'v' + algoliaData.version);

        enableRecommendations({
            recommendClient,
            categoryDisplayNamePath,
            categoryDisplayNamePathSeparator,
        });
    }

    enableAutocomplete({
        searchClient,
        searchPageRoot,
        recommendClient,
    });

    if (document.querySelector('#algolia-category-title-placeholder') ||
        document.querySelector('#algolia-searchbox-placeholder')) {
        enableInstantSearch({
            searchClient,
            urlQuery,
            categoryDisplayNamePath,
            categoryDisplayNamePathSeparator,
        });
    }

    if (algoliaData.enableInsights) {
        enableInsights(algoliaData.applicationID, algoliaData.searchApiKey, algoliaData.productsIndex);
    }
});
