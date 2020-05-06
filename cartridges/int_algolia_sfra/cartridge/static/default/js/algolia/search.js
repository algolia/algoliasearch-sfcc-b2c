
document.addEventListener('DOMContentLoaded', function () {
	/* global instantsearch algoliasearch autocomplete  */
    var $suggestionsWrapper = $('#suggestions-wrapper');
	var locale = $suggestionsWrapper.data('locale');   // en_US
	var userCurrency = $suggestionsWrapper.data('currencycode');   // USD
	var urlCategoryId = $suggestionsWrapper.data('category');  // category ID - for category page - URL param: cgid
	var urlQuery = $suggestionsWrapper.data('q');        // onload search query - for search page - URL param: q

	var productsIndex = 'zzrk_018_sandbox_us01_dx__Algolia_SFRA__products__default'; // $suggestionsWrapper.data('categoriesindexid');
	var categoriesIndex = 'zzrk_008_sandbox_us01_dx__Algolia-SFRA__categories__default'; // $suggestionsWrapper.data('productsindexid');

	var appId = $suggestionsWrapper.data('appid');
	var searchApiKey = $suggestionsWrapper.data('searchapikey');
	var searchClient = algoliasearch(appId, searchApiKey);

	// autocomplete
	autocomplete('#aa-search-input', {}, [
	  {
	    source: autocomplete.sources.hits(searchClient.initIndex(productsIndex), {
	      hitsPerPage: 3,
	      distinct: true,
	    }),
	    displayKey: 'products',
	    name: 'products',
	    templates: {
	      header: '<div class="aa-suggestions-category">Products</div>',
	      suggestion({ url, _highlightResult }) {
	        return `<a href="${url}">${_highlightResult.name.value}</a>`;
	      },
	    },
	  },
	  {
	    source: autocomplete.sources.hits(searchClient.initIndex(categoriesIndex), {
	      hitsPerPage: 3,
	      distinct: true,
	    }),
	    displayKey: 'categories',
	    name: 'categories',
	    templates: {
	      header: '<div class="aa-suggestions-category">Categories</div>',
	      suggestion({ url, _highlightResult }) {
	        return `<a href="${url}">${_highlightResult.name.value}</a>`;
	      },
	    },
	  },
	]);

	// search page
	var search = instantsearch({
	  indexName: productsIndex,
	  searchClient,
	  routing: routing(),
	});
	search.addWidgets([
	  instantsearch.widgets.configure({
	    distinct: true,
	  }),
	  instantsearch.widgets.searchBox({
	    container: '#searchbox',
	  }),
	  instantsearch.widgets.clearRefinements({
	    container: '#clear-refinements',
	    includedAttributes: ['query']
	  }),
	  instantsearch.widgets.menu({
	    container: '#categories-list',
	    attribute: 'primary_category_id',
	  }),
	  instantsearch.widgets.rangeInput({
	    container: '#price-filter',
	    attribute: `price.${userCurrency}`,
	  }),
	  instantsearch.widgets.hits({
	    container: '#hits',
	    templates: {
	      item: item => `
	        <div>
	          <div class="hit-name">${item.name}</div>
	      
	          <div class="hit-price">${
	            item.price ? item.price[userCurrency] : ''
	          }</div>
	        </div>
	      `,
	    },
	  }),
	  instantsearch.widgets.pagination({
	    container: '#pagination',
	  }),
	]);

	search.start();

	function routing() {
	  /*
	  function getCategoryName(categoryId) {
	    return categoryId;
	  }
	  function getCategorySlug(categoryId) {
	    return categoryId;
	  }
	  */

	  return {
	    stateMapping: {
	      stateToRoute(uiState) {
	        var indexUiState = uiState[productsIndex] || {};

	        return {
	          query: indexUiState.query,
	          page: indexUiState.page,
	          brands:
	            indexUiState.refinementList && indexUiState.refinementList.brand,
	          category: indexUiState.menu && indexUiState.menu.primary_category_id,
	        };
	      },

	      routeToState(routeState) {
	        return {
	          [productsIndex]: {
	            query: urlQuery ? urlQuery : routeState.query,
	            page: routeState.page,
	            menu: {
	              primary_category_id: urlCategoryId
	                ? urlCategoryId
	                : routeState.categories,
	            },
	            refinementList: {
	              brand: routeState.brands,
	            },
	          },
	        };
	      },
	    },
	  };
	}

});