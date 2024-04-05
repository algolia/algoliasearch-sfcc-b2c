/* global algoliasearch */

document.addEventListener('DOMContentLoaded', function () {
    var $suggestionsWrapper = $('#suggestions-wrapper');

    var categoryDisplayNamePath = $suggestionsWrapper.attr('data-category-display-name-path');  // path of the current category
    var categoryDisplayNamePathSeparator = $suggestionsWrapper.attr('data-category-display-name-path-separator'); // separator used to serialize the category path (by default: '>')
    var urlQuery = $suggestionsWrapper.attr('data-q'); // onload search query - for search page - URL param: q
    var searchPageRoot = $suggestionsWrapper.attr('data-search-page-root'); // onload search query - for search page - URL param: q

    var searchClient = algoliasearch(algoliaData.applicationID, algoliaData.searchApiKey);
    searchClient.addAlgoliaAgent('Algolia Salesforce B2C (SG)', 'v' + algoliaData.version);

    enableAutocomplete({
        searchClient: searchClient,
        searchPageRoot: searchPageRoot
    });

    if (document.querySelector('.cat-banner h1') ||
        document.querySelector('#algolia-searchbox-placeholder')) {
        enableInstantSearch({
            searchClient: searchClient,
            urlQuery: urlQuery,
            categoryDisplayNamePath: categoryDisplayNamePath,
            categoryDisplayNamePathSeparator: categoryDisplayNamePathSeparator,
        });
    }

    if (algoliaData.enableInsights) {
        enableInsights(algoliaData.applicationID, algoliaData.searchApiKey, algoliaData.productsIndex);
    }
});
