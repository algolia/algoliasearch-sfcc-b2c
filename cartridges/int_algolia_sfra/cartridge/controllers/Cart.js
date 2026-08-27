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

        // The base controller reports an error when it rejected the add, for example when the
        // requested quantity exceeds the available-to-sell inventory. The basket can still hold a
        // line item for the product from an earlier add, so without this check the lookup below
        // would find that line item and report an add-to-cart event for a product that was not
        // added.
        if (viewData.error) {
            return next();
        }

        var product = ProductMgr.getProduct(productID);
        if (empty(product)) {
            algoliaLogger.warn('No product found for ID "{0}", add-to-cart event not sent.', productID);
            return next();
        }

        var recordID = null;

        try {
            recordID = modelHelper.getRecordIDForProduct(product, recordModel);
        } catch (e) { // eslint-disable-line no-unused-vars
            recordID = null;
        }

        // Without a record ID there is nothing in the index to attach the event to.
        if (!recordID) {
            algoliaLogger.warn('No "{0}" record ID resolved for product "{1}", add-to-cart event not sent.', recordModel, productID);
            return next();
        }

        algoliaProductData.pid = recordID;

        algoliaProductData.qty = req.form.quantity;

        // The base controller reports the UUID of the line item it created or incremented, which
        // identifies the configuration the shopper just added. The product ID is the fallback, for
        // a customized base controller that does not report the UUID.
        //
        // The line item is absent when a product set was added, since the basket then holds the
        // set's children rather than the posted product ID.
        var currentBasket = BasketMgr.getCurrentBasket();
        var lineItem = priceHelper.findLineItemByUUID(currentBasket, viewData.pliUUID)
            || priceHelper.findProductLineItem(currentBasket, productID);
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
