/* global algoliasearch */
const algoliarecommend = window['@algolia/recommend'];

document.addEventListener('DOMContentLoaded', function () {
    var $suggestionsWrapper = $('#suggestions-wrapper');

    var categoryDisplayNamePath = $suggestionsWrapper.attr('data-category-display-name-path');  // path of the current category
    var categoryDisplayNamePathSeparator = $suggestionsWrapper.attr('data-category-display-name-path-separator'); // separator used to serialize the category path (by default: '>')
    var urlQuery = $suggestionsWrapper.attr('data-q'); // onload search query - for search page - URL param: q
    var searchPageRoot = $suggestionsWrapper.attr('data-search-page-root'); // onload search query - for search page - URL param: q

    var searchClient = algoliasearch(algoliaData.applicationID, algoliaData.searchApiKey);
    searchClient.addAlgoliaAgent('Algolia Salesforce B2C (SFRA)', 'v' + algoliaData.version);

    const recommendClient = algoliarecommend(algoliaData.applicationID, algoliaData.searchApiKey);
    recommendClient.addAlgoliaAgent('Algolia Salesforce B2C (SFRA)', 'v' + algoliaData.version);

    enableAutocomplete({
        searchClient,
        searchPageRoot,
        recommendClient,
    });

    // FIXME: only enable on search and category page
    enableInstantSearch({
        searchClient,
        urlQuery,
        categoryDisplayNamePath,
        categoryDisplayNamePathSeparator,
    });

    enableRecommendations({
        recommendClient,
        categoryDisplayNamePath,
        categoryDisplayNamePathSeparator,
    });

    if (algoliaData.enableInsights) {
        enableInsights(algoliaData.applicationID, algoliaData.searchApiKey, algoliaData.productsIndex);
    }
});
