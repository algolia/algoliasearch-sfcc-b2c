'use strict';

const { RECORD_MODEL_TYPES } = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

// Every anchor objectID is one Recommend request against the plan, and the widgets show at most
// `maxRecommendations` items no matter how many anchors they were given, so more anchors cost more
// without showing more. Algolia also rejects a multi-query with more than 50 entries
// ("Too many queries in multi query request", status 400), which fails the whole widget, so this
// has to stay well below 50.
const MAX_ANCHOR_PRODUCTS = 5;

/**
 * Returns the product that owns the record the given product is indexed under.
 *
 * Under the master-level model the master carries the record, so variants and variation groups
 * resolve to their master. Under the other two models masters and variation groups are not indexed
 * at all, so they resolve to their default variant. Every other product type carries its own
 * record under all three models.
 *
 * `getDefaultVariant()` returns an arbitrary variant when the master has no default variant
 * defined, so a master always resolves to a variant as long as it has one. Which variant it is
 * does not affect whether the anchor is valid: under the variant-level model every variant has its
 * own record, and under the attribute-sliced model the slices are cut from the master rather than
 * from the variation group, so any variant of the master resolves to a record that exists.
 *
 * @param {dw.catalog.Product} product a catalog product, master and variation group included
 * @param {string} recordModel one of RECORD_MODEL_TYPES
 * @returns {dw.catalog.Product | null} the product whose record is the anchor, or null when the
 *                                     variation model has no variants to fall back to
 */
function getIndexedProduct(product, recordModel) {
    if (recordModel === RECORD_MODEL_TYPES.MASTER_LEVEL) {
        return (product.isVariant() || product.isVariationGroup()) ? product.getMasterProduct() : product;
    }

    if (product.isMaster() || product.isVariationGroup()) {
        return product.getVariationModel().getDefaultVariant();
    }

    return product;
}

/**
 * Resolves the objectID that recommendations for a product should be anchored on.
 *
 * The anchor has to name the record the product is indexed under, which is not always the product's
 * own ID. Under the master-level model a variant is indexed as its master. Under the
 * attribute-sliced model it is indexed as the slice that holds its grouping attribute value.
 *
 * Masters and variation groups only get a record of their own under the master-level model. Under
 * the other two they are not indexed at all, so this anchors on their default variant instead.
 *
 * Whether the resolved record is actually in the index is left to Algolia. A product can be in the
 * catalog but out of the index, for example after going out of stock or offline, but the inventory
 * hook and the delta jobs keep that window short, and the storefront search is out of sync for the
 * same window.
 *
 * @param {dw.catalog.Product} product any catalog product, masters and VariationGroups included; may be null
 * @param {string} recordModel one of RECORD_MODEL_TYPES
 * @param {string} [groupingAttribute] the grouping attribute of the attribute-sliced model, read
 *                                     from the site preferences when omitted
 * @returns {string | null} the objectID to anchor on, or null when it cannot be resolved
 */
function getAnchorRecordID(product, recordModel, groupingAttribute) {
    const modelHelper = require('*/cartridge/scripts/algolia/helper/modelHelper');

    if (empty(product)) {
        return null;
    }

    // null for a master with no variants, which has no record under any model
    const indexedProduct = getIndexedProduct(product, recordModel);

    if (empty(indexedProduct)) {
        return null;
    }

    return modelHelper.getRecordIDForProduct(indexedProduct, recordModel, groupingAttribute);
}

/**
 * Builds the list of objectIDs the Recommend widgets in a slot anchor on, from the product IDs in
 * `session.privacy.algoliaAnchorProducts` or, when that is not set, from the products configured on
 * the slot itself.
 *
 * @param {dw.campaign.SlotContent} [slotcontent] slot content, used when the session holds no anchor products
 * @returns {string} a JSON array of objectIDs, or an empty string when there is nothing to anchor on
 */
function getAnchorProductIDs(slotcontent) {
    const anchorProductIDs = session.privacy.algoliaAnchorProducts;
    let productIDs = [];

    if (anchorProductIDs) {
        productIDs = JSON.parse(anchorProductIDs);
    } else if (slotcontent && slotcontent.content) {
        for (let i = 0; i < slotcontent.content.length; i++) {
            productIDs.push(slotcontent.content[i].getID());
        }
    }

    if (productIDs.length === 0) {
        return '';
    }

    const productMgr = require('dw/catalog/ProductMgr');
    const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

    const recordModel = algoliaData.getPreference('RecordModel');

    // read once here instead of once per product inside getAttributeSlicedModelRecordID()
    const groupingAttribute = recordModel === RECORD_MODEL_TYPES.ATTRIBUTE_SLICED
        ? algoliaData.getPreference('AttributeSlicedRecordModel_GroupingAttribute')
        : null;

    const anchorProductIDsArr = [];

    for (let i = 0; i < productIDs.length && anchorProductIDsArr.length < MAX_ANCHOR_PRODUCTS; i++) {
        let anchorRecordID = getAnchorRecordID(productMgr.getProduct(productIDs[i]), recordModel, groupingAttribute);

        // Several products can resolve to the same record, for example two sizes of one color
        // under the attribute-sliced model. Sending a duplicate anchor costs a request and returns
        // the same recommendations.
        if (anchorRecordID && anchorProductIDsArr.indexOf(anchorRecordID) === -1) {
            anchorProductIDsArr.push(anchorRecordID);
        }
    }

    // An empty array is truthy in `recommend-config.js`, which would build a widget with no
    // objectIDs. An empty attribute value makes it skip the widget instead.
    return anchorProductIDsArr.length > 0 ? JSON.stringify(anchorProductIDsArr) : '';
}

module.exports = {
    MAX_ANCHOR_PRODUCTS: MAX_ANCHOR_PRODUCTS,
    getAnchorRecordID: getAnchorRecordID,
    getAnchorProductIDs: getAnchorProductIDs
};
