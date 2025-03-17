'use strict';

var Site = require('dw/system/Site');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
var Logger = require('dw/system/Logger');
var Status = require('dw/system/Status');


exports.afterPOST = function (order) {
    var Algolia_EnableRealTimeInventory = algoliaData.getPreference('EnableRealTimeInventory');
    if (Algolia_EnableRealTimeInventory) {
        var reindexHelper = require('*/cartridge/scripts/algolia/helper/reindexHelper');

        try {
            var algoliaOperations = [];
            var shipments = order.getShipments();
            for (var i = 0; i < shipments.length; i++) {
                var shipment = shipments[i];
                var j;
                var k;
                var pli;
                var product;
                var productOps;
                var plis = shipment.getProductLineItems();
                //check if shipment is a pickup shipment
                if (shipment.custom.shipmentType === 'instore') {
                    for (j = 0; j < plis.length; j++) {
                        pli = plis[j];
                        product = pli.product;
                        productOps = getProductData(product, ['storeAvailability']);
                        for (k = 0; k < productOps.length; k++) {
                            var productOp = productOps[k];
                            // If the product is not available in the store anymore
                            if (productOp.body.storeAvailability.indexOf(shipment.custom.fromStoreId) === -1) {
                                algoliaOperations.push(productOp);
                            }
                        }
                    }
                } else {
                    for (j = 0; j < plis.length; j++) {
                        pli = plis[j];
                        product = pli.product;
                        productOps = getProductData(product, ['in_stock']);
                        for (k = 0; k < productOps.length; k++) {
                            productOp = productOps[k];
                            // If the product is not available in the inventory anymore
                            if (productOp.body.in_stock === false || productOp.body.in_stock === undefined) {
                                if (algoliaData.getPreference('IndexOutOfStock')) {
                                    algoliaOperations.push(productOp);
                                } else {
                                    // If the product is not available in the inventory anymore and the IndexOutOfStock preference is disabled, we need to remove the product from Algolia
                                    algoliaOperations.push(new jobHelper.AlgoliaOperation('deleteObject', { objectID: productOp.body.objectID }, productOp.indexName));
                                }
                            }
                        }
                    }
                }
            }
            if (algoliaOperations.length > 0) {
                reindexHelper.sendRetryableBatch(algoliaOperations);
            }
        } catch (error) {
            Logger.error('Error in afterPOST hook for Order: ' + order.orderNo + ', Message: ' + error.message);
        }
    }

    return new Status(Status.OK);
};


/**
 * Get the product data for the product
 * @param {dw.catalog.Product} product - The product to get the data for
 * @param {Array} attributes - The attributes to get the data for
 * @returns {Array} The product data
 */
function getProductData(product, attributes) {
    var algoliaOperations = [];
    var AlgoliaLocalizedProduct = require('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
    var baseModel = new AlgoliaLocalizedProduct({ product: product, locale: 'default', attributeList: attributes });
    var siteLocales = Site.getCurrent().getAllowedLocales();
    for (let l = 0; l < siteLocales.size(); ++l) {
        let locale = siteLocales[l];
        let indexName = algoliaData.calculateIndexName('products', locale);
        let localizedProduct = new AlgoliaLocalizedProduct({ product: product, locale: locale, attributeList: attributes, baseModel: baseModel });
        algoliaOperations.push(new jobHelper.AlgoliaOperation('partialUpdateObject', localizedProduct, indexName));
    }
    return algoliaOperations;
}


