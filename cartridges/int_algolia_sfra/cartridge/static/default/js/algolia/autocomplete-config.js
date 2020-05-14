/* global autocomplete, Hogan  */

function enableAutocomplete(config) {
    var productSuggestionTemplate = Hogan.compile(''
        + '<div class="text-truncate text-nowrap">'
        + '   <img class="swatch-circle hidden-xs-down" src="{{firstImage.dis_base_link}}" />'
        + '   <a href="{{url}}">{{&_highlightResult.name.value}}</a>`'
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
                    + '  <div class="col-xs-12 col-sm-10">Products</div>'
                    + '</div>',
                suggestion(product) {
                    var smallImageGroup = product.image_groups.find(function (imageGroup) {
                        return imageGroup.view_type === "small"
                    });
                    product.firstImage = smallImageGroup.images[0];
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
                    + '  <div class="col-xs-12 col-sm-10">Categories</div>'
                    + '</div>',
                suggestion(category) {
                    categorySuggestionTemplate.render(category)
                }
            }
        }
    ]);

    document.querySelector('#aa-search-input').addEventListener('keypress', function(event){
        if (event.key === 'Enter') {
            window.location.href = config.searchPageRoot + '&q=' + event.target.value;
        }
    });
}
