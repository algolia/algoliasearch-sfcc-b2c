/* global autocomplete, getAlgoliaResults, algoliaData  */
/* exported enableAutocomplete */

var recommendClient;
var trendingItemsArr = [];
const maxRecommendations = 3;
const useTrendingItems = false;

/**
 * Enables autocomplete
 * @param {Object} config configuration object
 */
function enableAutocomplete(config) {
    const inputElements = document.querySelectorAll('#aa-search-input');
    const contentSearchbarTab = $('#content-search-bar-button');
    const productSearchbarTab = $('#product-search-bar-button');
    const contentTabPane = $('#content-search-results-pane');
    const productTabPane = $('#product-search-results');
    recommendClient = config.recommendClient;

    contentTabPane.hide();

    inputElements.forEach(function(inputElement) {
        const {
            setIsOpen
        } = autocomplete({
            container: inputElement,
            classNames: {
                // d-block permits to force "display: block", because SFCC's main.js script sets our panel to "display: none" when clicking again in the input
                panel: "algolia-autocomplete suggestions p-2 d-block",
            },
            placeholder: algoliaData.strings.placeholder,
            getSources() {
                return getSourcesArray(config);
            },
            // If insights is not enabled in the BM, let the value undefined, to rely on the Dashboard setting
            insights: algoliaData.enableInsights ? true : undefined,
            openOnFocus: true,
        });

        /**
         * Closes the autocomplete panel if the click is outside the input.
         * @param {Object} event - The event object.
         * @returns {void}
         */
        function onClickOutside(event) {
            if (!inputElement.contains(event.target)) {
                setIsOpen(false);
            }
        }

        //Listen for click events and close the panel if the click is outside the input
        document.addEventListener('click', onClickOutside, true);

        //change this code with jquery
        contentSearchbarTab.on('click', function (event) {
            event.stopImmediatePropagation();
            $(this).tab('show')
            contentTabPane.show();
            productTabPane.hide();
        });

        productSearchbarTab.on('click', function (event) {
            event.stopImmediatePropagation();
            $(this).tab('show')
            contentTabPane.hide();
            productTabPane.show();
        });

    });

    document.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && (e.target.id.indexOf('autocomplete-') > -1)) {
            var searchPageRoot = config.searchPageRoot;
            var urlParams = searchPageRoot.indexOf("?") > -1 ? '&q=' + e.target.value : '?q=' + e.target.value;
            window.location.href = searchPageRoot + urlParams;
        }
    });
}

/**
 * Maps Algolia hit to a trending item object.
 * @param {Object} hit - The Algolia hit object.
 * @returns {Object} - The mapped trending item object.
 */
function mapHitToTrendingItem(hit) {
    return {
        label: hit.name,
        objectID: hit.objectID,
        disBaseLink: hit.image_groups[0].images[0].dis_base_link,
        url: hit.url,
    };
}

/**
 * Fetches and processes trending items.
 * @returns {Promise} - The promise object.
 */
function fetchTrendingItems() {
    return new Promise((resolve) => {
        const indexName = algoliaData.productsIndex;

        recommendClient.getTrendingItems([{
            indexName,
            maxRecommendations,
        }]).then(response => {
            const results = response.results[0].hits;
            trendingItemsArr = results.map(mapHitToTrendingItem);
            resolve(trendingItemsArr);
        }).catch(err => {
            console.error('Please configure the "Trending items" recommend model on Algolia Dashboard:', err);
            resolve([]);
        });
    });
}


/**
 * @description Get Trending items array for autocomplete
 * @param {Object} config configuration object
 * @returns {Promise} Promise that resolves with the trending items array
 */
function getTrendingItemsArray() {
    if (!algoliaData.enableRecommend || !useTrendingItems) {
        return Promise.resolve([]);
    }

    if (trendingItemsArr.length === 0) {
        return fetchTrendingItems();
    }

    return Promise.resolve(trendingItemsArr);
}

/**
 * @description Get sources array for autocomplete
 * @param {Object} config configuration object
 * @returns {Array} sources array
 */
