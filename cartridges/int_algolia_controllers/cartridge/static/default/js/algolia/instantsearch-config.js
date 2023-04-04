/* global instantsearch */
/**
 * Initializes InstantSearch
 * @param {Object} config Configuration object
 */
function enableInstantSearch(config) {
    var initialUiState = {};
    var hierarchicalMenuValue = {};
    if (config.categoryDisplayNamePath && config.categoryDisplayNamePath.indexOf('New Arrivals') > -1) {
        hierarchicalMenuValue = {
            "CATEGORIES_NEW_ARRIVALS.level_0": (config.categoryDisplayNamePath || '').split(config.categoryDisplayNamePathSeparator),
        }
    } else {
        hierarchicalMenuValue = {
            "__primary_category.0": (config.categoryDisplayNamePath || '').split(config.categoryDisplayNamePathSeparator),
        }
    }
    initialUiState[config.productsIndex] = {
        query: config.urlQuery,
        hierarchicalMenu: hierarchicalMenuValue,
    };

    var search = instantsearch({
        indexName: config.productsIndex,
        searchClient: config.searchClient,
        initialUiState: initialUiState,
        insightsClient: window.aa
    });

    // initialize the Insights middleware -- to set userToken, see insights-config.js
    const insightsMiddleware = instantsearch.middlewares.createInsightsMiddleware({
        insightsClient: window.aa,
    });
    search.use(insightsMiddleware);

    if (document.querySelector('#algolia-searchbox-placeholder')) {
        search.addWidgets([
            instantsearch.widgets.configure({
                distinct: true,
                hitsPerPage: 3 * 3,
            }),
            instantsearch.widgets.searchBox({
                container: '#algolia-searchbox-placeholder',
                cssClasses: {
                    root: 'd-none'
                }
            }),
            instantsearch.widgets.stats({
                container: '#algolia-stats-placeholder',
                templates: {
                    text: ''
                        + '{{#hasNoResults}} ' + algoliaData.strings.noResults + ' {{/hasNoResults}} '
                        + '{{#hasOneResult}} 1 ' + algoliaData.strings.result + ' {{/hasOneResult}}'
                        + '{{#hasManyResults}}{{#helpers.formatNumber}}{{nbHits}}{{/helpers.formatNumber}} ' + algoliaData.strings.results + ' {{/hasManyResults}}'
                }
            }),
            instantsearch.widgets.sortBy({
                container: '#algolia-sort-by-placeholder',
                cssClasses: {
                    select: 'custom-select'
                },
                items: [
                    {label: algoliaData.strings.bestMetches, value: config.productsIndex},
                    {label: algoliaData.strings.priceAsc, value: config.productsIndexPriceAsc},
                    {label: algoliaData.strings.priceDesc, value: config.productsIndexPriceDesc}
                ]
            }),
            instantsearch.widgets.clearRefinements({
                container: '#algolia-clear-refinements-placeholder',
                cssClasses: {
                    root: 'secondary-bar col-12 offset-sm-4 offset-md-0 col-sm-4 col-md-12',
                    button: 'btn btn-block btn-outline-primary',
                    disabledButton: 'disabled'
                },
                templates: {
                    resetLabel: algoliaData.strings.reset
                }
            }),

            hierarchicalMenuWithPanel({
                container: '#algolia-categories-list-placeholder',
                attributes: ['__primary_category.0', '__primary_category.1', '__primary_category.2'],
                templates: {
                    item: ''
                        + '<a class="{{cssClasses.link}}" href="{{url}}" style="white-space: nowrap; {{#isRefined}} font-weight: bold; {{/isRefined}}">'
                        + '    {{#isRefined}}'
                        + '      <i class="fa fa-check-circle"></i>'
                        + '    {{/isRefined}}'
                        + '    {{^isRefined}}'
                        + '      <i class="fa fa-circle-o"></i>'
                        + '    {{/isRefined}}'
                        + '    <span class="{{cssClasses.label}}">{{label}}</span>'
                        + '</a>',
                },
                panelTitle: algoliaData.strings.categoryPanelTitle
            }),

            hierarchicalMenuWithPanel({
                container: '#algolia-newarrivals-list-placeholder',
                attributes: ['CATEGORIES_NEW_ARRIVALS.level_0', 'CATEGORIES_NEW_ARRIVALS.level_1'],
                templates: {
                    item: ''
                        + '<a class="{{cssClasses.link}}" href="{{url}}" style="white-space: nowrap; {{#isRefined}} font-weight: bold; {{/isRefined}}">'
                        + '    {{#isRefined}}'
                        + '      <i class="fa fa-check-circle"></i>'
                        + '    {{/isRefined}}'
                        + '    {{^isRefined}}'
                        + '      <i class="fa fa-circle-o"></i>'
                        + '    {{/isRefined}}'
                        + '    <span class="{{cssClasses.label}}">{{label}}</span>'
                        + '</a>',
                },
                panelTitle: algoliaData.strings.newArrivals
            }),

            refinementListWithPanel({
                container: '#algolia-brand-list-placeholder',
                attribute: 'brand',
                templates: {
                    item: ''
                        + '<a class="{{cssClasses.link}}" href="{{url}}" style="white-space: nowrap; {{#isRefined}} font-weight: bold; {{/isRefined}}">'
                        + '    {{#isRefined}}'
                        + '      <i class="fa fa-check-square"></i>'
                        + '    {{/isRefined}}'
                        + '    {{^isRefined}}'
                        + '      <i class="fa fa-square-o"></i>'
                        + '    {{/isRefined}}'
                        + '    <span class="{{cssClasses.label}}">{{label}}</span>'
                        + '</a>',
                },
                panelTitle: algoliaData.strings.brandPanelTitle
            }),

            rangeInputWithPanel({
                container: '#algolia-price-filter-placeholder',
                attribute: 'price.' + config.userCurrency,
                panelTitle: algoliaData.strings.pricePanelTitle,
                templates: {
                    separatorText: algoliaData.strings.priceFilter.separator,
                    submitText: algoliaData.strings.priceFilter.submit
                }
            }),
            refinementListWithPanel({
                container: '#algolia-size-list-placeholder',
                attribute: 'size',
                templates: {
                    item: ''
                        + '<a class="{{cssClasses.link}}" href="{{url}}" style="white-space: nowrap; {{#isRefined}} font-weight: bold; {{/isRefined}}">'
                        + '    {{#isRefined}}'
                        + '      <i class="fa fa-check-square"></i>'
                        + '    {{/isRefined}}'
                        + '    {{^isRefined}}'
                        + '      <i class="fa fa-square-o"></i>'
                        + '    {{/isRefined}}'
                        + '    <span class="{{cssClasses.label}}">{{label}}</span>'
                        + '</a>',
                },
                panelTitle: algoliaData.strings.sizePanelTitle
            }),

            refinementListWithPanel({
                container: '#algolia-color-list-placeholder',
                attribute: 'color',
                templates: {
                    item: ''
                        + '<a class="{{cssClasses.link}}" href="{{url}}" style="white-space: nowrap; {{#isRefined}} font-weight: bold; {{/isRefined}}">'
                        + '    {{#isRefined}}'
                        + '      <i class="fa fa-check-square"></i>'
                        + '    {{/isRefined}}'
                        + '    {{^isRefined}}'
                        + '      <i class="fa fa-square-o"></i>'
                        + '    {{/isRefined}}'
                        + '    <span class="{{cssClasses.label}}">{{label}}</span>'
                        + '</a>',
                },
                panelTitle: algoliaData.strings.colorPanelTitle
            }),

            instantsearch.widgets.infiniteHits({
                container: '#algolia-hits-placeholder',
                cssClasses: {
                    list: 'search-result-items tiles-container clearfix hide-compare ',
                    item: 'grid-tile'
                },
                templates: {
                    showMoreText: algoliaData.strings.moreResults,
                    empty: '',
                    item: ''
                        + '<div class="product-tile" data-itemid="{{objectID}}"' +
                        +'     data-pid="{{objectID}}"'
                        + '     data-query-id="{{__queryID}}"'
                        + '     data-index-name="{{__indexName}}"'
                        + '     {{#helpers.insights}}{ "method": "clickedObjectIDsAfterSearch", "payload": {"eventName": "Click on product"} }{{/helpers.insights}}'
                        + '>'
                        + '        {{#image}}'
                        + '        <div class="product-image">'
                        + '            <a class="thumb-link" href="{{url}}">'
                        + '              <img class="tile-image" src="{{image.dis_base_link}}" alt="{{image.alt}}" title="{{name}}"/>'
                        + '            </a>'
                        + '            <a id="quickviewbutton" class="quickview" href="{{quickShowUrl}}">Quick View<i class="fa fa-arrows-alt"></i></a>'
                        + '        </div>'
                        + '        {{/image}}'
                        + '        <div class="product-name">'
                        + '            <a class="name-link" href="{{url}}" title="{{name}}">'
                        + '               {{#helpers.highlight}}{ "attribute": "name" }{{/helpers.highlight}}'
                        + '            </a>'
                        + '        </div>'
                        + '        <div class="product-pricing">'
                        + '            {{#promotionalPrice}}'
                        + '            <span class="product-standard-price">'
                        + '                {{currencySymbol}} {{price}}'
                        + '            </span>'
                        + '            <span class="product-sales-price">'
                        + '                {{currencySymbol}} {{promotionalPrice}}'
                        + '            </span>'
                        + '            {{/promotionalPrice}}'
                        + '            {{^promotionalPrice}}'
                        + '                {{#price}}'
                        + '                    <span class="product-sales-price">'
                        + '                        {{currencySymbol}} {{price}}'
                        + '                    </span>'
                        + '                {{/price}}'
                        + '            {{/promotionalPrice}}'
                        + '        </div>'
                        + '</div>'
                },
                transformItems: function (items) {
                    return items.map(function (item) {
                        // assign image
                        if (typeof(item.image_groups) === "undefined"){
                            item.image = algoliaData.noImages.large;
                        } else {
                            var imageGroup = item.image_groups.find(function (i) {
                                i.view_type === 'large'
                            }) || item.image_groups[0];
                            if (imageGroup) {
                                var firstImageInGroup = imageGroup.images[0];
                                item.image = firstImageInGroup
                            }
                        }

                        // adjusted price in user currency
                        if (item.promotionalPrice && item.promotionalPrice[config.userCurrency] !== null) {
                            item.promotionalPrice = item.promotionalPrice[config.userCurrency]
                        }

                        // price in user currency
                        if (item.price && item.price[config.userCurrency] !== null) {
                            item.price = item.price[config.userCurrency]
                        }

                        // currency symbol
                        item.currencySymbol = config.userCurrencySymbol;


                        item.quickShowUrl = item.url;

                        // originating index
                        item.__indexName = config.productsIndex;

                        // url with queryID (used for analytics)
                        var url = new URL(item.url);
                        url.searchParams.append('queryID', item.__queryID);
                        url.searchParams.append('objectID', item.objectID);
                        url.searchParams.append('indexName', item.__indexName);
                        item.url = url.href;

                        return item;
                    });
                }
            })
        ]);
    }

    if (document.querySelector('.cat-banner h1')) {
        search.addWidgets([
            instantsearch.widgets.breadcrumb({
                container: '.cat-banner h1',
                attributes: [
                    '__primary_category.0',
                    '__primary_category.1',
                    '__primary_category.2'
                ],
                templates: {
                    home: '',
                    separator: ''
                },
                transformItems: function (items) {
                    return items.slice(-1); // keep only last item
                }
            })
        ])
    }

    $('.cat-banner h1').empty();
    search.start();

    function hierarchicalMenuWithPanel(options) {
        return withPanel(options.attributes[0], options.panelTitle)(instantsearch.widgets.hierarchicalMenu)(options)
    }

    function refinementListWithPanel(options) {
        return withPanel(options.attribute, options.panelTitle)(instantsearch.widgets.refinementList)(options)
    }

    function rangeInputWithPanel(options) {
        return withPanel(options.attribute, options.panelTitle)(instantsearch.widgets.rangeInput)(options)
    }

    function withPanel(attribute, panelTitle) {
        var headerTemplate = Hogan.compile(''
            + '<button class="title btn text-left btn-block d-md-none" aria-controls="refinement-{{attribute}}" aria-expanded="false">'
            + '  {{panelTitle}} '
            + '</button>'
            + '<h2 aria-label="Brand" class="d-none d-md-block">{{ panelTitle }}</h2>'
        );
        return instantsearch.widgets.panel({
            hidden: function(options) {
                var facets = [].concat(options.results.disjunctiveFacets, options.results.hierarchicalFacets)
                var facet = facets.find(function(facet) { return facet.name === attribute });
                var facetExists = !!facet;
                return !facetExists; // hides panel if not facets selectable
              },
            templates: {
                header: headerTemplate.render({ panelTitle: panelTitle, attribute: attribute })
            },
            cssClasses: {
                root: 'card refinement collapsible-sm overflow-hidden',
                header: 'card-header col-sm-12',
                body: 'card-body content value',
                footer: 'card-footer',
              }

        })
    }
}
