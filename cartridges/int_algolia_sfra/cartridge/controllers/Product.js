'use strict';

var server = require('server');
var base = module.superModule;
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

server.extend(base);

/**
 * Append the anchor product IDs to the session
 * to be used in the algolia recommendation widget
 */
server.append('Show', function (req, res, next) {
    if (algoliaData.getPreference('Enable') && algoliaData.getPreference('EnableRecommend')) {

        var viewData = res.getViewData();

        if (viewData.product) {
            session.privacy.algoliaAnchorProducts = JSON.stringify([viewData.product.id]);
        }
    }

    next();
});


/**
 * Append the selected variation product ID to the session and view data
 * to be used in the algolia recommendation widget and updating with the selected variation product
 */
server.append('Variation', function (req, res, next) {
    if (algoliaData.getPreference('Enable') && algoliaData.getPreference('EnableRecommend')) {

        var recommendUtils = require('*/cartridge/scripts/algolia/recommend/utils');
        var viewData = res.getViewData();

        if (viewData.product) {
            session.privacy.algoliaAnchorProducts = JSON.stringify([viewData.product.id]);
            viewData.algoliaAnchorProduct = JSON.parse(recommendUtils.getAnchorProductIDs())[0];
            res.setViewData(viewData);
        }
    }
    next();
});

module.exports = server.exports();
