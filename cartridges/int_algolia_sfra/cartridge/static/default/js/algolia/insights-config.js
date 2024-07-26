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
    const LOCAL_STORAGE_KEY = 'algolia-insights';
    const insightsData = document.querySelector('#algolia-insights');

    let userToken;
    let authenticatedUserToken;
    let trackingAllowed = false;
    let trackedQueryIDs = {};

    const dwanonymousCookieMatch = document.cookie.match(/dwanonymous_\w*=(\w*);/);
    if (dwanonymousCookieMatch) {
        userToken = dwanonymousCookieMatch[1];
    }
    if (insightsData && insightsData.dataset.userauthenticated === 'true') {
        authenticatedUserToken = insightsData.dataset.usertoken;
    }
    if (insightsData && insightsData.dataset.trackingallowed === 'true') {
        trackingAllowed = true;
        try {
            trackedQueryIDs = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        } catch (e) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }

    window.aa('init', {
        appId,
        apiKey: searchApiKey,
        userToken,
        authenticatedUserToken,
    });

    let lastQueryID = null;
    let lastIndexName = null;

    // Event defined at https://github.com/SalesforceCommerceCloud/storefront-reference-architecture/blob/dec9c7c684275127338ac3197dfaf8fe656bb2b7/cartridges/app_storefront_base/cartridge/client/default/js/product/base.js#L676
    // The data in the callback comes from the Cart-AddProduct controller: https://github.com/SalesforceCommerceCloud/storefront-reference-architecture/blob/dec9c7c684275127338ac3197dfaf8fe656bb2b7/cartridges/app_storefront_base/cartridge/controllers/Cart.js#L144
    $('body').on('product:afterAddToCart', function (event, data) {
        const objectIDs = [];
        const objectData = [];
        const queryID = getUrlParameter('queryID') || lastQueryID;
        const index = getUrlParameter('indexName') || lastIndexName || productsIndex;
        let currency;

        const algoliaProductData = data.algoliaProductData;
        const productInfo = {
            price: algoliaProductData.price,
            quantity: parseInt(algoliaProductData.qty),
        };

        if (queryID && queryID !== 'undefined') {
            productInfo.queryID = queryID;
        }

        if (algoliaProductData.discount) {
            productInfo.discount = algoliaProductData.discount;
        }

        currency = algoliaProductData.currency;

        objectIDs.push('' + algoliaProductData.pid);
        objectData.push(productInfo);

        if (trackingAllowed) {
            trackedQueryIDs[algoliaProductData.pid] = queryID;
            // Clean up products that were removed from the cart and save the new trackedQueryIDs
            for (const key in trackedQueryIDs) {
                if (!data.cart.items.find((item) => item.id === key)) {
                    delete trackedQueryIDs[key];
                }
            }
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trackedQueryIDs));
        }

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

    // Purchase events.
    // The purchase event is sent when the user reaches the Order-Confirm endpoint.
    // We can detect it because it's the only endpoint that sets a `orderUUID` in `pdict` properties:
    // https://github.com/SalesforceCommerceCloud/storefront-reference-architecture/blob/dec9c7c684275127338ac3197dfaf8fe656bb2b7/cartridges/app_storefront_base/cartridge/controllers/Order.js#L87
    // Our 'algolia-insights' tag exposes its "data-order" attribute only in that case. When it is present, we can send the purchase event.

    const algoliaObj = insightsData && insightsData.dataset.algoliaobj;
    if (algoliaObj) {
        const productsObj = JSON.parse(algoliaObj);
        const products = productsObj.items.slice(0, 20); // The Insights API accepts up to 20 objectID
        const objectIDs = [];
        const objectData = [];
        let currency = productsObj.currency;

        products.forEach((product) => {
            const productInfo = {
                price: product.price.sales.value,
                quantity: product.qty,
            };

            if (product.discount) {
                productInfo.discount = product.discount;
            }

            if (trackingAllowed) {
                productInfo.queryID = trackedQueryIDs[product.id];
                delete trackedQueryIDs[product.id];
            }

            objectIDs.push(product.pid);
            objectData.push(productInfo);
        });
        if (trackingAllowed) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trackedQueryIDs));
        }

        const algoliaEvent = {
            eventName: 'Products purchased',
            index: productsIndex,
            objectIDs,
            objectData,
            currency,
        };
        const algoliaEventType = trackingAllowed
            ? 'purchasedObjectIDsAfterSearch'
            : 'purchasedObjectIDs';

        window.aa(algoliaEventType, algoliaEvent);
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
