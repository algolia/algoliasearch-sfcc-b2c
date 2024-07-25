'use strict';

var server = require('server');
var base = module.superModule;
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var priceFactory = require('*/cartridge/scripts/factories/price')

var OrderMgr = require('dw/order/OrderMgr');

server.extend(base);
const MASTER_LEVEL = 'master-level';



server.append('Confirm', function (req, res, next) {
    if (algoliaData.getPreference('Enable') && algoliaData.getPreference('EnableInsights')) {

        var viewData = res.getViewData();
        var order = viewData.order;
        var Order = OrderMgr.getOrder(order.orderNumber);
        var plis = Order.getAllProductLineItems();
        var algoliaProducts = [];
        var currency;
        var isBaseRecordModel = algoliaData.getPreference('RecordModel') === MASTER_LEVEL;

        var pliArr = plis.toArray();

        for (var i = 0; i < pliArr.length; i++) {
            var product = pliArr[i].getProduct();

            if (product && !product.optionProduct) {
                var algoliaProduct = {};

                if (isBaseRecordModel) {
                    algoliaProduct.pid = product.isMaster() || product.isVariationGroup() ? product.ID : product.masterProduct.ID;
                } else {
                    algoliaProduct.pid = product.ID;
                }

                var price = priceFactory.getPrice(product);
                algoliaProduct.price = price;
                if (price.list) {
                    algoliaProduct.discount = +(price.list.value - price.sales.value).toFixed(2);
                }
                currency = price.sales.currency;
                algoliaProduct.qty = pliArr[i].quantityValue;
                algoliaProducts.push(algoliaProduct);
            }
        };

        const algoliaObj = {
            items: algoliaProducts,
            currency: currency
        }

        viewData.algoliaObj = algoliaObj;

        res.setViewData(viewData);
    }

    next();
});

module.exports = server.exports();
