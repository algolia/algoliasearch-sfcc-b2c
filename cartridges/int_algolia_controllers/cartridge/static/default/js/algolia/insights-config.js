/* global aa */

/**
 * Configures Insights
 * @param {string} appId Application ID
 * @param {string} searchApiKey Search API Key
 */
function enableInsights(appId, searchApiKey) {
    const insightsData = document.querySelector('#algolia-insights');

    let userToken;
    let authenticatedUserToken;

    const dwanonymousCookieMatch = document.cookie.match(/dwanonymous_\w*=(\w*);/);
    if (dwanonymousCookieMatch) {
        userToken = dwanonymousCookieMatch[1];
    }
    if (insightsData && insightsData.dataset.userauthenticated === 'true') {
        authenticatedUserToken = insightsData.dataset.usertoken;
    }

    window.aa('init', {
        appId,
        apiKey: searchApiKey,
        userToken,
        authenticatedUserToken,
    });

    var lastQueryID = null;
    var lastIndexName = null;
    var lastObjectID = null;

    document.addEventListener('click', function (event) {
        var queryID = getUrlParameter('queryID') || lastQueryID;
        var objectID = getUrlParameter('objectID') || lastObjectID;
        var indexName = getUrlParameter('indexName') || lastIndexName;

        if ($(event.target).is('button.add-to-cart')) {
            handleCartAction('Product Add to cart', queryID, objectID, indexName);
        } else if ($(event.target).is('button#add-all-to-cart')) {
            handleCartAction('Global Add to cart', queryID, objectID, indexName);
        }
    });

    // when on search page
    var searchPage = document.querySelector('#algolia-hits-placeholder');
    if (!searchPage) return;

    searchPage.addEventListener('click', function (event) {
        var insightsTarget = findInsightsTarget(event.target, event.currentTarget);
        if (insightsTarget) {
            lastQueryID = $(insightsTarget).data('query-id');
            lastObjectID = $(insightsTarget).data('pid');
            lastIndexName = $(insightsTarget).data('index-name');
        }
    });

    /**
     * Send an addedToCart event
     * @param {string} eventName event name
     * @param {string} queryID query ID
     * @param {string} objectID product ID
     * @param {string} indexName index name
     */
    function handleCartAction(eventName, queryID, objectID, indexName) {
        if (queryID && objectID && indexName) {
            window.aa('addedToCartObjectIDsAfterSearch', {
                eventName: eventName,
                index: indexName,
                queryID: queryID,
                objectIDs: ['' + objectID],
            });
        }
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
                return currentParameterName[1] === undefined ? true : decodeURIComponent(currentParameterName[1]);
            }
        }
    }
}
