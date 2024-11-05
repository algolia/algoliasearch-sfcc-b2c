'use strict';

var server = require('server');

var cache = require('*/cartridge/scripts/middleware/cache');

server.get('Price', cache.applyShortPromotionSensitiveCache, function (req, res, next) {
    var PromotionMgr = require('dw/campaign/PromotionMgr');
    var ProductMgr = require('dw/catalog/ProductMgr');
    var ProductFactory = require('*/cartridge/scripts/factories/product');

    var params = req.querystring;
    var productIds = params.pids;
    var productIdsArr = productIds.split(',');

    var productsArr = [];
    for (var i = 0; i < productIdsArr.length; i++) {
        var product = ProductFactory.get(
            {
                pid: productIdsArr[i]
            }
        );

        //find the minimum price and the promotion
        var minPrice = Number.MAX_VALUE;
        var activePromotion = null;

        var promotions = product.promotions || [];
        var apiProduct = ProductMgr.getProduct(product.id);

        for (var j = 0; j < promotions.length; j++) {
            var promotion = promotions[j]
            var apiPromotion = PromotionMgr.getPromotion(promotion.id);
            var promotionPrice = apiPromotion.getPromotionalPrice(apiProduct);

            if (promotionPrice.value && promotionPrice.value < minPrice ) {
                minPrice = promotionPrice.value;
                activePromotion = promotion;
            }
        }

        if (activePromotion) {
            product.activePromotion = {
                price: minPrice,
                promotion: activePromotion
            };
        }

        var defaultPrice = apiProduct.productSet ? apiProduct.priceModel.minPrice : apiProduct.priceModel.price;
        product.defaultPrice = defaultPrice.value;

        productsArr.push(product);
    }

    res.json({
        products : productsArr
    });
    next();
});

module.exports = server.exports();
