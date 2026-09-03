'use strict';

/**
 * Test harness for the SFRA storefront's `instantsearch-config.js`.
 *
 * The file is a browser script with no module exports: it declares `enableInstantSearch` against the
 * `instantsearch` and `algoliaData` globals. It is loaded here by evaluating its source with those
 * globals supplied as arguments, which returns the function so a test can call it and inspect what it
 * registered.
 */

const fs = require('fs');
const path = require('path');

const SOURCE_PATH = path.join(
    __dirname,
    '../../../../cartridges/int_algolia_sfra/cartridge/static/default/js/algolia/instantsearch-config.js'
);

const PRODUCTS_INDEX = 'test_index__RefArch__products__en_US';
const CONTENTS_INDEX = 'test_index__RefArch__contents__en_US';

/**
 * Builds the `algoliaData` global the storefront script reads.
 * @param {Object} [overrides] Properties to merge over the defaults
 * @returns {Object} An algoliaData stand-in
 */
function createAlgoliaData(overrides) {
    return Object.assign(
        {
            version: 'test',
            enable: true,
            enableInsights: false,
            enableContentSearch: false,
            enableRecommend: false,
            EnablePricingLazyLoad: false,
            locale: 'en_US',
            currencyCode: 'USD',
            currencySymbol: '$',
            productsIndex: PRODUCTS_INDEX,
            contentsIndex: CONTENTS_INDEX,
            recordModel: 'variant-level',
            priceEndpoint: '/on/demandware.store/Sites-RefArch-Site/en_US/Algolia-Price',
            quickViewUrlBase: '/on/demandware.store/Sites-RefArch-Site/en_US/Product-ShowQuickView',
            noImages: { large: '/images/noimagelarge.png' },
            strings: {
                placeholder: 'Search',
                moreResults: 'More Results',
                noResults: 'No results',
                result: 'result',
                results: 'results',
                bestMatches: 'Best Matches',
                priceAsc: 'Price (asc)',
                priceDesc: 'Price (desc)',
                reset: 'Reset',
                brandPanelTitle: 'Brand',
                sizePanelTitle: 'Size Chart',
                colorPanelTitle: 'Colors',
                pricePanelTitle: 'Price',
                categoryPanelTitle: 'Category',
                collectionsPanelTitle: 'Collections',
                newArrivals: 'New Arrivals',
                storePanelTitle: 'In Stock at Store',
                showMore: 'Show More',
                showLess: 'Show Less',
                priceFilter: { separator: 'to', submit: 'Go' },
            },
        },
        overrides
    );
}

/**
 * Builds a `document` stand-in that answers the selectors the storefront script looks up.
 * @returns {Object} A document stand-in exposing `querySelector`
 */
function createDocument() {
    const elements = {
        '#algolia-activePromos': { dataset: { promotions: '[]' } },
        '#algolia-storeList': { dataset: { stores: '[]' } },
        '#algolia-searchbox-placeholder': {},
        '.search-nav': { style: {} },
    };

    return {
        querySelector: function (selector) {
            return Object.prototype.hasOwnProperty.call(elements, selector) ? elements[selector] : null;
        },
        querySelectorAll: function () {
            return [];
        },
    };
}

/**
 * Builds an `instantsearch` stand-in that records every widget it is asked to build.
 *
 * Widget factories return plain descriptors instead of real widgets, so a test can assert on the
 * options the configuration passed without running InstantSearch itself. Panels keep the parameters
 * they were built with, which is what makes the `hidden` callback reachable from a test.
 * @returns {Object} An instantsearch stand-in with a `captured` property holding what was registered
 */
