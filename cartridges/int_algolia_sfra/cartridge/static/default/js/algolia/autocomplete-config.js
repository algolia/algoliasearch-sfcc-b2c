/* global autocomplete, getAlgoliaResults, algoliaData  */

/**
 * Enables autocomplete
 * @param {Object} config configuration object
 */
function enableAutocomplete(config) {
    const inputElements = document.querySelectorAll('#aa-search-input');
    const contentSearchbarTab = $('#content-search-bar-button');
    const productSearchbarTab = $('#product-search-bar-button');
    const contentTabPane = $('#content-search-results-pane')
    const productTabPane = $('#product-search-results')

    contentTabPane.hide();

    inputElements.forEach(function(inputElement) {
        autocomplete({
            container: inputElement,
            classNames: {
                // d-block permits to force "display: block", because SFCC's main.js script sets our panel to "display: none" when clicking again in the input
                panel: "algolia-autocomplete suggestions p-2 d-block",
            },
            placeholder: algoliaData.strings.placeholder,
            getSources(query) {
                return getSourcesArray(config);
            },
            // If insights is not enabled in the BM, let the value undefined, to rely on the Dashboard setting
            insights: algoliaData.enableInsights ? true : undefined,
        });

        inputElement.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                var urlParams = config.searchPageRoot.indexOf("?") > -1 ? '&q=' + event.target.value : '?q=' + event.target.value;
                window.location.href = config.searchPageRoot + urlParams;
            }
        });

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
        }) { // eslint-disable-line no-shadow
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
                        <div class="text-truncate text-nowrap">
                            <img class="swatch-circle hidden-xs-down" src=${item.firstImage.dis_base_link}></img>
                            <a href="${newURL.href}">${components.Highlight({ hit: item, attribute: "name", tagName: "em" })}</a>
                        </div>`;
            },
        },
    });

    sourcesArray.push({
        sourceId: 'categories',
        getItems({
            query
        }) { // eslint-disable-line no-shadow
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
                      <div class="text-truncate text-nowrap">
                        <img class="swatch-circle hidden-xs-down" src=${item.image}></img>
                        <a href=${item.url}>
        ${components.Highlight(
        {
            hit: item,
            attribute: "name",
            tagName: "em"
        })}</a>
                      </div>`;
            },
        },
    });

    if (algoliaData.enableContentSearch) {
        sourcesArray.push({
            sourceId: 'contents',
            getItems({
                query
            }) { // eslint-disable-line no-shadow
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
                          <div class="text-truncate text-nowrap">
                            <a class="ml-5" href=${item.url}>
        ${components.Highlight(
        {
            hit: item,
            attribute: "name",
            tagName: "em"
        })}</a>
                          </div>`;
                },
            },
        });
    }

    return sourcesArray;
}