'use strict';

const MASTER_LEVEL = 'master-level';

/**
 * Get the product type
 * @param {dw.catalog.Product} product - Product
 * @returns {string} The product type
 */
function getProductType(product) {
    if (product.isVariationGroup()) {
        return 'Variation Group';
    } else if (product.isVariant()) {
        return 'Variant';
    } else {
        return 'Master';
    }
}

/**
 * Get the appropriate product
 * @param {dw.catalog.Product} product - Product
 * @param {string} recordModel - Record model
 * @returns {dw.catalog.Product} The appropriate product
 */
function getAppropriateProduct(product, recordModel) {
    const productType = getProductType(product);
    if (recordModel === MASTER_LEVEL && productType !== 'Master') {
        return product.masterProduct;
    } else if (recordModel === MASTER_LEVEL && (productType === 'Master' || productType === 'Variation Group')) {
        return product;
    } else if (recordModel !== MASTER_LEVEL && (productType === 'Master' || productType === 'Variation Group')) {
        return product.variationModel.defaultVariant;
    } else if (recordModel !== MASTER_LEVEL && productType === 'Variant') {
        return product;
    }
    return product;
}

/**
 * Get the anchor product IDs
 * @param {Object} slotcontent - Slot content
 * @returns {string} The anchor product IDs
 */
function getAnchorProductIds(slotcontent) {
    const anchorProductIds = session.privacy.algoliaAnchorProducts;
    let productIds = [];

    if (anchorProductIds) {
        productIds = JSON.parse(anchorProductIds);
    } else {
        for (let i = 0; i < slotcontent.content.length; i++) {
            var product = slotcontent.content[i];
            productIds.push(product.ID);
        }
    }

    if (productIds.length === 0) {
        return '';
    }

    const productMgr = require('dw/catalog/ProductMgr');
    const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    const recordModel = algoliaData.getPreference('RecordModel');

    const anchorProductIdsArr = [];

    for (let i = 0; i < productIds.length; i++) {
        var productId = productIds[i];
        var product = productMgr.getProduct(productId);
        var appropriateProduct = getAppropriateProduct(product, recordModel);

        if (appropriateProduct) {
            anchorProductIdsArr.push(appropriateProduct.ID);
        }
    }

    return JSON.stringify(anchorProductIdsArr);
}

module.exports = {
    getAnchorProductIds: getAnchorProductIds
};