function createInstantSearchMock() {
    const captured = {
        searchOptions: null,
        routerOptions: null,
        widgets: [],
    };

    /**
     * Builds a widget factory that records the options it was called with.
     * @param {string} type Widget type, e.g. "menu"
     * @returns {Function} The factory
     */
    function widgetFactory(type) {
        return jest.fn(function (options) {
            return { type: type, options: options };
        });
    }

    const search = {
        addWidgets: jest.fn(function (widgets) {
            captured.widgets = captured.widgets.concat(widgets);
            return search;
        }),
        start: jest.fn(),
        on: jest.fn(),
        use: jest.fn(),
    };

    const instantsearch = jest.fn(function (options) {
        captured.searchOptions = options;
        return search;
    });

    instantsearch.widgets = {
        clearRefinements: widgetFactory('clearRefinements'),
        configure: widgetFactory('configure'),
        searchBox: widgetFactory('searchBox'),
        stats: widgetFactory('stats'),
        sortBy: widgetFactory('sortBy'),
        menu: widgetFactory('menu'),
        hierarchicalMenu: widgetFactory('hierarchicalMenu'),
        refinementList: widgetFactory('refinementList'),
        toggleRefinement: widgetFactory('toggleRefinement'),
        rangeInput: widgetFactory('rangeInput'),
        infiniteHits: widgetFactory('infiniteHits'),
        index: jest.fn(function () {
            return { addWidgets: jest.fn() };
        }),
        panel: jest.fn(function (panelParams) {
            return function (wrappedFactory) {
                return function (widgetOptions) {
                    return {
                        type: 'panel',
                        panelParams: panelParams,
                        widget: wrappedFactory(widgetOptions),
                    };
                };
            };
        }),
    };

    instantsearch.routers = {
        history: jest.fn(function (options) {
            captured.routerOptions = options;
            return { name: 'history', options: options };
        }),
    };

    instantsearch.middlewares = {
        createInsightsMiddleware: jest.fn(function () {
            return { name: 'insights' };
        }),
    };

    instantsearch.connectors = {
        connectMenu: jest.fn(function (renderFn) {
            return function (widgetParams) {
                return { type: 'connectMenu', renderFn: renderFn, options: widgetParams };
            };
        }),
    };

    instantsearch.captured = captured;
    return instantsearch;
}

/**
 * Loads the storefront script and runs `enableInstantSearch` against the supplied stand-ins.
 * @param {Object} [options] Loader options
 * @param {Object} [options.algoliaData] Overrides merged into the default algoliaData
 * @param {Object} [options.config] The config object passed to `enableInstantSearch`
 * @returns {Object} `{ instantsearch, algoliaData, captured }` for assertions
 */
function runEnableInstantSearch(options) {
    const settings = options || {};
    const algoliaData = createAlgoliaData(settings.algoliaData);
    const instantsearch = createInstantSearchMock();
    const source = fs.readFileSync(SOURCE_PATH, 'utf8');

    const load = new Function(
        'instantsearch',
        'algoliaData',
        'document',
        '$',
        source + '\nreturn enableInstantSearch;'
    );

    const enableInstantSearch = load(instantsearch, algoliaData, createDocument(), function () {});
    enableInstantSearch(settings.config || {});

    return {
        instantsearch: instantsearch,
        algoliaData: algoliaData,
        captured: instantsearch.captured,
    };
}

/**
 * Finds the descriptor of a panel-wrapped widget by the attribute it refines.
 * @param {Array} widgets The captured widget list
 * @param {string} type Wrapped widget type, e.g. "menu"
 * @param {string} attribute The `attribute` option the widget was built with
 * @returns {Object|undefined} The panel descriptor, or undefined when it was not registered
 */
function findPanelWidget(widgets, type, attribute) {
    return widgets.find(function (widget) {
        return (
            widget &&
            widget.type === 'panel' &&
            widget.widget.type === type &&
            widget.widget.options.attribute === attribute
        );
    });
}

module.exports = {
    PRODUCTS_INDEX: PRODUCTS_INDEX,
    CONTENTS_INDEX: CONTENTS_INDEX,
    createAlgoliaData: createAlgoliaData,
    createDocument: createDocument,
    createInstantSearchMock: createInstantSearchMock,
    runEnableInstantSearch: runEnableInstantSearch,
    findPanelWidget: findPanelWidget,
};
