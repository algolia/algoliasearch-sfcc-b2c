'use strict';

/**
 * Product index filter function
 * @param {dw.catalog.Product} product - Product
 * @returns {boolean} - True if product should be included in the index, false if not.
 */
function isInclude(product) {
    // Do not include Master product
    if (product.master || product.variationGroup) return false;
    // Do not include Option products
    // if (product.optionProduct) return false;
    // Do not include bundled product
    if (product.bundled && !(product.priceModel && product.priceModel.price && product.priceModel.price.available)) return false;
    return true;
}

/**
 * If IndexOutofStock is false, we only return `true` here if the product has
 * ATS >= InStockThreshold. If IndexOutofStock is true, then always return `true`.
 * @param {dw.catalog.Product} product - Product
 * @returns {boolean} - True if product should be included in the index, false if not.
 */
function isIncludeOutOfStock(product) {
    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    var ALGOLIA_IN_STOCK_THRESHOLD = algoliaData.getPreference('InStockThreshold');
    var indexOutOfStock = algoliaData.getPreference('IndexOutofStock');

    if (indexOutOfStock) {
        return true;
    }

    var invRecord = product.getAvailabilityModel().getInventoryRecord();
    var isOut = (!invRecord || invRecord.getATS().getValue() < ALGOLIA_IN_STOCK_THRESHOLD);
    return !isOut; // if outOfStock => return false, else return true
}

module.exports.isInclude = isInclude;
module.exports.isIncludeOutOfStock = isIncludeOutOfStock;
