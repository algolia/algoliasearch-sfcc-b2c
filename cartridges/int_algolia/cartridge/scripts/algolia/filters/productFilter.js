'use strict';

// Load configuration
let config;
try {
    config = require('*/cartridge/configuration/productFilterConfig');
} catch (e) { // eslint-disable-line no-unused-vars
    // If no custom config exists, use defaults
    config = {
        includeOfflineProducts: false,
        includeNotSearchableProducts: false,
        includeProductsWithoutOnlineCategories: false
    };
}

/**
 * Checks if a product is online
 * @param {dw.catalog.Product} product - Product to check
 * @returns {boolean} - True if product is online, false otherwise
 */
function isOnline(product) {
    // If includeOfflineProducts is enabled in config, always return true
    if (config.includeOfflineProducts === true) {
        return true;
    }
    return product.online;
}

/**
 * Checks if a product is searchable
 * @param {dw.catalog.Product} product - Product to check
 * @returns {boolean} - True if product is searchable, false otherwise
 */
function isSearchable(product) {
    // If includeNotSearchableProducts is enabled in config, always return true
    if (config.includeNotSearchableProducts === true) {
        return true;
    }
    return product.searchable;
}

/**
 * Checks if a product has at least one online category
 * @param {dw.catalog.Product} product - Product to check
 * @returns {boolean} - True if product has at least one online category, false otherwise
 */
function hasOnlineCategory(product) {
    // If includeProductsWithoutOnlineCategories is enabled in config, always return true
    if (config.includeProductsWithoutOnlineCategories === true) {
        return true;
    }
    var categories = product.getOnlineCategories();
    return categories && categories.length > 0 ? true : false; // To cover unit tests that expect a boolean return value
}

/**
 * Product index filter function
 * Note: if you want to check filter status for master products, you should use isOnline and isSearchable, hasOnlineCategory functions separately.
 * @param {dw.catalog.Product | dw.catalog.Variant} product - Product
 * @returns {boolean} - True if product should be included in the index, false if not.
 */
function isInclude(product) {
    // Do not include Master product
    if (product.isMaster() || product.isVariationGroup()) return false;
    // Do not include Option products
    // if (product.optionProduct) return false;
    // Do not include bundled product
    if (product.bundled && !(product.priceModel && product.priceModel.price && product.priceModel.price.available)) return false;

    // Check online status
    if (!isOnline(product)) return false;

    // Check searchable status
    if (!isSearchable(product)) return false;

    // Check if product has at least one online category
    // Note: In SFCC, variant products don't have their own categories - getOnlineCategories() returns empty for variants
    // We must check categories on the master product instead
    if (product.isVariant()) { // dw.catalog.Variant
        var masterProduct = product.getMasterProduct();
        if (masterProduct && !hasOnlineCategory(masterProduct)) return false;
    } else {
        if (!hasOnlineCategory(product)) return false;
    }

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
    if (product.isMaster() || product.isVariationGroup()) {
        const variantsIt = product.variants.iterator();

        while (variantsIt.hasNext()) {
            let variant = variantsIt.next();
            let variantAvailabilityModel = variant.getAvailabilityModel();

            if (variantAvailabilityModel) {
                let variantInvRecord = variantAvailabilityModel.getInventoryRecord();

                if (variantInvRecord) {
                    let variantATSValue = variantInvRecord.getATS().getValue();

                    if (variantATSValue > 0 && variantATSValue >= threshold) { // comparing to zero explicitly so that a threshold of 0 wouldn't return true
                        return true;
                    }
                }
            }
        }
    }

    var invRecord = availabilityModel.getInventoryRecord();
    var atsValue = invRecord ? invRecord.getATS().getValue() : 0;

    return (atsValue > 0 && atsValue >= threshold);
}

/**
 * Checks if at least one variant in a variation model is in stock.
 * @param {dw.catalog.ProductVariationModel} variationModel
 * @param {Number} threshold
 * @returns {Boolean} whether at least one of the variants is in stock
 */
function isCustomVariationGroupInStock(variationModel, threshold) {
    const variantsIt = variationModel.getSelectedVariants().iterator();
    while (variantsIt.hasNext()) {
        let variant = variantsIt.next();
        let variantATSValue = variant.getAvailabilityModel().getInventoryRecord().getATS().getValue();
        if (variantATSValue > 0 && variantATSValue >= threshold) {
            return true;
        }
    }

    return false;
}

/**
 * Checks store inventory for a given product and determines
 * whether it meets the ATS threshold for being in stock.
 *
 * @param {dw.catalog.Product} product - The product or variant to check.
 * @param {string} storeId - The store identifier.
 * @param {number} threshold - The ATS threshold value considered in-stock.
 * @returns {boolean} True if in stock for the specified store, false otherwise.
 */
function isInStoreStock(product, storeId, threshold) {
    const StoreMgr = require('dw/catalog/StoreMgr');
    let store = StoreMgr.getStore(storeId);

    if (!store || !store.inventoryList) {
        return false;
    }

    let storeInventory = store.inventoryList;
    let inventoryRecord = storeInventory.getRecord(product.ID);

    if (inventoryRecord && inventoryRecord.ATS.value && inventoryRecord.ATS.value >= threshold && inventoryRecord.ATS.value > 0) { // comparing to zero explicitly so that a threshold of 0 wouldn't return true
        return true;
    }

    return false;
}

module.exports = {
    isInStock: isInStock,
    isCustomVariationGroupInStock: isCustomVariationGroupInStock,
    isInclude: isInclude,
    isInStoreStock: isInStoreStock,
    isOnline: isOnline,
    isSearchable: isSearchable,
    hasOnlineCategory: hasOnlineCategory
};
