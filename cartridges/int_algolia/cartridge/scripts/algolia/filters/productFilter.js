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

    // even if one variant is in stock, we consider the product as in stock
    if (product.master || product.variationGroup) {
        const variantsIt = product.variants.iterator();
        while (variantsIt.hasNext()) {
            let variant = variantsIt.next();
            let variantAvailabilityModel = variant.getAvailabilityModel();
            if (variantAvailabilityModel) {
                let variantInvRecord = variantAvailabilityModel.getInventoryRecord();
                if (variantInvRecord) {
                    let variantAtsValue = variantInvRecord.getATS().getValue();
                    if (variantAtsValue >= threshold) {
                        return true;
                    }
                }
            }
        }
    }

    var invRecord = availabilityModel.getInventoryRecord();
    var atsValue = invRecord ? invRecord.getATS().getValue() : 0;
    return atsValue >= threshold;
}

module.exports = {
    isInStock: isInStock,
    isInclude: isInclude,
};
