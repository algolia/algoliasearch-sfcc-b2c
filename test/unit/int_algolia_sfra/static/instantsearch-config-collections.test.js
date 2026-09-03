'use strict';

const algoliasearchHelper = require('algoliasearch-helper');

const {
    PRODUCTS_INDEX,
    CONTENTS_INDEX,
    runEnableInstantSearch,
    findPanelWidget,
} = require('./instantsearchConfigMocks');

const SearchParameters = algoliasearchHelper.SearchParameters;
const SearchResults = algoliasearchHelper.SearchResults;

/**
 * Builds the search response shape the helper expects.
 * @param {Object} facets The `facets` object of the response
 * @returns {Object} A single search result
 */
function searchResponse(facets) {
    return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 20,
        exhaustiveNbHits: true,
        exhaustiveFacetsCount: true,
        query: '',
        params: '',
        index: PRODUCTS_INDEX,
        processingTimeMS: 1,
        facets: facets,
    };
}

/**
 * Builds SearchResults for a state carrying the collections menu and the brand refinement list,
 * which is the widget pair the panel visibility check has to serve.
 * @param {Object} facets The `facets` object the engine returned
 * @returns {SearchResults} The results
 */
function resultsFor(facets) {
    const state = new SearchParameters({ index: PRODUCTS_INDEX })
        .addHierarchicalFacet({ name: '_collections', attributes: ['_collections'] })
        .addDisjunctiveFacet('brand');
    return new SearchResults(state, [searchResponse(facets)]);
}

describe('collections refinement', () => {
    it('registers a single-select menu on _collections in its own panel', () => {
        const { captured, algoliaData } = runEnableInstantSearch();

        const panel = findPanelWidget(captured.widgets, 'menu', '_collections');
        expect(panel).toBeDefined();

        const options = panel.widget.options;
        expect(options.container).toBe('#algolia-collections-list-placeholder');
        expect(options.panelTitle).toBe(algoliaData.strings.collectionsPanelTitle);
    });

    it('raises the value limit above the menu widget default of 10', () => {
        const { captured } = runEnableInstantSearch();

        const options = findPanelWidget(captured.widgets, 'menu', '_collections').widget.options;
        expect(options.limit).toBe(20);
        expect(options.showMore).toBe(true);
        expect(options.showMoreLimit).toBe(100);
    });

    it('registers the panel on a category page as well as on the search page', () => {
        const { captured } = runEnableInstantSearch({ config: { categoryId: 'womens-clothing-tops' } });

        expect(findPanelWidget(captured.widgets, 'menu', '_collections')).toBeDefined();
    });

    it('labels the show more control from the localized strings', () => {
        const { captured, algoliaData } = runEnableInstantSearch();

        const templates = findPanelWidget(captured.widgets, 'menu', '_collections').widget.options.templates;
        expect(templates.showMoreText({ isShowingMore: false })).toBe(algoliaData.strings.showMore);
        expect(templates.showMoreText({ isShowingMore: true })).toBe(algoliaData.strings.showLess);
    });
});

describe('collections panel visibility', () => {
    /**
     * Reads the `hidden` callback the panel was built with.
     * @param {string} type Wrapped widget type
     * @param {string} attribute Refined attribute
     * @returns {Function} The callback
     */
    function hiddenCallbackFor(type, attribute) {
        const { captured } = runEnableInstantSearch();
        return findPanelWidget(captured.widgets, type, attribute).panelParams.hidden;
    }

    it('hides the panel on an index that returns no collections', () => {
        // An index that does not declare _collections in attributesForFaceting answers a facet request
        // for it with an empty facets object. The helper then leaves the hierarchical facet's data null.
        const results = resultsFor({});
        const collectionsFacet = results.hierarchicalFacets.find(function (facet) {
            return facet.name === '_collections';
        });
        expect(collectionsFacet.data).toBeNull();

        expect(hiddenCallbackFor('menu', '_collections')({ results: results })).toBe(true);
    });

    it('shows the panel once the index carries collections', () => {
        const results = resultsFor({ _collections: { 'Summer Sale': 12, 'Staff Picks': 3 } });

        expect(hiddenCallbackFor('menu', '_collections')({ results: results })).toBe(false);
    });

    it('keeps the existing refinement list panels visible, whose facet data is an object rather than an array', () => {
        // Guards the shared withPanel check: a disjunctive facet's data is keyed by value, so a length
        // test would hide every refinement list panel.
        const results = resultsFor({ brand: { Apple: 4 } });

        expect(hiddenCallbackFor('refinementList', 'brand')({ results: results })).toBe(false);
    });
});

