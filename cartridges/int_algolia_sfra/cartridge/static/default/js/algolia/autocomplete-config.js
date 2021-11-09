/* global autocomplete, getAlgoliaResults  */

function enableAutocomplete(config) {
    autocomplete({
        container: '#aa-search-input',
        classNames: {
            panel: "algolia-autocomplete suggestions p-2",
        },
        debug: true,
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
                        header({ createElement }) {
                            return createElement("div", { class: "header row justify-content-end" },
                                createElement("div", { class: "col-xs-12 col-sm-10" },
                                    algoliaData.strings.products
                                )
                            );
                        },
                        item({ item, createElement, components }) {
                            if (typeof(item.image_groups) === "undefined"){
                                item.firstImage = algoliaData.noImages.small;
                            } else {
                                var smallImageGroup = item.image_groups.find(function (imageGroup) {
                                    return imageGroup.view_type === "small"
                                });
                                item.firstImage = smallImageGroup.images[0];
                            }
                            return createElement("div", { class: "text-truncate text-nowrap" },
                                createElement("img", { class: "swatch-circle hidden-xs-down", src: item.firstImage.dis_base_link }),
                                createElement("a", { href: item.url }, components.Highlight({ hit: item, attribute: "name", tagName: "em" }))
                            );
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
                        header({ createElement }) {
                            return createElement("div", { class: "header row justify-content-end" },
                                createElement("div", { class: "col-xs-12 col-sm-10" },
                                    algoliaData.strings.categories
                                )
                            );
                        },
                        item({ item, createElement, components }) {
                            return createElement("div", { class: "text-truncate text-nowrap" },
                                createElement("img", { class: "swatch-circle hidden-xs-down", src: item.image }),
                                createElement("a", { href: item.url }, components.Highlight({ hit: item, attribute: "name", tagName: "em" }))
                            );
                        },
                    },
                },
            ];
        },
    })

    if (document.querySelector('#aa-search-input')) {
        document.querySelector('#aa-search-input').addEventListener('keypress', function(event){
            if (event.key === 'Enter') {
                var urlParams = config.searchPageRoot.indexOf("?") > -1 ? '&q=' + event.target.value : '?q=' + event.target.value;
                window.location.href = config.searchPageRoot + urlParams;
            }
        });
    }
}
