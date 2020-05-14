/* global algoliasearch */

document.addEventListener('DOMContentLoaded', function () {
    var $suggestionsWrapper = $('#suggestions-wrapper');
    // var locale = $suggestionsWrapper.data('locale');   // en_US
    var locale = 'default'; // FIXME: only for testing

    var userCurrency = 'USD' // FIXME: $suggestionsWrapper.data('currencycode');
    var userCurrencySymbol = '$';
    var categoryDisplayNamePath = $suggestionsWrapper.data('category-display-name-path');  // path of the current category
    var categoryDisplayNamePathSeparator = $suggestionsWrapper.data('category-display-name-path-separator'); // separator used to serialize the category path (by default: '>')
    var urlQuery = $suggestionsWrapper.data('q'); // onload search query - for search page - URL param: q
    var searchPageRoot = $suggestionsWrapper.data('search-page-root'); // onload search query - for search page - URL param: q


    var productsIndex = 'zzrk_018_sandbox_us01_dx__AlgoliaSFRA_UAT__products__' + locale; // FIXME: algoliaData.productsIndex
    var productsIndexPriceAsc = productsIndex + '__price_' + userCurrency + '_asc';
    var productsIndexPriceDesc = productsIndex + '__price_' + userCurrency + '_desc';

    var categoriesIndex = 'zzrk_019_sandbox_us01_dx__Algolia_SFRA__categories__' + locale; // FIXME: algoliaData.categoriesIndex

    var searchClient = algoliasearch(algoliaData.applicationID, algoliaData.searchApiKey);

    // FIXME: enable insights everywhere
    enableInsights(algoliaData.applicationID, algoliaData.searchApiKey);

    // FIXME: enable autocomplete everywhere
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

});
