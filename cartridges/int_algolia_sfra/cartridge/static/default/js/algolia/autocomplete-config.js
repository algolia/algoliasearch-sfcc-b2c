/* global autocomplete, getAlgoliaResults, algoliaData  */

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
                panel: "algolia-autocomplete suggestions p-2 d-block",
            },
            placeholder: algoliaData.strings.placeholder,
            getSources({ query }) {
                return [
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
                            header({ html }) {
                                return html`
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

                                return html`
                                    <div class="text-truncate text-nowrap">
                                        <img class="swatch-circle hidden-xs-down" src=${item.firstImage.dis_base_link}></img>
                                        <a href="${newURL.href}">${components.Highlight({ hit: item, attribute: "name", tagName: "em" })}</a>
                                    </div>`;
                            },
                        },
                    },
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
                            header({ html }) {
                                return html`
                                  <div class="header row justify-content-end">
                                    <div class="col-xs-12 col-sm-10">${algoliaData.strings.categories}</div>
                                  </div>`;
                            },
                            item({
                                item,
                                components,
                                html,
                            }) {
                                return html`
                                  <div class="text-truncate text-nowrap">
                                    <img class="swatch-circle hidden-xs-down" src=${item.image}></img>
                                    <a href=${item.url}>${components.Highlight({
    hit: item,
    attribute: "name",
    tagName: "em"
})}</a>
                                  </div>`;
                            },
                        },
                    },
                ];
            },
            insights: true,
        });

        inputElement.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                var urlParams = config.searchPageRoot.indexOf("?") > -1 ? '&q=' + event.target.value : '?q=' + event.target.value;
                window.location.href = config.searchPageRoot + urlParams;
            }
        });
    });
}
