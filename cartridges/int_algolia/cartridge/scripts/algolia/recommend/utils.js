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

module.exports = {
    getMasterProductIds: getMasterProductIds
};