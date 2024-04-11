'use strict';

var server = require('server');
var base = module.superModule;
var BasketMgr = require('dw/order/BasketMgr');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

server.extend(base);

server.append('Show', function (req, res, next) {
    if (algoliaData.getPreference('Enable') && algoliaData.getPreference('EnableRecommend')) {

        var algoliaAnchorProducts = [];
        var basket = BasketMgr.getCurrentOrNewBasket();
        var plisArr = basket.productLineItems.toArray();

        plisArr.forEach(function(pli) {
            algoliaAnchorProducts.push(pli.productID);
        });

        session.privacy.algoliaAnchorProducts = JSON.stringify(algoliaAnchorProducts);
    }

    next();
});

module.exports = server.exports();