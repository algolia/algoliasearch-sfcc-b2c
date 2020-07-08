/* global autocomplete, Hogan  */

function enableAutocomplete(config) {
    var productSuggestionTemplate = Hogan.compile(''
        + '<div class="text-truncate text-nowrap">'
        + '   <img class="swatch-circle hidden-xs-down" src="{{firstImage.dis_base_link}}" />'
        + '   <a href="{{url}}">{{&_highlightResult.name.value}}</a>'
        + '</div>'
    );

    var categorySuggestionTemplate = Hogan.compile(''
        + '<div class="text-truncate text-nowrap">'
        + '  <img class="swatch-circle hidden-xs-down" src="{{image}}" />'
        + '  <a href="{{url}}">{{&_highlightResult.name.value}}</a>'
        + '</div>'
    );


    autocomplete('#aa-search-input', {
        cssClasses: {
            dropdownMenu: "dropdownMenu suggestions p-2"
        }
    }, [
        {
            source: autocomplete.sources.hits(config.searchClient.initIndex(config.productsIndex), {
                hitsPerPage: 3,
                distinct: true,
                clickAnalytics: true
            }),
            displayKey: 'products',
            name: 'products',
            templates: {
                header: ''
                    + '<div class="header row justify-content-end">'
                    + '  <div class="col-xs-12 col-sm-10">' + algoliaData.strings.products + '</div>'
                    + '</div>',
                suggestion: function(product) {
                    if (typeof(product.image_groups) === "undefined"){
                        product.firstImage = algoliaData.noImages.small;
                    } else {
                        var smallImageGroup = product.image_groups.find(function (imageGroup) {
                            return imageGroup.view_type === "small"
                        });
                        product.firstImage = smallImageGroup.images[0];
                    }
                    return productSuggestionTemplate.render(product)
                }
            }
        },
        {
            source: autocomplete.sources.hits(config.searchClient.initIndex(config.categoriesIndex), {
                hitsPerPage: 3,
                distinct: true,
                clickAnalytics: true
            }),
            displayKey: 'categories',
            name: 'categories',
            templates: {
                header: ''
                    + '<div class="header row justify-content-end">'
                    + '  <div class="col-xs-12 col-sm-10">' + algoliaData.strings.categories + '</div>'
                    + '</div>',
                suggestion: function(category) {
                    return categorySuggestionTemplate.render(category)
                }
            }
        }
    ]);

    if (document.querySelector('#aa-search-input')) {
        document.querySelector('#aa-search-input').addEventListener('keypress', function(event){
            if (event.key === 'Enter') {
                var urlParams = config.searchPageRoot.indexOf("?") > -1 ? '&q=' + event.target.value : '?q=' + event.target.value;
                window.location.href = config.searchPageRoot + urlParams;
            }
        });
    }
}
