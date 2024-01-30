/* global autocomplete, getAlgoliaResults, algoliaData */

/**
 * Enables autocomplete
 * @param {Object} config configuration object
 */
function enableAutocomplete(config) {
    const inputElements = document.querySelectorAll('#aa-search-input');

    inputElements.forEach(function(inputElement) {
        autocomplete({
            container: inputElement,
            classNames: {
                // d-block permits to force "display: block", because SFCC's main.js script sets our panel to "display: none" when clicking again in the input
                panel: "algolia-autocomplete search-suggestion-wrapper full d-block",
            },
            placeholder: algoliaData.strings.placeholder,
            getSources() {
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
    });
}

/**
 * @description Get sources array for autocomplete
 * @param {Object} config configuration object
 * @returns {Array} sources array
 */
function getSourcesArray(config) {

    var sourcesArray = [];

    sourcesArray.push(
        {
            sourceId: 'products',
            getItems({ query }) { // eslint-disable-line no-shadow
                return getAlgoliaResults({
                    searchClient: config.searchClient,
                    queries: [
                        {
                            indexName: algoliaData.productsIndex,
                            query,
                            params: {
                                hitsPerPage: 3,
                                distinct: true,
                                clickAnalytics: true,
                            },
                        },
                    ],
                });
            },
            templates: {
                header({ createElement }) {
                    return createElement("div", { class: "header row justify-content-end" },
                        createElement("div", { class: "col-xs-12 col-sm-10" },
                            algoliaData.strings.products
                        )
                    );
                },
                item({
                    item,
                    createElement,
                    components
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

                    return createElement("div", { class: "product-suggestion" },
                        createElement("a", {
                            class: "product-link",
                            href: newURL,
                        },
                        createElement("div", { class: "product-image" },
                            createElement("img", { src: item.firstImage.dis_base_link })
                        ),
                        createElement("div", { class: "product-details" },
                            createElement("div", { class: "product-name" }, components.Highlight({
                                hit: item,
                                attribute: "name",
                                tagName: "em"
                            }))
                        ))
                    );
                },
            },
        }
    );

    sourcesArray.push(
        {
            sourceId: 'categories',
            getItems({ query }) { // eslint-disable-line no-shadow
                return getAlgoliaResults({
                    searchClient: config.searchClient,
                    queries: [
                        {
                            indexName: algoliaData.categoriesIndex,
                            query,
                            params: {
                                hitsPerPage: 3,
                                distinct: true,
                                clickAnalytics: true,
                            },
                        },
                    ],
                });
            },
            templates: {
                header({ createElement }) {
                    return createElement("div", { class: "header row justify-content-end" },
                        createElement("div", { class: "col-xs-12 col-sm-10" },
                            algoliaData.strings.categories
                        )
                    );
                },
                item({
                    item,
                    createElement,
                    components
                }) {
                    return createElement("a", { href: item.url },
                        components.Highlight({
                            hit: item,
                            attribute: "name",
                            tagName: "em"
                        })
                    );
                },
            },
        }
    );

    if (algoliaData.enableContentSearch) {
        sourcesArray.push(
            {
                sourceId: 'contents',
                getItems({ query }) { // eslint-disable-line no-shadow
                    return getAlgoliaResults({
                        searchClient: config.searchClient,
                        queries: [
                            {
                                indexName: algoliaData.contentsIndex,
                                query,
                                params: {
                                    hitsPerPage: 3,
                                    distinct: true,
                                    clickAnalytics: true,
                                },
                            },
                        ],
                    });
                },
                templates: {
                    header({ html }) {
                        return html`
                          <div class="header row justify-content-end">
                            <div class="col-xs-12 col-sm-10">${algoliaData.strings.contents}</div>
                          </div>`;
                    },
                    item({
                        item,
                        components,
                        html,
                    }) {
                        return html`
                          <div class="text-truncate text-nowrap">
                            <a class="ml-5" href=${item.url}>${components.Highlight({
    hit: item,
    attribute: "name",
    tagName: "em"
})}</a>
                          </div>`;
                    },
                },
            }
        );
    }

    return sourcesArray;
}
