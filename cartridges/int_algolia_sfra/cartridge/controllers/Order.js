'use strict';

var server = require('server');
var base = module.superModule;
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var priceHelper = require('*/cartridge/scripts/algolia/helper/priceHelper');
var modelHelper = require('*/cartridge/scripts/algolia/helper/modelHelper');
var algoliaLogger = require('dw/system/Logger').getLogger('algolia');

var OrderMgr = require('dw/order/OrderMgr');

server.extend(base);

server.append('Confirm', function (req, res, next) {
    if (algoliaData.getPreference('Enable') && algoliaData.getPreference('EnableInsights')) {

        var viewData = res.getViewData();
        var order = viewData.order;

        // The base controller renders its error template and continues the chain when the order
        // cannot be resolved, so there is nothing to report on in that case.
        if (!order) {
            return next();
        }

        var fullOrder = OrderMgr.getOrder(order.orderNumber);
        // Only the line items a shopper chose: option and bundled line items are dependent on a
        // parent line item, and their prices are already part of the parent's reported price.
        var plis = fullOrder.getProductLineItems();
        var algoliaProducts = [];
        var currency = fullOrder.getCurrencyCode();
        var recordModel = algoliaData.getPreference('RecordModel');

        var pliArr = plis.toArray();

        for (var i = 0; i < pliArr.length; i++) {
            var product = pliArr[i].getProduct();

            if (product) {
                var algoliaProduct = {};
                var recordID = null;

                try {
                    recordID = modelHelper.getRecordIDForProduct(product, recordModel);
                } catch (e) { // eslint-disable-line no-unused-vars
                    recordID = null;
                }

                // Without a record ID there is nothing in the index to attach the revenue to, so
                // the product is left out rather than reported under an ID the index does not hold.
                if (!recordID) {
                    algoliaLogger.warn('No "{0}" record ID resolved for product "{1}", it is not part of the purchase event.', recordModel, product.getID());
                    continue;
                }

                algoliaProduct.pid = recordID;

                var priceData = priceHelper.getLineItemPriceData(pliArr[i]);
                if (!priceData) {
                    continue;
                }

                algoliaProduct.price = priceData.price;
                if ('discount' in priceData) {
                    algoliaProduct.discount = priceData.discount;
                }
                algoliaProduct.qty = pliArr[i].getQuantityValue();
                algoliaProducts.push(algoliaProduct);
            }
        };

        // An empty item list would produce a purchase event with no objectIDs, which the Insights
        // API rejects, so the event is left unsent instead.
        if (algoliaProducts.length > 0) {
            const algoliaObj = {
                items: algoliaProducts,
                currency: currency
            }

            viewData.algoliaObj = algoliaObj;

            res.setViewData(viewData);
        }
    }

    next();
});

module.exports = server.exports();
