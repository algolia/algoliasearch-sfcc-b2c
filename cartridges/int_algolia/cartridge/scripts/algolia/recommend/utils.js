'use strict';

var MASTER_LEVEL = 'master-level';

/**
 * @description Set anchor products for the current session based on the current record model
 * @returns {void}
 */
function anchorProductSetter() {
    var productIds = session.privacy.algoliaAnchorProducts;
    if (!productIds || productIds.length === 0) {
        return;
    }

    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    var recordModel = algoliaData.getPreference('RecordModel');
    if (recordModel !== MASTER_LEVEL) {
        return;
    }

    var productMgr = require('dw/catalog/ProductMgr');
    var algoliaAnchorProducts = [];

    productIds = JSON.parse(productIds);
    for (var i = 0; i < productIds.length; i++) {
        var productId = productIds[i];
        var product = productMgr.getProduct(productId);
        if (product) {
            var masterProduct = product.isVariant() ? product.getMasterProduct() : product;
            algoliaAnchorProducts.push(masterProduct.ID);
        }
    }

    session.privacy.algoliaAnchorProducts = JSON.stringify(algoliaAnchorProducts);
}

module.exports = {
    anchorProductSetter: anchorProductSetter
};