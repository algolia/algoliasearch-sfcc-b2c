/* global autocomplete, Hogan  */

function enableAutocomplete(config) {
    var productSuggestionTemplate = Hogan.compile(''
        + '<div class="product-suggestion">'
        + '   <a class="product-link" href="{{url}}">'
        + '       <div class="product-image">'
        + '           <img src="{{firstImage.dis_base_link}}">'
        + '       </div>'
        + '       <div class="product-details">'
        + '           <div class="product-name">{{&_highlightResult.name.value}}</div>'
        + '       </div>'
        + '   </a>'
        + '</div>'
    );

    var categorySuggestionTemplate = Hogan.compile(''
        + '<a class="hit" href="{{url}}">{{&_highlightResult.name.value}}</a>'
    );


    autocomplete('#aa-search-input', {
        cssClasses: {
            dropdownMenu: "search-suggestion-wrapper full"
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
                window.location.href = config.searchPageRoot + '&q=' + event.target.value;
            }
        });
    }
}
