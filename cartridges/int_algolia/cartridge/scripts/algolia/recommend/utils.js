'use strict';

const { RECORD_MODEL_TYPES } = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

// Since the number of distinct products in a cart can be high, we limit the number
// of anchor products to 5 to avoid high costs for virtually no benefit.
const MAX_ANCHOR_PRODUCTS = 5;

/**
 * Resolves the objectID that recommendations for a product should be anchored on.
 *
 * The anchor has to name a record that exists in the index, which is not always the product's own
 * ID. Under the master-level model a variant is indexed as its master. Under the attribute-sliced
 * model it is indexed as the slice that holds its grouping attribute value.
 *
 * Masters and variation groups only get a record of their own under the master-level model. Under
 * the other two they are not indexed at all, so this anchors on their default variant instead.
 *
 * @param {dw.catalog.Product} product any catalog product, masters and VariationGroups included; may be null
 * @param {string} recordModel one of RECORD_MODEL_TYPES
 * @returns {string | null} the objectID to anchor on, or null when the product has no record
 */
function getAnchorRecordID(product, recordModel) {
    const modelHelper = require('*/cartridge/scripts/algolia/helper/modelHelper');

    if (empty(product)) {
        return null;
    }

    let anchorProduct = product;

    if (recordModel !== RECORD_MODEL_TYPES.MASTER_LEVEL && (product.isMaster() || product.isVariationGroup())) {
        anchorProduct = product.getVariationModel().getDefaultVariant();

        if (empty(anchorProduct)) {
            return null;
        }
    }

    return modelHelper.getRecordIDForProduct(anchorProduct, recordModel);
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
            productIDs.push(product.getID());
        }
    }

    if (productIDs.length === 0) {
        return '';
    }

    const productMgr = require('dw/catalog/ProductMgr');
    const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    const recordModel = algoliaData.getPreference('RecordModel');

    const anchorProductIDsArr = [];

    for (let i = 0; i < productIDs.length && anchorProductIDsArr.length < MAX_ANCHOR_PRODUCTS; i++) {
        let product = productMgr.getProduct(productIDs[i]);
        let anchorRecordID = getAnchorRecordID(product, recordModel);

        // Several products can resolve to the same record, for example two sizes of one color
        // under the attribute-sliced model. Sending a duplicate anchor costs a request and returns
        // the same recommendations.
        if (anchorRecordID && anchorProductIDsArr.indexOf(anchorRecordID) === -1) {
            anchorProductIDsArr.push(anchorRecordID);
        }
    }

    return JSON.stringify(anchorProductIDsArr);
}

module.exports = {
    getAnchorProductIDs: getAnchorProductIDs
};
