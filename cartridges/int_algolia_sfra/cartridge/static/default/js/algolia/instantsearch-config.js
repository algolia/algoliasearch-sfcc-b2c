/* global instantsearch, algoliaData */
/* exported enableInstantSearch */
/**
 * Initializes InstantSearch
 * @param {Object} config Configuration object
 */

var activeCustomerPromotions = [];

/**
 * Initializes InstantSearch
 * @param {Object} config Configuration object
 */
function enableInstantSearch(config) {
    const productsIndex = algoliaData.productsIndex;
    const contentsIndex = algoliaData.contentsIndex;
    const enableContentSearch = algoliaData.enableContentSearch;
    const productsIndexPriceAsc = productsIndex + '__price_' + algoliaData.currencyCode + '_asc';
    const productsIndexPriceDesc = productsIndex + '__price_' + algoliaData.currencyCode + '_desc';
    const contentResultEl = document.querySelector('#algolia-content-hits-placeholder');
    const contentSearchbarTab = document.querySelector('#content-search-bar-button');
    const navbar = document.querySelector('.search-nav');
    const activeCustomerPromotionsEl = document.querySelector('#algolia-activePromos');
    const isPricingLazyLoad = algoliaData.EnablePricingLazyLoad;
    activeCustomerPromotions = JSON.parse(activeCustomerPromotionsEl.dataset.promotions);

    let displaySwatches = false;
    var initialUiState = {};
    var hierarchicalMenuValue = {};
    if (config.categoryDisplayNamePath && config.categoryDisplayNamePath.indexOf('New Arrivals') > -1) {
        hierarchicalMenuValue = {
            "newArrivalsCategory.0": (config.categoryDisplayNamePath || '').split(config.categoryDisplayNamePathSeparator),
        }
    } else {
        hierarchicalMenuValue = {
            "__primary_category.0": (config.categoryDisplayNamePath || '').split(config.categoryDisplayNamePathSeparator),
        }
    }
    initialUiState[productsIndex] = {
        query: config.urlQuery,
        hierarchicalMenu: hierarchicalMenuValue,
    };

    initialUiState[contentsIndex] = {
        query: config.urlQuery,
    };

    var search = instantsearch({
        indexName: productsIndex,
        searchClient: config.searchClient,
        initialUiState: initialUiState,
        routing: true,
    });

    if (algoliaData.enableInsights) {
        const insightsMiddleware = instantsearch.middlewares.createInsightsMiddleware();
        search.use(insightsMiddleware);
    }

    if (document.querySelector('#algolia-searchbox-placeholder')) {
        if (config.categoryId) {
            // Category page: filter on categoryPageId
            // doc: https://www.algolia.com/doc/guides/solutions/ecommerce/browse/tutorials/category-pages/
            search.addWidgets([
                instantsearch.widgets.configure({
                    filters: `categoryPageId: '${config.categoryId}'`,
                }),
            ]);
        } else {
            // Search results page: display the categories hierarchy and the "Reset" button
            search.addWidgets([
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
                        item(data, { html }) {
                            return html`
                                <a class="${data.cssClasses.link}" href="${data.url}" style="white-space: nowrap; ${data.isRefined ? 'font-weight: bold;' : ''}">
                                    <i class="fa ${data.isRefined ? 'fa-check-circle' : 'fa-circle-o'}"></i>
                                    <span class="${data.cssClasses.label}"> ${data.label}</span>
                                </a>
                            `
                        },
                    },
                    panelTitle: algoliaData.strings.categoryPanelTitle
                }),
                hierarchicalMenuWithPanel({
                    container: '#algolia-newarrivals-list-placeholder',
                    attributes: ['newArrivalsCategory.0', 'newArrivalsCategory.1'],
                    templates: {
                        item(data, { html }) {
                            return html`
                            <a class="${data.cssClasses.link}" href="${data.url}" style="white-space: nowrap; ${data.isRefined ? 'font-weight: bold;' : ''}">
                                <i class="fa ${data.isRefined ? 'fa-check-circle' : 'fa-circle-o'}"></i>
                                <span class="${data.cssClasses.label}"> ${data.label}</span>
                            </a>
                        `
                        },
                    },
                    panelTitle: algoliaData.strings.newArrivals
                }),
            ]);
        }

        search.addWidgets([
            instantsearch.widgets.configure({
                distinct: true,
                hitsPerPage: 3 * 3,
            }),
            instantsearch.widgets.searchBox({
                container: '#algolia-searchbox-placeholder',
                cssClasses: {
                    root: 'refinement',
                    input: 'form-control',
                },
                placeholder: algoliaData.strings.placeholder,
                showSubmit: false,
            }),
            instantsearch.widgets.stats({
                container: '#algolia-stats-placeholder',
                templates: {
                    text(data) {
                        if (contentSearchbarTab) {
                            const productLength = data.nbHits;
                            const productCountEl = document.querySelector('#ai-product-count');
                            productCountEl.innerHTML = ' (' + productLength + ')';
                        }
                        if (data.hasManyResults) {
                            return `${data.nbHits} ${algoliaData.strings.results}`;
                        } else if (data.hasOneResult) {
                            return `1 ${algoliaData.strings.result}`;
                        } else {
                            return algoliaData.strings.noResults;
                        }
                    },
                }
            }),
            instantsearch.widgets.sortBy({
                container: '#algolia-sort-by-placeholder',
                cssClasses: {
                    select: 'custom-select'
                },
                items: [
                    {label: algoliaData.strings.bestMatches, value: productsIndex},
                    {label: algoliaData.strings.priceAsc, value: productsIndexPriceAsc},
                    {label: algoliaData.strings.priceDesc, value: productsIndexPriceDesc}
                ]
            }),

            refinementListWithPanel({
                container: '#algolia-brand-list-placeholder',
                attribute: 'brand',
                templates: {
                    item(data, { html }) {
                        return html`
                            <a class="${data.cssClasses.link}" href="${data.url}" style="white-space: nowrap; ${data.isRefined ? 'font-weight: bold;' : ''}">
                                <i class="fa ${data.isRefined ? 'fa-check-square' : 'fa-circle-o'}"></i>
                                <span class="${data.cssClasses.label}"> ${data.label}</span>
                            </a>
                        `
                    },
                },
                panelTitle: algoliaData.strings.brandPanelTitle
            }),

            rangeInputWithPanel({
                container: '#algolia-price-filter-placeholder',
                attribute: (algoliaData.recordModel === 'master-level' ? 'variants.price.' : 'price.') +
                    algoliaData.currencyCode,
                cssClasses: {
                    form: 'flex-nowrap',
                    input: 'form-control form-control-sm',
                    separator: 'mx-1',
                    submit: 'btn',
                },
                panelTitle: algoliaData.strings.pricePanelTitle,
                templates: {
                    separatorText: algoliaData.strings.priceFilter.separator,
                    submitText: algoliaData.strings.priceFilter.submit
                }
            }),

            refinementListWithPanel({
                container: '#algolia-size-list-placeholder',
                attribute: algoliaData.recordModel === 'master-level' ? 'variants.size' : 'size',
                templates: {
                    item(data, { html }) {
                        return html`
                            <a class="${data.cssClasses.link}" href="${data.url}" style="white-space: nowrap; ${data.isRefined ? 'font-weight: bold;' : ''}">
                                <i class="fa ${data.isRefined ? 'fa-check-square' : 'fa-circle-o'}"></i>
                                <span class="${data.cssClasses.label}"> ${data.label}</span>
                            </a>
                        `
                    },
                },
                panelTitle: algoliaData.strings.sizePanelTitle
            }),

            refinementListWithPanel({
                container: '#algolia-color-list-placeholder',
                attribute: algoliaData.recordModel === 'master-level' ? 'variants.color' : 'color',
                templates: {
                    item(data, { html }) {
                        return html`
                            <a class="${data.cssClasses.link}" href="${data.url}" style="white-space: nowrap; ${data.isRefined ? 'font-weight: bold;' : ''}">
                                <i class="fa ${data.isRefined ? 'fa-check-square' : 'fa-circle-o'}"></i>
                                <span class="${data.cssClasses.label}"> ${data.label}</span>
                            </a>
                        `
                    },
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
                    item(hit, { html, components }) {
                        const shouldHideCallout = isPricingLazyLoad || !hit.calloutMsg;
                        const productId = algoliaData.recordModel === 'master-level' ? (hit.defaultVariantID ? hit.defaultVariantID : hit.objectID) : hit.objectID;
                        const callOutMsgClassname = `callout-msg-placeholder-${productId}`;
                        return html`
                            <div class="product"
                                 data-pid="${hit.objectID}"
                                 data-query-id="${hit.__queryID}"
                                 data-index-name="${hit.__indexName}"
                            >
                                <div class="product-tile">
                                    <small class="callout-msg ${shouldHideCallout ? 'd-none' : ''} ${callOutMsgClassname}">
                                     ${!isPricingLazyLoad && hit.calloutMsg}
                                    </small>
                                    <div class="image-container">
                                        <a href="${hit.url}">
                                            <img class="tile-image" src="${hit.image.dis_base_link}" alt="${hit.image.alt}" title="${hit.name}"/>
                                        </a>
                                        <a class="quickview hidden-sm-down" href="${hit.quickShowUrl}"
                                           data-toggle="modal" data-target="#quickViewModal" title="${hit.name}"
                                           aria-label="${hit.name}" data-query-id="${hit.__queryID}"
                                           data-object-id="${hit.objectID}" data-index-name="${hit.__indexName}"
                                        >
                                            <span class="fa-stack fa-lg">
                                                <i class="fa fa-circle fa-inverse fa-stack-2x"></i>
                                                <i class="fa fa-expand fa-stack-1x"></i>
                                            </span>
                                        </a>
                                    </div>
                                    <div class="tile-body">
                                        ${displaySwatches && html`
                                            <div class="color-swatches">
                                                <div class="swatches">
                                                    ${renderSwatches(hit, html)}
                                                </div>
                                            </div>
                                        `}
                                        <div class="pdp-link">
                                            <a href="${hit.url}">
                                                ${components.Highlight({hit, attribute: 'name'})}
                                            </a>
                                        </div>
                                        <div class="price">
                                            ${isPricingLazyLoad && html`<span class="price-placeholder" data-product-id="${productId}"></span>`}
                                            ${!isPricingLazyLoad && hit.strikeoutPrice && html`
                                                <span class="strike-through list">
                                                    <span class="value"> ${hit.currencySymbol} ${hit.strikeoutPrice} </span>
                                                </span>
                                            `}
                                            ${!isPricingLazyLoad && html`
                                                <span class="sales">
                                                    <span class="value">
                                                        ${hit.currencySymbol} ${hit.displayPrice}
                                                    </span>
                                                </span>
                                            `}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }, 
                },
                transformItems: function (items, { results }) {
                    displaySwatches = false;

                    return items.map(function (item) {
                        // assign image
                        if (item.image_groups) {
                            const imageGroup = item.image_groups.find(function (i) {
                                return i.view_type === 'large'
                            }) || item.image_groups[0];
                            if (imageGroup) {
                                var firstImageInGroup = imageGroup.images[0];
                                item.image = firstImageInGroup
                            }
                        } else {
                            item.image = {
                                dis_base_link: algoliaData.noImages.large,
                                alt: item.name + ', large',
                            }
                        }

                        // adjusted promotionalPrice in user currency
                        if (item.promotionalPrice && item.promotionalPrice[algoliaData.currencyCode] !== null) {
                            item.promotionalPrice = item.promotionalPrice[algoliaData.currencyCode]
                        }

                        // price in user currency
                        if (item.price && item.price[algoliaData.currencyCode] !== null) {
                            item.price = item.price[algoliaData.currencyCode]
                        }

                        // currency symbol
                        item.currencySymbol = algoliaData.currencySymbol;
                        item.quickShowUrl = algoliaData.quickViewUrlBase + '?pid=' + (item.masterID || item.objectID);
                        // originating index
                        item.__indexName = productsIndex;
                        // url with queryID (used for analytics)
                        if (item.url) {
                            item.url = generateProductUrl({
                                objectID: item.objectID,
                                productUrl: item.url,
                                queryID: item.__queryID,
                                indexName: item.__indexName,
                            });
                        }

                        if (item.colorVariations) {
                            // Display the swatches only if at least one item has some colorVariations
                            displaySwatches = true;
                            item.colorVariations.forEach(colorVariation => {
                                colorVariation.variationURL = generateProductUrl({
                                    objectID: item.objectID,
                                    productUrl: colorVariation.variationURL,
                                    queryID: item.__queryID,
                                    indexName: item.__indexName,
                                });
                            });
                        }

                        // Master-level indexing: variant selection
                        let selectedVariant = null;
                        if (item.variants) {
                            const sizeFacets = results._state.disjunctiveFacetsRefinements['variants.size'] || [];
                            const colorFacets = results._state.disjunctiveFacetsRefinements['variants.color'] || [];

                            if (colorFacets.length > 0 && sizeFacets.length > 0) {
                                selectedVariant = item.variants.find(variant => {
                                    return sizeFacets.includes(variant.size) && colorFacets.includes(variant.color);
                                });
                            }
                            if (!selectedVariant && colorFacets.length > 0) {
                                selectedVariant = item.variants.find(variant => {
                                    return colorFacets.includes(variant.color)
                                });
                            }
                            if (!selectedVariant && sizeFacets.length > 0) {
                                selectedVariant = item.variants.find(variant => {
                                    return sizeFacets.includes(variant.size)
                                });
                            }
                            if (!selectedVariant) {
                                selectedVariant = item.variants.find(variant => {
                                    return variant.variantID === item.defaultVariantID;
                                }) || item.variants[0];
                            }

                            if (!item.color) {
                                // This permits to highlight the correct swatch
                                item.color = selectedVariant.color;
                            }

                            // 2. Get the colorVariation corresponding to the selected variant, to display its image
                            if (item.colorVariations) {
                                const colorVariation = item.colorVariations.find(i => {
                                    return selectedVariant && i.color === selectedVariant.color
                                }) || item.colorVariations[0];
                                const imageGroup = colorVariation.image_groups.find(i => {
                                    return i.view_type === 'large'
                                }) || colorVariation.image_groups[0];
                                if (imageGroup) {
                                    item.image = imageGroup.images[0];
                                }
                            }

                            // Override item prices if variant-level data is present
                            if (selectedVariant) {
                                if (selectedVariant.promotionalPrice && selectedVariant.promotionalPrice[algoliaData.currencyCode] !== null) {
                                    item.promotionalPrice = selectedVariant.promotionalPrice[algoliaData.currencyCode];
                                } else if (selectedVariant.promotionalPrice && typeof selectedVariant.promotionalPrice === 'number') {
                                    // In case it's already in correct currency
                                    item.promotionalPrice = selectedVariant.promotionalPrice;
                                }

                                if (selectedVariant.price && selectedVariant.price[algoliaData.currencyCode] !== null) {
                                    item.price = selectedVariant.price[algoliaData.currencyCode];
                                } else if (selectedVariant.price && typeof selectedVariant.price === 'number') {
                                    item.price = selectedVariant.price;
                                }

                                item.url = selectedVariant.url;
                                // Also apply promotions from variant if available
                                item.promotions = selectedVariant.promotions || item.promotions;
                                item.pricebooks = selectedVariant.pricebooks || item.pricebooks;
                            }
                        }

                        if (!isPricingLazyLoad) {
                            const { displayPrice, strikeoutPrice, calloutMsg } = determinePrices(item, algoliaData, activeCustomerPromotions);
                            item.displayPrice = displayPrice;
                            item.strikeoutPrice = strikeoutPrice;
                            item.calloutMsg = calloutMsg;
                        } else {
                            item.displayPrice = item.price;
                            item.strikeoutPrice = null;
                            item.calloutMsg = '';
                        }

                        return item;
                    });
                }
            })
        ]);

        if (contentResultEl && contentSearchbarTab && enableContentSearch) {
            search.addWidgets([
                instantsearch.widgets
                    .index({
                        indexName: contentsIndex
                    })
                    .addWidgets([
                        instantsearch.widgets.infiniteHits({
                            container: '#algolia-content-hits-placeholder',
                            cssClasses: {
                                root: 'w-100',
                                loadMore: 'btn btn-outline-primary col-12 col-sm-4 my-4 d-block mx-auto'
                            },
                            templates: {
                                item: `
                                    <div class="row">
                                        <div class="col-12">
                                            <div class="card">
                                                <div class="card-header clearfix">
                                                    <h4><a href="{{url}}">{{#helpers.highlight}}{ "attribute": "name" }{{/helpers.highlight}}</a></h4>
                                                </div>
                                                <div class="card-body card-info-group">
                                                    {{description}}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `,
                            },
                            transformItems: function (items) {
                                if (items.length === 0) {
                                    navbar.style.visibility = 'hidden';
                                } else {
                                    navbar.style.visibility = 'visible';
                                }
                                return items;
                            }
                        }),
                        instantsearch.widgets.stats({
                            container: '#ai-content-count',
                            templates: {
                                text(data) {
                                    return ' (' + data.nbHits + ')';
                                },
                            },
                            cssClasses: {
                                root: 'd-inline',
                            },
                        }),
                    ]),
            ]);
        } else {
            navbar.style.visibility = 'hidden';
        }
    }

    search.start();

    search.on('render', function () {
        if (isPricingLazyLoad && search.status === 'idle') {
            var items = search.renderState[algoliaData.productsIndex].infiniteHits.hits;
            var productIDs = items.map((item) => algoliaData.recordModel === 'master-level' ? (item.defaultVariantID ? item.defaultVariantID : item.objectID) : item.objectID);
            fetchPromoPrices(productIDs).then(() => {
                updateAllProductPrices();
            });
        }

        var emptyFacetSelector = '.ais-HierarchicalMenu--noRefinement';
        $(emptyFacetSelector).each(function () {
            $(this).parents().eq(2).hide();
        });
    });

    /**
     * Generates a menu with the Panel widget
     * @param {Object} options Options object
     * @returns {Object} The Panel widget
     */
    function hierarchicalMenuWithPanel(options) {
        return withPanel(options.attributes[0], options.panelTitle)(instantsearch.widgets.hierarchicalMenu)(options)
    }

    /**
     * Builds a refinement list with the Panel widget
     * @param {Object} options Options object
     * @returns {Object} The Panel widget
     */
    function refinementListWithPanel(options) {
        return withPanel(options.attribute, options.panelTitle)(instantsearch.widgets.refinementList)(options)
    }

    /**
     * Builds a range input with the Panel widget
     * @param {Object} options Options object
     * @returns {Object} The Panel widget
     */
    function rangeInputWithPanel(options) {
        return withPanel(options.attribute, options.panelTitle)(instantsearch.widgets.rangeInput)(options)
    }

    /**
     * Builds an InstantSearch Panel widget with the supplied parameters
     * @param {string} attribute Attribute
     * @param {string} panelTitle Title of the Panel
     * @returns {Object} A new InstantSearch Panel
     */
    function withPanel(attribute, panelTitle) {
        return instantsearch.widgets.panel({
            hidden: function(options) {
                var facets = [].concat(options.results.disjunctiveFacets, options.results.hierarchicalFacets)
                var facet = facets.find(function(facet) { return facet.name === attribute }); // eslint-disable-line no-shadow
                var facetExists = !!facet;
                return !facetExists; // hides panel if not facets selectable
            },
            templates: {
                header(options, { html }) {
                    return html`
                        <button class="title btn text-left btn-block d-md-none" aria-controls="refinement-${attribute}" aria-expanded="false">
                            ${panelTitle}
                        </button>
                        <h2 aria-label="${panelTitle}" class="d-none d-md-block">${panelTitle}</h2>
                    `
                }
            },
            cssClasses: {
                root: 'card refinement collapsible-sm overflow-hidden',
                header: 'card-header col-sm-12',
                body: 'card-body content value',
                footer: 'card-footer',
            }

        })
    }

    /**
     * Render the color swatches
     * @param {AlgoliaHit} hit Algolia hit
     * @param {any} html Tagged template
     * @return {any} A color swatch
     */
    function renderSwatches(hit, html) {
        if (hit.colorVariations) {
            return hit.colorVariations.map(colorVariation => {
                let swatch;
                let variantImage;
                if (!colorVariation.image_groups) {
                    return '';
                }
                const displayImageGroup = colorVariation.image_groups.find(group => group.view_type === 'large') || colorVariation.image_groups[0];
                const swatchImageGroup = colorVariation.image_groups.find(group => group.view_type === 'swatch');
                if (swatchImageGroup && displayImageGroup) {
                    swatch = swatchImageGroup.images[0];
                    variantImage = displayImageGroup.images[0];
                } else {
                    return '';
                }

                /* eslint-disable indent */
                return html`
                <a onmouseover="${(e) => {
                    const parent = document.querySelector(`[data-pid="${hit.objectID}"]`);
                    const image = parent.querySelector('.tile-image');
                    const link = parent.querySelector('.image-container > a');
                    // Remove existing border effects
                    const existingSelectedSwatches = parent.querySelectorAll('.swatch-selected');
                    existingSelectedSwatches.forEach(selectedSwatch => {
                        selectedSwatch.classList.remove('swatch-selected');
                    });

                    e.target.parentNode.querySelector('.swatch').classList.add("swatch-selected");
                    image.src = variantImage.dis_base_link;
                    link.href = colorVariation.variationURL;
                }}" href="${colorVariation.variationURL}" aria-label="${swatch.title}">
                    <span>
                        <img class="swatch swatch-circle mb-1 ${colorVariation.color === hit.color ? 'swatch-selected' : ''}"
                             data-index="0.0" style="background-image: url(${swatch.dis_base_link})"
                             src="${swatch.dis_base_link}" alt="${swatch.alt}"
                        />
                    </span>
                    </a>
                `;
                /* eslint-enable indent */
            });
        }
    }
}

// Add this at the top of the file, outside of any function
const fetchedPrices = new Map();

/**
 * Fetches promotional prices for a list of product IDs
 * @param {Array} productIDs - An array of product IDs.
 * @returns {Promise} A promise that resolves when prices are fetched
 */
function fetchPromoPrices(productIDs) {
    if (productIDs.length === 0) return Promise.resolve();

    // Filter out already fetched product IDs
    const unfetchedProductIDs = productIDs.filter(id => !fetchedPrices.has(id));
    
    if (unfetchedProductIDs.length === 0) return Promise.resolve();

    return $.ajax({
        url: algoliaData.priceEndpoint,
        type: 'GET',
        data: {
            pids: unfetchedProductIDs.toString(),
        },
    }).then(function(data) {
        let products = data.products;
        for (let product of products) {
            fetchedPrices.set(product.id, product);
        }
    });
}

/**
 * Updates the price display for all products on the page
 */
function updateAllProductPrices() {
    const pricePlaceholders = document.querySelectorAll('.price-placeholder');

    pricePlaceholders.forEach(placeholder => {
        const productId = placeholder.getAttribute('data-product-id');
        const product = fetchedPrices.get(productId);

        if (product) {
            let priceHtml = getPriceHtml(product);
            placeholder.innerHTML = priceHtml;

            if (product.activePromotion && product.activePromotion.price) {
                const calloutMsg = document.querySelector(`.callout-msg-placeholder-${productId}`);
                if (calloutMsg) {
                    calloutMsg.innerHTML = product.activePromotion.promotion.calloutMsg;
                    calloutMsg.classList.remove('d-none');
                }
            }
        }
    });
}

/**
 * Generates HTML for displaying product prices, including promotional prices if applicable.
 * @param {Object} product - The product object containing price information.
 * @returns {string} HTML string representing the price display.
 */
function getPriceHtml(product) {
    const { price: priceObj, activePromotion, defaultPrice } = product;
    const hasActivePromotion = activePromotion && activePromotion.price;
    const salesPrice = priceObj && priceObj.sales && priceObj.sales.value;
    const listPrice = priceObj && priceObj.list && priceObj.list.value;
    const discountedPrice = hasActivePromotion ? activePromotion.price : salesPrice;

    // Helper function to create price HTML
    const createPriceHtml = (originalPrice, finalPrice) => `
        <span class="strike-through list">
            <span class="value"> ${algoliaData.currencySymbol} ${originalPrice} </span>
        </span>
        <span class="sales">
            <span class="value"> ${algoliaData.currencySymbol} ${finalPrice} </span>
        </span>`;

    if (hasActivePromotion) return createPriceHtml(defaultPrice, discountedPrice);
    if (listPrice) return createPriceHtml(listPrice, salesPrice);

    return `<span class="value"> ${algoliaData.currencySymbol} ${salesPrice} </span>`;
}

/**
 * Build a product URL with Algolia query parameters
 * @param {string} objectID objectID
 * @param {string} productUrl url of the product
 * @param {string} queryID queryID
 * @param {string} indexName indexName
 * @return {string} Final URL of the product
 */
function generateProductUrl({ objectID, productUrl, queryID, indexName }) {
    const url = new URL(productUrl, window.location.origin);
    url.searchParams.append('queryID', queryID);
    url.searchParams.append('objectID', objectID);
    url.searchParams.append('indexName', indexName);
    return url.href;
}

/**
 * Determine final display price, strikeout price, and calloutMsg for an item
 * @param {Object} item The item object
 * @param {Object} algoliaData The Algolia data configuration
 * @param {Array} activeCustomerPromotions The list of active promotions
 * @returns {Object} { displayPrice, strikeoutPrice, calloutMsg }
 */
function determinePrices(item, algoliaData, activeCustomerPromos) {
    let displayPrice = item.price;
    let strikeoutPrice = null;
    let calloutMsg = '';

    if (item.pricebooks && item.pricebooks[algoliaData.currencyCode]) {
        const { computedPrice } = applyPricebooks(item, algoliaData);
        if (computedPrice !== null) {
            if (computedPrice < displayPrice) {
                strikeoutPrice = displayPrice; 
                displayPrice = computedPrice; 
            } else if (computedPrice > displayPrice) {
                // If pricebooks show a higher original price
                strikeoutPrice = computedPrice;
            }
        }
    }

    if (item.promotionalPrice && item.promotionalPrice < item.price) {
        strikeoutPrice = item.price;
        displayPrice = item.promotionalPrice;
    }

    if (item.promotions && item.promotions[algoliaData.currencyCode]) {
        const { promotionalPriceFromPromos, msg } = applyPromotions(item, algoliaData, activeCustomerPromos);
        if (promotionalPriceFromPromos < displayPrice) {
            displayPrice = promotionalPriceFromPromos;
            calloutMsg = msg;
        }
    }

    if (!strikeoutPrice) {
        strikeoutPrice = item.price > displayPrice ? item.price : null;
    }

    return { displayPrice, strikeoutPrice, calloutMsg };
}

/**
 * Apply promotions to find a lower promotional price if available
 * @param {Object} item The item
 * @param {Object} algoliaData The Algolia data config
 * @param {Array} activeCustomerPromotions Active promotions
 * @returns {Object} { promotionalPriceFromPromos, msg }
 */
function applyPromotions(item, algoliaData, activeCustomerPromos) {
    let promotionalPriceFromPromos = item.price;
    let msg = '';

    const productPromos = item.promotions[algoliaData.currencyCode];
    for (var i = 0; i < activeCustomerPromos.length; i++) {
        for (var j = 0; j < productPromos.length; j++) {
            if (productPromos[j].promoId === activeCustomerPromotions[i].id && productPromos[j].price < promotionalPriceFromPromos) {
                promotionalPriceFromPromos = productPromos[j].price;
                msg = activeCustomerPromotions[i].calloutMsg;
            }
        }
    }
    return { promotionalPriceFromPromos, msg };
}

/**
 * Apply pricebooks to adjust prices if no promotional price was found
 * Only consider pricebooks that are currently online
 * @param {Object} item The item
 * @param {Object} algoliaData The Algolia data config
 * @returns {Object} { computedPrice, computedStrikeout }
 */
function applyPricebooks(item, algoliaData) {
    const validPricebooks = item.pricebooks[algoliaData.currencyCode].filter(pricebook => {
        if (pricebook.onlineFrom && pricebook.onlineFrom > Date.now()) {
            return false;
        }
        if (pricebook.onlineTo && pricebook.onlineTo < Date.now()) {
            return false;
        }
        return true;
    });

    if (validPricebooks.length === 0) {
        return { computedPrice: null, computedStrikeout: null };
    }

    const prices = validPricebooks.map(pricebook => pricebook.price);
    const maxPrice = prices.reduce((acc, currentValue) => Math.max(acc, currentValue), -Infinity);
    const minPrice = prices.reduce((acc, currentValue) => Math.min(acc, currentValue), Infinity);

    if (maxPrice > item.price) {
        return { computedPrice: maxPrice, computedStrikeout: item.price };
    }
    if (minPrice < item.price) {
        return { computedPrice: minPrice, computedStrikeout: item.price };
    }

    return { computedPrice: null, computedStrikeout: null };
}
