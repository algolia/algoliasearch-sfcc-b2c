'use strict';

var server = require('server');
var base = module.superModule;
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var priceFactory = require('*/cartridge/scripts/factories/price')

var OrderMgr = require('dw/order/OrderMgr');

server.extend(base);

const RECORD_MODEL_TYPE = {
    MASTER_LEVEL: 'master-level',
    VARIANT_LEVEL: 'variant-level',
    ATTRIBUTE_SLICED: 'attribute-sliced',
}

server.append('Confirm', function (req, res, next) {
    if (algoliaData.getPreference('Enable') && algoliaData.getPreference('EnableInsights')) {

        var viewData = res.getViewData();
        var order = viewData.order;
        var fullOrder = OrderMgr.getOrder(order.orderNumber);
        var plis = fullOrder.getAllProductLineItems();
        var algoliaProducts = [];
        var currency;

        var pliArr = plis.toArray();

        for (var i = 0; i < pliArr.length; i++) {
            var product = pliArr[i].getProduct();

            if (product) {
                var algoliaProduct = {};

                try {
                    algoliaProduct.pid = algoliaData.getPreference('RecordModel') === RECORD_MODEL_TYPE.MASTER_LEVEL ? product.masterProduct.ID : product.ID;
                } catch (e) { // eslint-disable-line no-unused-vars
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
