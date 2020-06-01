/* global aa */

function enableInsights(appId, searchApiKey) {
    window.aa('init', {
        appId: appId,
        apiKey: searchApiKey
    });


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
                    objectIDs: [objectID]
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
                objectIDs: [lastObjectID]
            });
        }
    });


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