describe('show more button', () => {
    // The list widgets render the button whenever showMore is on and only disable it once the facet
    // holds no more values than the widget already lists, so the panel wrappers hide it in that state.

    it('hides itself on the collections menu', () => {
        const { captured } = runEnableInstantSearch();

        const options = findPanelWidget(captured.widgets, 'menu', '_collections').widget.options;
        expect(options.cssClasses.disabledShowMore).toBe('d-none');
    });

    it('hides itself on the store availability list, keeping its styling hook', () => {
        const { captured } = runEnableInstantSearch();

        const options = findPanelWidget(captured.widgets, 'refinementList', 'storeAvailability').widget.options;
        expect(options.cssClasses.disabledShowMore).toBe('d-none');
        expect(options.cssClasses.showMore).toBe('store-facet-show-more');
    });

    it('leaves widgets that do not offer a show more button untouched', () => {
        const { captured } = runEnableInstantSearch();

        const options = findPanelWidget(captured.widgets, 'refinementList', 'brand').widget.options;
        expect(options.cssClasses).toBeUndefined();
    });

    it('hides the more results button on the product grid once the last page is reached', () => {
        const { captured } = runEnableInstantSearch();

        const hits = captured.widgets.find(function (widget) {
            return widget && widget.type === 'infiniteHits';
        });
        expect(hits.options.cssClasses.disabledLoadMore).toBe('d-none');
    });
});

describe('collections URL mapping', () => {
    /**
     * Reads the state mapping the search instance was built with.
     * @returns {Object} `{ stateToRoute, routeToState }`
     */
    function stateMapping() {
        const { captured } = runEnableInstantSearch();
        return captured.searchOptions.routing.stateMapping;
    }

    it('writes the selected collection to the collection route key', () => {
        const uiState = {};
        uiState[PRODUCTS_INDEX] = { menu: { _collections: 'Summer Sale' } };

        expect(stateMapping().stateToRoute(uiState).collection).toBe('Summer Sale');
    });

    it('leaves the collection route key out when nothing is selected', () => {
        const uiState = {};
        uiState[PRODUCTS_INDEX] = { query: 'jacket' };

        expect(stateMapping().stateToRoute(uiState)).not.toHaveProperty('collection');
    });

    it('reads the collection route key back into the menu state', () => {
        const ui = stateMapping().routeToState({ collection: 'Summer Sale' });

        expect(ui[PRODUCTS_INDEX].menu).toEqual({ _collections: 'Summer Sale' });
    });

    it('keeps the first value only, because the menu is single-select', () => {
        const ui = stateMapping().routeToState({ collection: ['Summer Sale', 'Staff Picks'] });

        expect(ui[PRODUCTS_INDEX].menu).toEqual({ _collections: 'Summer Sale' });
    });

    it('carries the collection alongside a query and a category refinement', () => {
        const mapping = stateMapping();
        const ui = mapping.routeToState({ q: 'jacket', category: ['Womens', 'Clothing'], collection: 'Summer Sale' });

        expect(ui[PRODUCTS_INDEX].query).toBe('jacket');
        expect(ui[PRODUCTS_INDEX].hierarchicalMenu['__primary_category.0']).toEqual(['Womens', 'Womens > Clothing']);
        expect(ui[PRODUCTS_INDEX].menu).toEqual({ _collections: 'Summer Sale' });
        expect(ui[CONTENTS_INDEX]).toEqual({ query: 'jacket' });
    });

    it('survives a round trip through the mapping', () => {
        const mapping = stateMapping();
        const uiState = {};
        uiState[PRODUCTS_INDEX] = { menu: { _collections: 'Été / Soldes' } };

        const route = mapping.stateToRoute(uiState);
        expect(mapping.routeToState(route)[PRODUCTS_INDEX].menu).toEqual({ _collections: 'Été / Soldes' });
    });

    it('owns the collection parameter in the URL, and leaves unrelated parameters alone', () => {
        const { captured } = runEnableInstantSearch();
        const qsModule = {
            parse: function () {
                return { collection: 'Old Collection', utm_source: 'newsletter' };
            },
            stringify: function (params) {
                return Object.keys(params)
                    .map(function (key) {
                        return key + '=' + encodeURIComponent(params[key]);
                    })
                    .join('&');
            },
        };

        const href = captured.routerOptions.createURL({
            qsModule: qsModule,
            location: { href: 'https://example.com/s/RefArch/search?collection=Old%20Collection&utm_source=newsletter' },
            routeState: { collection: 'Summer Sale' },
        });

        expect(href).toContain('collection=Summer%20Sale');
        expect(href).not.toContain('Old%20Collection');
        expect(href).toContain('utm_source=newsletter');
    });
});
