'use strict';

const { RECORD_MODEL_TYPES } = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

// Every anchor objectID is one Recommend request against the plan, and the widgets show at most
// `maxRecommendations` items however many anchors they were given, so more anchors cost more
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
 * @param {dw.catalog.Product} product a catalog product, master and variation group included
 * @param {string} recordModel one of RECORD_MODEL_TYPES
 * @returns {dw.catalog.Product | null} the product whose record is the anchor, or null when the
 *                                     master has no default variant to fall back to
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
 * Reports whether a product passes the three catalog filters the indexing jobs apply to a master
 * product. `productFilter.isInclude()` cannot be used for that, because it rejects every master by
 * design.
 *
 * @param {dw.catalog.Product} product a master product
 * @returns {boolean} whether the master is online, searchable and in an online category
 */
function passesMasterFilters(product) {
    const productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');

    return productFilter.isOnline(product) && productFilter.isSearchable(product) && productFilter.hasOnlineCategory(product);
}

/**
 * Reports whether a master product has at least one variant that the indexing jobs would put in
 * its `variants` array, which is what decides whether the master's record is written at all.
 *
 * This mirrors the two conditions the `variants` handler in `algoliaLocalizedProduct.js` applies to
 * each variant. It stops at the first variant that passes, so a master with stock costs one
 * variant; only a master with nothing indexable is walked in full.
 *
 * @param {dw.catalog.Product} master a master product
 * @param {number} inStockThreshold minimum ATS for a variant to count as in stock
 * @returns {boolean} whether the master has at least one indexable, in-stock variant
 */
function hasIndexableVariantInStock(master, inStockThreshold) {
    const productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');
    const variantsIt = master.getVariants().iterator();

    while (variantsIt.hasNext()) {
        let variant = variantsIt.next();

        if (productFilter.isInclude(variant) && productFilter.isInStock(variant, inStockThreshold)) {
            return true;
        }
    }

    return false;
}

/**
 * Reports whether a product has a record in the index, applying the same filters the indexing jobs
 * apply when they decide whether to write one.
 *
 * Anchoring on an objectID that has no record is not answered with an empty result set, so this
 * errs on the side of dropping an anchor rather than keeping a doubtful one. The remaining
 * imprecision is in that direction: under the attribute-sliced model an anchor is dropped when the
 * anchor variant itself is not indexable, even though a sibling variant of the same grouping value
 * may have kept the slice in the index.
 *
 * @param {dw.catalog.Product} product the product that owns the record, from getIndexedProduct()
 * @param {string} recordModel one of RECORD_MODEL_TYPES
 * @param {Object} sitePreferences stock-related preference values
 * @param {number} sitePreferences.InStockThreshold minimum ATS for a product to count as in stock
 * @param {boolean} sitePreferences.IndexOutOfStock whether out-of-stock products are indexed
 * @returns {boolean} whether the product's record exists in the index
 */
function hasIndexedRecord(product, recordModel, sitePreferences) {
    const productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');

    // Under the attribute-sliced model every slice is built from the master, so the master has to
    // pass the catalog filters before any of its slices exists.
    if (recordModel === RECORD_MODEL_TYPES.ATTRIBUTE_SLICED && product.isVariant() && !passesMasterFilters(product.getMasterProduct())) {
        return false;
    }

    if (product.isMaster()) {
        return passesMasterFilters(product)
            && (sitePreferences.IndexOutOfStock || hasIndexableVariantInStock(product, sitePreferences.InStockThreshold));
    }

    return productFilter.isInclude(product)
        && (sitePreferences.IndexOutOfStock || productFilter.isInStock(product, sitePreferences.InStockThreshold));
}

/**
 * Reads the site preference values the anchor resolution depends on. Callers that resolve more than
 * one anchor should read them once and pass them along.
 *
 * @returns {Object} preference values, in the shape getAnchorRecordID() expects
 */
function readSitePreferences() {
    const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

    return {
        // mirrors the fallback in algoliaProductIndex.js, which is what an unset preference resolves to there
        InStockThreshold: algoliaData.getPreference('InStockThreshold') || 1,
        IndexOutOfStock: algoliaData.getPreference('IndexOutOfStock'),
        AttributeSlicedRecordModel_GroupingAttribute: algoliaData.getPreference('AttributeSlicedRecordModel_GroupingAttribute'),
    };
}

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
 * A product that has no record in the index is not anchored on at all, so that the widget does not
 * spend a request on an objectID that matches nothing.
 *
 * @param {dw.catalog.Product} product any catalog product, masters and VariationGroups included; may be null
 * @param {string} recordModel one of RECORD_MODEL_TYPES
 * @param {Object} [sitePreferences] preference values, read from the site preferences when omitted
 * @param {number} sitePreferences.InStockThreshold minimum ATS for a product to count as in stock
 * @param {boolean} sitePreferences.IndexOutOfStock whether out-of-stock products are indexed
 * @param {string} [sitePreferences.AttributeSlicedRecordModel_GroupingAttribute] the grouping attribute, for the attribute-sliced model
 * @returns {string | null} the objectID to anchor on, or null when the product has no record
 */
function getAnchorRecordID(product, recordModel, sitePreferences) {
    const modelHelper = require('*/cartridge/scripts/algolia/helper/modelHelper');

    if (empty(product)) {
        return null;
    }

    const preferences = sitePreferences || readSitePreferences();
    const indexedProduct = getIndexedProduct(product, recordModel);

    if (empty(indexedProduct) || !hasIndexedRecord(indexedProduct, recordModel, preferences)) {
        return null;
    }

    return modelHelper.getRecordIDForProduct(indexedProduct, recordModel, preferences.AttributeSlicedRecordModel_GroupingAttribute);
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
    const sitePreferences = readSitePreferences();

    const anchorProductIDsArr = [];

    for (let i = 0; i < productIDs.length && anchorProductIDsArr.length < MAX_ANCHOR_PRODUCTS; i++) {
        let anchorRecordID = getAnchorRecordID(productMgr.getProduct(productIDs[i]), recordModel, sitePreferences);

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
