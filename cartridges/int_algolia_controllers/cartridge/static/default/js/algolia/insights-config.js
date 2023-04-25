/* global aa */

/**
 * Configures Insights
 * @param {string} appId Application ID
 * @param {string} searchApiKey Search API Key
 */
function enableInsights(appId, searchApiKey) {
    window.aa('init', {
        appId: appId,
        apiKey: searchApiKey,
        // The default value was changed to false starting with SearchInsights v2.
        // This means that an anonymous user token will no longer be generated and saved for the session automatically.
        // Leaving it at false will generate HTTP 422 errors in the Algolia Events Debugger if useCookie is false and a user token is not set explicitly
        // In order to prevent 422 errors, random userToken is set below which persists throughout the page (regenerated on each page load).
        // Please see the documentation for more details:
        // https://www.npmjs.com/package/search-insights
        // https://www.algolia.com/doc/api-reference/widgets/insights/js/#widget-param-insightsinitparams
        useCookie: false,
    });

    // Generate a random 20-character userToken - will persist throughout the page
    const userToken = getRandomUserToken();

    // Use setUserToken to set a user token explicitly.
    // Set useCookie to true or set this value to the SFCC tracking cookie dwanonymous_* for session-scoped anonymous tracking or
    // assign the user's customerID for tracking logged-in users based on dw.system.Session.isTrackingAllowed() (must be exposed to the frontend).
    // Setting a userToken like so prevent HTTP 422 errors in the Events Debugger with useCookie set to false.
    aa('setUserToken', userToken);

    // when on product page
    document.addEventListener('click', function (event) {
        if ($(event.target).is('button.add-to-cart')) {
            // read data from URL
            var queryID = getUrlParameter('queryID');
            var objectID = getUrlParameter('objectID');
            var indexName = getUrlParameter('indexName');
            if (queryID && objectID && indexName) {
                window.aa('convertedObjectIDsAfterSearch', {
                    eventName: 'Product Add to cart',
                    index: indexName,
                    queryID: queryID,
                    objectIDs: [objectID],
                });
            }
        }
    });

    // when on search page
    var searchPage = document.querySelector('.ais-InstantSearch');
    if (!searchPage) return;

    var lastQueryID = null;
    var lastIndexName = null;

    searchPage.addEventListener('click', function (event) {
        var insightsTarget = findInsightsTarget(event.target, event.currentTarget);
        if (insightsTarget) {
            lastQueryID = $(insightsTarget).data('query-id');
            lastObjectID = $(insightsTarget).data('object-id');
            lastIndexName = $(insightsTarget).data('index-name');
        }
    });

    document.addEventListener('click', function (event) {
        if ($(event.target).is('button.add-to-cart-global')) {
            window.aa('convertedObjectIDsAfterSearch', {
                eventName: 'Global Add to cart',
                index: lastIndexName,
                queryID: lastQueryID,
                objectIDs: [lastObjectID],
            });
        }
    });

    /**
     * Generates a random user token made up of 20 alphanumeric characters
     * @returns {string} randomly generated userToken
     */
    function getRandomUserToken() {
        return Array.from(Array(20), () => Math.floor(Math.random() * 36).toString(36)).join('');
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
    };

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
    };
}
