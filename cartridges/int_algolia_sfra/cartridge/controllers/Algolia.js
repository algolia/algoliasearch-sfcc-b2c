'use strict';

var server = require('server');

var cache = require('*/cartridge/scripts/middleware/cache');

server.get('Price', cache.applyShortPromotionSensitiveCache, function (req, res, next) {
    var priceHelper = require('*/cartridge/scripts/helpers/pricing');
    var ProductFactory = require('*/cartridge/scripts/factories/product');
    var PromotionMgr = require('dw/campaign/PromotionMgr');
    var Promotion = require('dw/campaign/Promotion');
    var ProductMgr = require('dw/catalog/ProductMgr');
    var BasketMgr = require('dw/order/BasketMgr');
    var cartHelper = require('*/cartridge/scripts/cart/cartHelpers');
    var Transaction = require('dw/system/Transaction');

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

        //find the minimum price for an active promotion
        var minPrice = 99999999999999999999; //set to a high number
        var activePromotion = null;

        var promotions = product.promotions || [];
        var promotionPlan = PromotionMgr.getActiveCustomerPromotions();
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

        productsArr.push(product);
    }

    res.json({
       products : productsArr
    });
    next();
});


server.get('Test', function (req, res, next) {

    var ProductMgr = require('dw/catalog/ProductMgr');
    var PromotionMgr = require('dw/campaign/PromotionMgr');

    var discountedProduct = ProductMgr.getProduct('22962004M');

    var qualifyingProduct = ProductMgr.getProduct('701642842682M');

    var randomProduct = ProductMgr.getProduct('25501785M');

    var promoPlan = PromotionMgr.getActiveCustomerPromotions();

    var Discountedpromos = promoPlan.getProductPromotionsForDiscountedProduct(discountedProduct);

    var randomPromos = promoPlan.getProductPromotionsForDiscountedProduct(randomProduct);

    var qualifyingPromos = promoPlan.getProductPromotionsForQualifyingProduct(qualifyingProduct);

    res.json({
        Discountedpromos: JSON.stringify(Discountedpromos.toArray()),
        randomPromos: JSON.stringify(randomPromos.toArray()),
        qualifyingPromos: JSON.stringify(qualifyingPromos.toArray()),
        promoPlanPromos: JSON.stringify(promoPlan.getPromotions().toArray())
    });
    next();
});


module.exports = server.exports();
