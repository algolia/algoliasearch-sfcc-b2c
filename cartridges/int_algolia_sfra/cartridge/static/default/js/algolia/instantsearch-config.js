/* global instantsearch */

function enableInstantSearch(config) {
    var initialUiState = {};
    initialUiState[config.productsIndex] = {
        query: config.urlQuery,
        hierarchicalMenu: {
            "__primary_category.0": (config.categoryDisplayNamePath || '').split(config.categoryDisplayNamePathSeparator),
        },
    };

    var search = instantsearch({
        indexName: config.productsIndex,
        searchClient: config.searchClient,
        initialUiState: initialUiState,
        insightsClient: window.aa
    });


    if (document.querySelector('#algolia-searchbox-placeholder')) {
        search.addWidgets([
            instantsearch.widgets.configure({
                distinct: true,
                hitsPerPage: 3 * 3,
                clickAnalytics: true
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
                cssClasses: {
                    form: 'form-inline flex-nowrap',
                    input: 'form-control form-control-sm',
                    separator: 'mx-1',
                    submit: 'btn',
                },
                panelTitle: algoliaData.strings.pricePanelTitle
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
                    root: 'col-12',
                    list: 'row product-grid',
                    item: 'col-6 col-sm-4',
                    loadMore: 'btn btn-outline-primary col-12 col-sm-4 my-4 d-block mx-auto'
                },
                templates: {
                    showMoreText: algoliaData.strings.moreResults,
                    empty: '',
                    item: ''
                        + '<div class="product" ' +
                        +'     data-pid="{{objectID}}"'
                        + '     data-query-id="{{__queryID}}"'
                        + '     data-index-name="{{__indexName}}"'
                        + '     {{#helpers.insights}}{ "method": "clickedObjectIDsAfterSearch", "payload": {"eventName": "Click on product"} }{{/helpers.insights}}'
                        + '>'
                        + '    <div class="product-tile">'
                        + '        {{#image}}'
                        + '        <div class="image-container">'
                        + '            <a href="{{url}}">'
                        + '              <img class="tile-image" src="{{image.dis_base_link}}" alt="{{image.alt}}" title="{{name}}"/>'
                        + '            </a>'
                        + '            <a class="quickview hidden-sm-down" href="{{quickShowUrl}}"  data-toggle="modal" data-target="#quickViewModal" title="{{name}}" aria-label="{{name}}"  data-query-id="{{__queryID}}" data-object-id="{{objectID}}" data-index-name="{{__indexName}}">'
                        + '               <span class="fa-stack fa-lg">'
                        + '                 <i class="fa fa-circle fa-inverse fa-stack-2x"></i>'
                        + '                 <i class="fa fa-expand fa-stack-1x"></i>'
                        + '               </span>'
                        + '            </a>'
                        + '        </div>'
                        + '        {{/image}}'
                        + '        <div class="tile-body">'
                        + '            <div class="pdp-link">'
                        + '                <a href="{{url}}">'
                        + '                   {{#helpers.highlight}}{ "attribute": "name" }{{/helpers.highlight}}'
                        + '                </a>'
                        + '            </div>'
                        + '            <div class="price">'
                        + '                {{#promotionalPrice}}'
                        + '                    <span class="strike-through list">'
                        + '                         <span class="value"> {{currencySymbol}} {{price}} </span>'
                        + '                    </span>'
                        + '                    <span class="sales">'
                        + '                        <span class="value">'
                        + '                            {{currencySymbol}} {{promotionalPrice}}'
                        + '                        </span>'
                        + '                    </span>'
                        + '                {{/promotionalPrice}}'
                        + '                {{^promotionalPrice}}'
                        + '                {{#price}}'
                        + '                <span class="sales">'
                        + '                    <span class="value"> {{currencySymbol}} {{price}} </span>'
                        + '                </span>'
                        + '                {{/price}}'
                        + '                {{/promotionalPrice}}'
                        + '            </div>'
                        + '        </div>'
                        + '    </div>'
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
    
    
                        item.quickShowUrl = algoliaData.quickViewUrlBase + '?pid=' + item.id;
    
                        // originating index
                        item.__indexName = config.productsIndex;
    
                        // url with queryID (used for analytics)
                        item.url = item.url
                            + '&queryID=' + item.__queryID
                            + '&objectID=' + item.objectID
                            + '&indexName=' + item.__indexName;
    
                        return item;
                    });
                }
            })
        ]);
    }

    if (document.querySelector('#algolia-category-title-placeholder')) {
        search.addWidgets([
            instantsearch.widgets.breadcrumb({
                container: '#algolia-category-title-placeholder',
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
