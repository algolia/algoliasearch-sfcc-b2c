'use strict';

var server = require('server');
var base = module.superModule;
var BasketMgr = require('dw/order/BasketMgr');
var ProductMgr = require('dw/catalog/ProductMgr');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

server.extend(base);
const MASTER_LEVEL = 'master-level';

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

        var isBaseRecordModel = algoliaData.getPreference('RecordModel') === MASTER_LEVEL;
        var productId = req.form.pid;
        var viewData = res.getViewData();
        var algoliaProductData = {};

        try {
            if (isBaseRecordModel) {
                var product = ProductMgr.getProduct(productId);
                algoliaProductData.pid = product.masterProduct.ID;
            } else {
                algoliaProductData.pid = productId;
            }
        } catch (e) {
            algoliaProductData.pid = productId;
        }

        algoliaProductData.qty = req.form.quantity;
        var items = viewData.cart.items;
        var pli;
        //find the item in the cart by using the product id with for loop
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === productId) {
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
