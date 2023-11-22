/* global aa */

/**
 * Configures Insights
 * Relies on the objects and events created by SFRA's addToCart handler:
 * https://github.com/SalesforceCommerceCloud/storefront-reference-architecture/blob/dec9c7c684275127338ac3197dfaf8fe656bb2b7/cartridges/app_storefront_base/cartridge/client/default/js/product/base.js#L624
 * @param {string} appId Application ID
 * @param {string} searchApiKey Search API Key
 * @param {string} productsIndex Products index name
 */
function enableInsights(appId, searchApiKey, productsIndex) {
    window.aa('init', {
        appId,
        apiKey: searchApiKey,
    });

    let lastQueryID = null;
    let lastIndexName = null;
    let lastPidsObj = [];

    // Event defined at https://github.com/SalesforceCommerceCloud/storefront-reference-architecture/blob/dec9c7c684275127338ac3197dfaf8fe656bb2b7/cartridges/app_storefront_base/cartridge/client/default/js/product/base.js#L668
    $(document).on('updateAddToCartFormData', function (event, data) {
        // The 'product:afterAddToCart' event returns the current cart, without a way to identify
        // the product(s) just added. We store temporarily the added products and their quantity.
        if (data.pidsObj) {
            // product set
            lastPidsObj = JSON.parse(data.pidsObj);
        } else {
            // For a single product, the information is at the top level. We recreate the same pidsObj as for a product set.
            lastPidsObj = [
                {
                    pid: data.pid,
                    qty: data.quantity,
                },
            ];
        }
    });
    // Event defined at https://github.com/SalesforceCommerceCloud/storefront-reference-architecture/blob/dec9c7c684275127338ac3197dfaf8fe656bb2b7/cartridges/app_storefront_base/cartridge/client/default/js/product/base.js#L676
    // The data in the callback comes from the Cart-AddProduct controller: https://github.com/SalesforceCommerceCloud/storefront-reference-architecture/blob/dec9c7c684275127338ac3197dfaf8fe656bb2b7/cartridges/app_storefront_base/cartridge/controllers/Cart.js#L144
    $('body').on('product:afterAddToCart', function (event, data) {
        const objectIDs = [];
        const objectData = [];
        const queryID = getUrlParameter('queryID') || lastQueryID;
        const index = getUrlParameter('indexName') || lastIndexName || productsIndex;
        let currency;

        lastPidsObj.forEach((pidObj) => {
            const product = data.cart.items.find((item) => item.id === pidObj.pid);
            const productInfo = {
                queryID: queryID,
                price: product.price.sales.value,
                quantity: parseInt(pidObj.qty),
            };
            if (product.price.list) {
                // Operation needs to be rounded to avoid "Discount must be a decimal number" errors
                productInfo.discount = +(
                    product.price.list.value - product.price.sales.value
                ).toFixed(2);
            }
            currency = product.price.sales.currency;

            objectIDs.push(product.id);
            objectData.push(productInfo);
        });

        const algoliaEventType = queryID
            ? 'addedToCartObjectIDsAfterSearch'
            : 'addedToCartObjectIDs';
        // pliUUID is defined only for a single product add to cart: https://github.com/SalesforceCommerceCloud/storefront-reference-architecture/blob/1d7d4d987d681a11b045746618aec744b4409540/cartridges/app_storefront_base/cartridge/controllers/Cart.js#L125
        const eventName = data.pliUUID ? 'Product Add to cart' : 'Global Add to cart';

        const algoliaEvent = {
            eventName,
            index,
            objectIDs,
            objectData,
            currency,
        };
        window.aa(algoliaEventType, algoliaEvent);
    });

    // when on search page
    var searchPage = document.querySelector('.ais-InstantSearch');
    if (searchPage) {
        searchPage.addEventListener('click', function (event) {
            var insightsTarget = findInsightsTarget(event.target, event.currentTarget);
            if (insightsTarget) {
                lastQueryID = $(insightsTarget).data('query-id');
                lastIndexName = $(insightsTarget).data('index-name');
            }
        });
    }

    /**
     * Finds Insights target
     * @param {Object} startElement Element to start from
     * @param {Object} endElement Element to stop searching at
     * @returns {Object} Element found or null if not found
     */
    function findInsightsTarget(startElement, endElement) {
        var element = startElement;
        while (element && !element.hasAttribute('data-query-id')) {
            if (element === endElement) {
                return null;
            }
            element = element.parentElement;
        }
        return element;
    }

    /**
     * Returns the value of a URL parameter
     * @param {string} parameterName The parameter name whose value should be returned
     * @returns {string} The value of the parameter
     */
    function getUrlParameter(parameterName) {
        var queryString = window.location.search.substring(1);
        var sURLVariables = queryString.split('&');
        var currentParameterName;

        for (var i = 0; i < sURLVariables.length; i++) {
            currentParameterName = sURLVariables[i].split('=');

            if (currentParameterName[0] === parameterName) {
                return currentParameterName[1] === undefined
                    ? true
                    : decodeURIComponent(currentParameterName[1]);
            }
        }
    }
}
