'use strict';

var Site = require('dw/system/Site');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
var Logger = require('dw/system/Logger');
var Status = require('dw/system/Status');


exports.afterPOST = function (order) {
    var Algolia_EnableRealTimeInventoryHook = algoliaData.getPreference('EnableRealTimeInventoryHook');
    if (Algolia_EnableRealTimeInventoryHook) {
        var reindexHelper = require('*/cartridge/scripts/algolia/helper/reindexHelper');
        var productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');
        var ALGOLIA_IN_STOCK_THRESHOLD = algoliaData.getPreference('InStockThreshold');

        try {
            var algoliaOperations = [];
            var shipments = order.getShipments();
            for (var i = 0; i < shipments.length; i++) {
                var shipment = shipments[i];
                var plis = shipment.getProductLineItems();

                // Process each product line item based on shipment type
                if (shipment.custom.shipmentType === 'instore') {
                    // Handle in-store pickup shipments
                    for (let j = 0; j < plis.length; j++) {
                        let pli = plis[j];
                        let product = pli.product;

                        if (!isInStoreStock(product, shipment.custom.fromStoreId, ALGOLIA_IN_STOCK_THRESHOLD)) {
                            let productOps = getProductData(product, ['storeAvailability']);
                            algoliaOperations = algoliaOperations.concat(productOps);
                        }
                    }
                } else {
                    // Handle standard shipments
                    for (let j = 0; j < plis.length; j++) {
                        let pli = plis[j];
                        let product = pli.product;
                        var isInStock = productFilter.isInStock(product, ALGOLIA_IN_STOCK_THRESHOLD);

                        if (!isInStock) {
                            let productOps = getProductData(product, ['in_stock']);

                            if (algoliaData.getPreference('IndexOutOfStock')) {
                                algoliaOperations = algoliaOperations.concat(productOps);
                            } else {
                                productOps.forEach(function(productOp) {
                                    algoliaOperations = algoliaOperations.concat(new jobHelper.AlgoliaOperation(
                                        'deleteObject',
                                        { objectID: productOp.body.objectID }, 
                                        productOp.indexName
                                    ));
                                });
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

/**
 * Returns `true` if the product’s ATS >= threshold, false otherwise.
 * @param {dw.catalog.Product} product - The SFCC product or variant to check
 * @param {number} threshold - The min ATS to consider in-stock
 * @returns {boolean}
 */
function isInStoreStock(product, storeId, threshold) {
    var StoreMgr = require('dw/catalog/StoreMgr');
    var store = StoreMgr.getStore(storeId);
    var storeInventory = store.inventoryList;
    if (storeInventory) {
        var inventoryRecord = storeInventory.getRecord(product.ID);
        if (inventoryRecord && inventoryRecord.ATS.value && inventoryRecord.ATS.value >= threshold) {
            return true;
        }
    }
    return false;
}