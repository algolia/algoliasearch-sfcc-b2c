'use strict';

var server = require('server');
var base = module.superModule;
var BasketMgr = require('dw/order/BasketMgr');
var ProductMgr = require('dw/catalog/ProductMgr');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var modelHelper = require('*/cartridge/scripts/algolia/helper/modelHelper');

server.extend(base);

const RECORD_MODEL_TYPE = {
    MASTER_LEVEL: 'master-level',
    VARIANT_LEVEL: 'variant-level',
    ATTRIBUTE_SLICED: 'attribute-sliced',
}

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
                case RECORD_MODEL_TYPE.ATTRIBUTE_SLICED:
                    algoliaProductData.pid = modelHelper.getAttributeSlicedModelRecordID(product);
                    break;
                case RECORD_MODEL_TYPE.MASTER_LEVEL:
                    algoliaProductData.pid = product.isVariant() ? product.getMasterProduct().getID() : product.getID(); // returns master ID for variants, product ID for simple products
                    break;
                case RECORD_MODEL_TYPE.VARIANT_LEVEL:
                    algoliaProductData.pid = productID;
                    break;
            }

        } catch (e) { // eslint-disable-line no-unused-vars
            algoliaProductData.pid = productID;
        }

        algoliaProductData.qty = req.form.quantity;
        var items = viewData.cart.items;
        var pli;
        //find the item in the cart by using the product id with for loop
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === productID) {
                pli = items[i];
                break;
            }
        }
        algoliaProductData.price = pli.price.sales.value;

        if (pli.price.list) {
            algoliaProductData.discount = +(
                pli.price.list.value - pli.price.sales.value
            ).toFixed(2);
        }
        algoliaProductData.currency = pli.price.sales.currency;

        viewData.algoliaProductData = algoliaProductData;
    }

    next();
});

module.exports = server.exports();
