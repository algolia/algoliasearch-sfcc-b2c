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
function getAnchorProductIDs(slotcontent) {
    const anchorProductIDs = session.privacy.algoliaAnchorProducts;
    let productIDs = [];

    if (anchorProductIDs) {
        productIDs = JSON.parse(anchorProductIDs);
    } else {
        for (let i = 0; i < slotcontent.content.length; i++) {
            let product = slotcontent.content[i];
            productIDs.push(product.ID);
        }
    }

    if (productIDs.length === 0) {
        return '';
    }

    const productMgr = require('dw/catalog/ProductMgr');
    const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    const recordModel = algoliaData.getPreference('RecordModel');

    const anchorProductIDsArr = [];

    for (let i = 0; i < productIDs.length; i++) {
        var productId = productIDs[i];
        var product = productMgr.getProduct(productId);
        var appropriateProduct = getAppropriateProduct(product, recordModel);

        if (appropriateProduct) {
            anchorProductIDsArr.push(appropriateProduct.ID);
        }
    }

    return JSON.stringify(anchorProductIDsArr);
}

module.exports = {
    getAnchorProductIDs: getAnchorProductIDs
};