function getSourcesArray(config) {

    var sourcesArray = [];

    sourcesArray.push({
        sourceId: 'products',
        getItems({
            query
        }) {
            if (!query) {
                return [];
            }
            return getAlgoliaResults({
                searchClient: config.searchClient,
                queries: [{
                    indexName: algoliaData.productsIndex,
                    query,
                    params: {
                        hitsPerPage: 3,
                        distinct: true,
                        clickAnalytics: true,
                    },
                }, ],
            });
        },
        templates: {
            header({
                html
            }) {
                return html `
                      <div class="header row justify-content-end">
                        <div class="col-xs-12 col-sm-10">${algoliaData.strings.products}</div>
                      </div>`;
            },
            item({
                item,
                components,
                html,
            }) {
                if (typeof (item.image_groups) === "undefined") {
                    item.firstImage = algoliaData.noImages.small;
                } else {
                    var smallImageGroup = item.image_groups.find(function (imageGroup) {
                        return imageGroup.view_type === "small"
                    });
                    item.firstImage = smallImageGroup.images[0];
                }

                // add queryID, objectID and indexName to the URL (analytics)
                let newURL = '';
                if (item.url) {
                    newURL = new URL(item.url, window.location.origin);
                    newURL.searchParams.append('objectID', item.objectID);
                    newURL.searchParams.append('queryID', item.__autocomplete_queryID);
                    newURL.searchParams.append('indexName', item.__autocomplete_indexName);
                }

                return html `
                        <a href="${newURL.href}">
                            <div class="text-truncate text-nowrap">
                                <img class="swatch-circle hidden-xs-down" src=${item.firstImage.dis_base_link}></img>
                                <span>${components.Highlight({ hit: item, attribute: "name", tagName: "em" })}</span>
                            </div>
                        </a>`;
            },
        },
    });

    sourcesArray.push({
        sourceId: 'trendingProducts',
        getItems() {
            return getTrendingItemsArray();
        },
        templates: {
            header({
                html
            }) {
                return html `
                        <div class="header row justify-content-end">
                            <div class="col-xs-12 col-sm-10">${algoliaData.strings.trending}</div>
                        </div>`;
            },
            item({
                item,
                html,
            }) {
                return html `
                    <a href=${item.url}>
                        <div class="text-truncate text-nowrap">
                            <img class="swatch-circle hidden-xs-down" src=${item.disBaseLink}></img>
                            <span>${item.label}</span>
                        </div>
                    </a>`;
            },
        },
    });

    sourcesArray.push({
        sourceId: 'categories',
        getItems({
            query
        }) {
            if (!query) {
                return [];
            }
            return getAlgoliaResults({
                searchClient: config.searchClient,
                queries: [{
                    indexName: algoliaData.categoriesIndex,
                    query,
                    params: {
                        hitsPerPage: 3,
                        distinct: true,
                        clickAnalytics: true,
                    },
                }, ],
            });
        },
        templates: {
            header({
                html
            }) {
                return html `
                      <div class="header row justify-content-end">
                        <div class="col-xs-12 col-sm-10">${algoliaData.strings.categories}</div>
                      </div>`;
            },
            item({
                item,
                components,
                html,
            }) {
                return html `
                    <a href=${item.url}>
                        <div class="text-truncate text-nowrap">
                            <img class="swatch-circle hidden-xs-down" src=${item.image}></img>
                            <span>
                            ${components.Highlight(
        {
            hit: item,
            attribute: "name",
            tagName: "em"
        })}</span>
                        </div>
                    </a`;
            },
        },
    });

    if (algoliaData.enableContentSearch) {
        sourcesArray.push({
            sourceId: 'contents',
            getItems({
                query
            }) {
                if (!query) {
                    return [];
                }
                return getAlgoliaResults({
                    searchClient: config.searchClient,
                    queries: [{
                        indexName: algoliaData.contentsIndex,
                        query,
                        params: {
                            hitsPerPage: 3,
                            distinct: true,
                            clickAnalytics: true,
                        },
                    }, ],
                });
            },
            templates: {
                header({
                    html
                }) {
                    return html `
                          <div class="header row justify-content-end">
                            <div class="col-xs-12 col-sm-10">${algoliaData.strings.content}</div>
                          </div>`;
                },
                item({
                    item,
                    components,
                    html,
                }) {
                    return html `
                        <a href=${item.url}>
                            <div class="text-truncate text-nowrap">
                                <span class="ml-sm-0 ml-md-5">
        ${components.Highlight(
        {
            hit: item,
            attribute: "name",
            tagName: "em"
        })}</span>
                            </div>
                        </a>`;
                },
            },
        });
    }

    return sourcesArray;
}
