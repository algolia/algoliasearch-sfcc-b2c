/* global autocomplete, getAlgoliaResults, html, algoliaData  */

function enableAutocomplete(config) {
    const inputElements = document.querySelectorAll('#aa-search-input');

    inputElements.forEach(function(inputElement) {
        autocomplete({
            container: inputElement,
            classNames: {
                panel: "algolia-autocomplete suggestions p-2",
            },
            placeholder: algoliaData.strings.placeholder,
            getSources({ query }) {
                return [
                    {
                        sourceId: 'products',
                        getItems({ query }) {
                            return getAlgoliaResults({
                                searchClient: config.searchClient,
                                queries: [
                                    {
                                        indexName: config.productsIndex,
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
                            header() {
                                return html`
                                  <div class="header row justify-content-end">
                                    <div class="col-xs-12 col-sm-10">${algoliaData.strings.products}</div>
                                  </div>`;
                            },
                            item({
                                     item,
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
                                return html`
                                  <div class="text-truncate text-nowrap">
                                    <img class="swatch-circle hidden-xs-down"
                                         src=${item.firstImage.dis_base_link}></img>
                                    <a href=${item.url}>${components.Highlight({
                                    hit: item,
                                    attribute: "name",
                                    tagName: "em"
                                })}</a>
                                  </div>`;
                            },
                        },
                    },
                    {
                        sourceId: 'categories',
                        getItems({ query }) {
                            return getAlgoliaResults({
                                searchClient: config.searchClient,
                                queries: [
                                    {
                                        indexName: config.categoriesIndex,
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
                            header() {
                                return html`
                                  <div class="header row justify-content-end">
                                    <div class="col-xs-12 col-sm-10">${algoliaData.strings.products}</div>
                                  </div>`;
                            },
                            item({
                                     item,
                                     components
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
        });

        inputElement.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                var urlParams = config.searchPageRoot.indexOf("?") > -1 ? '&q=' + event.target.value : '?q=' + event.target.value;
                window.location.href = config.searchPageRoot + urlParams;
            }
        });
    });
}
