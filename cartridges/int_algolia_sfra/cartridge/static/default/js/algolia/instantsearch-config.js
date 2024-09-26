/* global instantsearch */

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

    if (document.querySelector('#algolia-searchbox-placeholder')) {
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
                        return html`
                            <div class="product"
                                 data-pid="${hit.objectID}"
                                 data-query-id="${hit.__queryID}"
                                 data-index-name="${hit.__indexName}"
                            >
                                <div class="product-tile">
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
                                            ${hit.promotionalPrice && html`
                                                <span class="strike-through list">
                                                     <span class="value"> ${hit.currencySymbol} ${hit.price} </span>
                                                </span>
                                            `}
                                            <span class="sales">
                                                <span class="value">
                                                    ${hit.currencySymbol} ${hit.promotionalPrice ? hit.promotionalPrice : hit.price}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `
                    },
                },
                transformItems: function (items, { results }) {
                    displaySwatches = false;
                    return items.map(function (item) {
                        let colorFacets = [];
                        let sizeFacets = [];
                        if (algoliaData.recordModel === 'master-level') {
                            colorFacets = results._state.disjunctiveFacetsRefinements['variants.color'] || [];
                            sizeFacets = results._state.disjunctiveFacetsRefinements['variants.size'] || [];
                        } else {
                            colorFacets = results._state.disjunctiveFacetsRefinements['color'] || [];
                            sizeFacets = results._state.disjunctiveFacetsRefinements['size'] || [];
                        }

                        item.selectedColors = colorFacets;
                        item.selectedSizes = sizeFacets;

                        // assign image
                        if (item.image_groups) {
                            const imageGroup = item.image_groups.find(function (i) {
                                return i.view_type === 'large'
                            }) || item.image_groups[0];
                            if (imageGroup) {
                                item.image = imageGroup.images[0];
                            }
                        } else {
                            item.image = {
                                dis_base_link: algoliaData.noImages.large,
                                alt: item.name + ', large',
                            }
                        }

                        // adjusted price in user currency
                        if (item.promotionalPrice && item.promotionalPrice[algoliaData.currencyCode] !== null) {
                            item.promotionalPrice = item.promotionalPrice[algoliaData.currencyCode]
                        }

                        // price in user currency
                        if (item.price && item.price[algoliaData.currencyCode] !== null) {
                            item.price = item.price[algoliaData.currencyCode]
                        }

                        // If no promotionalPrice, use the pricebooks to display the strikeout price
                        if (!item.promotionalPrice &&
                            item.pricebooks &&
                            item.pricebooks[algoliaData.currencyCode] &&
                            item.pricebooks[algoliaData.currencyCode].length > 0
                        ) {
                            const prices = item.pricebooks[algoliaData.currencyCode].filter(pricebook => {
                                if (pricebook.onlineFrom && pricebook.onlineFrom > Date.now()) {
                                    return false;
                                }
                                if (pricebook.onlineTo && pricebook.onlineTo < Date.now()) {
                                    return false;
                                }
                                return true;
                            }).map(pricebook => pricebook.price);
                            const maxPrice = prices.reduce((acc, currentValue) => {
                                return Math.max(acc, currentValue);
                            });
                            if (maxPrice > item.price) {
                                item.promotionalPrice = item.price;
                                item.price = maxPrice;
                            }
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
                            item.colorVariations.forEach((colorVariation, index) => {
                                colorVariation.variationURL = generateProductUrl({
                                    objectID: item.objectID,
                                    productUrl: colorVariation.variationURL,
                                    queryID: item.__queryID,
                                    indexName: item.__indexName,
                                });
                            });
                            if (colorFacets.length > 0) {
                                const selectedColorVariation = item.colorVariations.find(i => {
                                    return colorFacets.includes(i.color);
                                });
                                if (selectedColorVariation) {
                                    item.image = {
                                        dis_base_link: selectedColorVariation.image_groups[0].images[0].dis_base_link,
                                        alt: selectedColorVariation.image_groups[0].images[0].alt,
                                    }
                                }
                            }
                        }

                        // Master-level indexing
                        if (item.variants) {
                            let price;
                            item.variants.forEach(variant => {
                                price = variant.price[algoliaData.currencyCode]
                                variant.url = generateProductUrl({
                                    objectID: item.objectID,
                                    productUrl: variant.url,
                                    queryID: item.__queryID,
                                    indexName: item.__indexName,
                                });
                            });

                            // 1. Find the variant matching the selected facets, or use the default variant
                            let selectedVariant;

                            ({selectedVariant} = selectVariantBasedOnFacets(item, colorFacets, sizeFacets));

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

                            // 3. Get the variant price
                            if (selectedVariant) {
                                if (selectedVariant.promotionalPrice && selectedVariant.promotionalPrice[algoliaData.currencyCode] !== null) {
                                    item.promotionalPrice = selectedVariant.promotionalPrice[algoliaData.currencyCode];
                                }
                                if (selectedVariant.price && selectedVariant.price[algoliaData.currencyCode] !== null) {
                                    item.price = selectedVariant.price[algoliaData.currencyCode]
                                }
                                item.url = selectedVariant.url;
                            }
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
        let colorFacets = hit.selectedColors || [];
        let sizeFacets = hit.selectedSizes || [];

        const { selectedVariantIndex } = selectVariantBasedOnFacets(hit, colorFacets, sizeFacets);

        if (hit.colorVariations) {
            return hit.colorVariations.map((colorVariation, index) => {
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

                return html`
                <a onmouseover="${(e) => {
        const parent = document.querySelector(`[data-pid="${hit.objectID}"]`);
        const image = parent.querySelector('.tile-image');
        const link = parent.querySelector('.image-container > a');
        image.src = variantImage.dis_base_link;
        link.href = colorVariation.variationURL;
        // Remove existing border effects
        const existingSelectedSwatches = parent.querySelectorAll('.swatch-selected');
        if (existingSelectedSwatches.length > 0) {
            existingSelectedSwatches.forEach(selectedSwatch => {
                selectedSwatch.classList.remove('swatch-selected');
            });
        }
        // Find the closest ancestor that is an 'a' tag
        const swatchLink = e.target.closest('a');
        if (swatchLink) {
            // Add border effect to selected swatch
            swatchLink.querySelector('.swatch-link').classList.add('swatch-selected');
        }
    }}" href="${colorVariation.variationURL}" aria-label="${swatch.title}">
                    <span class="${index === selectedVariantIndex ? 'swatch-selected' : ''} swatch-link">
                        <img class="swatch swatch-circle mb-1" data-index="0.0" style="background-image: url(${swatch.dis_base_link})" src="${swatch.dis_base_link}" alt="${swatch.alt}"/>
                    </span>
                </a>
            `;
            });
        }
    }

    /**
     * Selects a variant or color variation based on facets
     * @param {Object} item - The product item
     * @param {Array} colorFacets - Array of selected color facets
     * @param {Array} sizeFacets - Array of selected size facets
     * @returns {Object} - Selected variant and index
     */
    function selectVariantBasedOnFacets(item, colorFacets, sizeFacets) {
        let selectedVariant;
        let selectedVariantIndex = -1;

        if (algoliaData.recordModel === 'master-level') {
            if (item.variants) {
                if (colorFacets.length > 0 && sizeFacets.length > 0) {
                    selectedVariant = item.variants.find(variant => 
                        sizeFacets.includes(variant.size) && colorFacets.includes(variant.color)
                    );
                }
                if (!selectedVariant && colorFacets.length > 0) {
                    selectedVariant = item.variants.find(variant => 
                        colorFacets.includes(variant.color)
                    );
                }
                if (!selectedVariant && sizeFacets.length > 0) {
                    selectedVariant = item.variants.find(variant => 
                        sizeFacets.includes(variant.size)
                    );
                }
                if (!selectedVariant) {
                    selectedVariant = item.variants.find(variant => 
                        variant.variantID === item.defaultVariantID
                    ) || item.variants[0];
                }
            }

            if (item.colorVariations) {
                const selectedColorVariation = item.colorVariations.find(i => {
                    return selectedVariant && i.color === selectedVariant.color
                }) || item.colorVariations[0];
                selectedVariantIndex = item.colorVariations.indexOf(selectedColorVariation);
            }

            if (selectedVariantIndex === -1) {
                selectedVariantIndex = 0;
            }
        } else {
            if (item.colorVariations) {
                var selectedColorVariation;

                if (colorFacets.length > 0) {
                    selectedColorVariation = item.colorVariations.find(i => {
                        return colorFacets.includes(i.color)
                    });
                }

                if (!selectedColorVariation) {
                    selectedColorVariation = item.colorVariations.find(i => {
                        return item.color === i.color;
                    }) || item.colorVariations[0];
                }

                selectedVariantIndex = item.colorVariations.indexOf(selectedColorVariation) || 0;
            } else {
                selectedVariantIndex = 0;
            }

        }

        return { selectedVariant, selectedVariantIndex };
    }
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
