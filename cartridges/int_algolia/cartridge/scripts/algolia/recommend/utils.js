'use strict';

var MASTER_LEVEL = 'master-level';

/**
 * @description - Get master product IDs for the given product IDs
 * @param {Array} productIDs - List of product IDs
 * @returns {void}
 */
function getMasterProductIds(productIDs) {
    var masterProductIDs = [];
    var productIds = session.privacy.algoliaAnchorProducts;
    if (!productIds || productIds.length === 0) {
        return;
    }

    var productMgr = require('dw/catalog/ProductMgr');

    productIds = JSON.parse(productIds);
    for (var i = 0; i < productIds.length; i++) {
        var productId = productIds[i];
        var product = productMgr.getProduct(productId);
        if (product) {
            var masterProduct = product.isVariant() ? product.getMasterProduct() : product;
            masterProductIDs.push(masterProduct.ID);
        }
    }

    return masterProductIDs;
}

/**
 * @description - Get anchor products for the given slot content
 * @param {Object} slotcontent - Slot content
 * @returns {string} - Product IDs
 */
function getAnchorProductIds(slotcontent) {
    productIds = [];
    var productIdsString = "";

    if (session.privacy.algoliaAnchorProducts) {
        var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
        var recordModel = algoliaData.getPreference('RecordModel');
        if (recordModel === MASTER_LEVEL) {
            productIds = getMasterProductIds(JSON.parse(session.privacy.algoliaAnchorProducts));
        } else {
            return session.privacy.algoliaAnchorProducts;
        }
    } else {
        for (var i = 0; i < slotcontent.content.length; i++) {
            var product = slotcontent.content[i];
            productIds.push(product.ID);
        }
    }

    return JSON.stringify(productIds);
}

module.exports = {
    getMasterProductIds: getMasterProductIds,
    getAnchorProductIds: getAnchorProductIds
};