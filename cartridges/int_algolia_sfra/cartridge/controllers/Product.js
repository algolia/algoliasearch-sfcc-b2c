'use strict';

var server = require('server');
var base = module.superModule;
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

server.extend(base);

server.append('Show', function (req, res, next) {
    if (algoliaData.getPreference('Enable') && algoliaData.getPreference('EnableRecommend')) {

        var viewData = res.getViewData();

        if (viewData.product) {
            session.privacy.algoliaAnchorProducts = JSON.stringify([viewData.product.id]);
        }
    }

    next();
});

module.exports = server.exports();
