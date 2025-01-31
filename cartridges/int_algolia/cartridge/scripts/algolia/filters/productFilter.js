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
 * Returns `true` if the product’s ATS >= threshold, false otherwise.
 * @param {dw.catalog.Product} product - The SFCC product or variant to check
 * @param {number} threshold - The min ATS to consider in-stock
 * @returns {boolean}
 */
function isInStock(product, threshold) {
    var availabilityModel = product.getAvailabilityModel();
    if (!availabilityModel) {
        return false;
    }

    // if the master is in stock, then we assume all variants are in stock - Threshold is not applied
    // Otherwise, we need to check each variants stock status and it is so complex and will increase job time
    if (product.master || product.variationGroup) {
        return availabilityModel.availabilityStatus === 'IN_STOCK';
    }

    var invRecord = availabilityModel.getInventoryRecord();
    var atsValue = invRecord ? invRecord.getATS().getValue() : 0;
    return atsValue >= threshold;
}



module.exports = {
    isInStock: isInStock,
    isInclude: isInclude,
};
