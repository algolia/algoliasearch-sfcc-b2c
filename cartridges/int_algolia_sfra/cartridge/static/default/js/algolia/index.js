/* global algoliasearch */

document.addEventListener('DOMContentLoaded', function () {
    var $suggestionsWrapper = $('#suggestions-wrapper');
    var locale = algoliaData.locale;

    var userCurrency = algoliaData.currencyCode;
    var userCurrencySymbol = algoliaData.currencySymbol;
    var categoryDisplayNamePath = $suggestionsWrapper.attr('data-category-display-name-path');  // path of the current category
    var categoryDisplayNamePathSeparator = $suggestionsWrapper.attr('data-category-display-name-path-separator'); // separator used to serialize the category path (by default: '>')
    var urlQuery = $suggestionsWrapper.attr('data-q'); // onload search query - for search page - URL param: q
    var searchPageRoot = $suggestionsWrapper.attr('data-search-page-root'); // onload search query - for search page - URL param: q


    var productsIndex = algoliaData.productsIndex;
    var productsIndexPriceAsc = productsIndex + '__price_' + userCurrency + '_asc';
    var productsIndexPriceDesc = productsIndex + '__price_' + userCurrency + '_desc';

    var categoriesIndex = algoliaData.categoriesIndex;

    var searchClient = algoliasearch(algoliaData.applicationID, algoliaData.searchApiKey);
    searchClient.addAlgoliaAgent('Algolia Salesforce B2C', 'SFRA');

    enableAutocomplete({
        searchClient: searchClient,
        productsIndex: productsIndex,
        categoriesIndex: categoriesIndex,
        searchPageRoot: searchPageRoot
    });

    // FIXME: only enable on search and category page
    enableInstantSearch({
        searchClient: searchClient,
        productsIndex: productsIndex,
        productsIndexPriceAsc: productsIndexPriceAsc,
        productsIndexPriceDesc: productsIndexPriceDesc,

        urlQuery: urlQuery,
        categoryDisplayNamePath: categoryDisplayNamePath,
        categoryDisplayNamePathSeparator: categoryDisplayNamePathSeparator,
        userCurrency: userCurrency,
        userCurrencySymbol: userCurrencySymbol
    });

    enableInsights(algoliaData.applicationID, algoliaData.searchApiKey);
});
