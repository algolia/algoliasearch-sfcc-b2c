'use strict';

var server = require('server');
var base = module.superModule;
var BasketMgr = require('dw/order/BasketMgr');
var ProductMgr = require('dw/catalog/ProductMgr');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var modelHelper = require('*/cartridge/scripts/algolia/helper/modelHelper');
var priceHelper = require('*/cartridge/scripts/algolia/helper/priceHelper');
var algoliaLogger = require('dw/system/Logger').getLogger('algolia');

server.extend(base);

const { RECORD_MODEL_TYPES } = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

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


server.append('AddProduct', function (req, res, next) {
    if (algoliaData.getPreference('Enable') && algoliaData.getPreference('EnableInsights')) {

        let recordModel = algoliaData.getPreference('RecordModel');
        var productID = req.form.pid;
        var viewData = res.getViewData();
        var algoliaProductData = {};

        if (!productID) {
            return next(); // prevent execution of the rest of the code
        }

        try {
            var product = ProductMgr.getProduct(productID);
            if (empty(product)) {
                return next();
            }

            switch (recordModel) {
                case RECORD_MODEL_TYPES.ATTRIBUTE_SLICED:
                    algoliaProductData.pid = modelHelper.getAttributeSlicedModelRecordID(product);
                    break;
                case RECORD_MODEL_TYPES.MASTER_LEVEL:
                    algoliaProductData.pid = product.isVariant() ? product.getMasterProduct().getID() : product.getID(); // returns master ID for variants, product ID for simple products
                    break;
                case RECORD_MODEL_TYPES.VARIANT_LEVEL:
                    algoliaProductData.pid = productID;
                    break;
            }

        } catch (e) { // eslint-disable-line no-unused-vars
            algoliaProductData.pid = productID;
        }

        algoliaProductData.qty = req.form.quantity;

        // The line item is absent when the product was not added, in which case the base controller
        // still runs this append, and when a product set was added, since the basket then holds the
        // set's children rather than the posted product ID.
        var lineItem = priceHelper.findProductLineItem(BasketMgr.getCurrentBasket(), productID);
        if (!lineItem) {
            algoliaLogger.warn('No basket line item found for product "{0}", add-to-cart event not sent.', productID);
            return next();
        }

        var priceData = priceHelper.getLineItemPriceData(lineItem);
        if (!priceData) {
            return next();
        }

        algoliaProductData.price = priceData.price;
        algoliaProductData.currency = priceData.currency;
        if ('discount' in priceData) {
            algoliaProductData.discount = priceData.discount;
        }

        viewData.algoliaProductData = algoliaProductData;
    }

    next();
});

module.exports = server.exports();
