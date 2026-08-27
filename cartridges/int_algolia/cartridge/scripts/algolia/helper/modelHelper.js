const URLUtils = require('dw/web/URLUtils');

const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();

const COLOR_ATTRIBUTE_ID = 'color';

const IS_PWA = false; // You can set this to true if you are using PWA, this is used to determine if we should return the colorCode that is necessary for PWA

/**
 * Return colorVariations for a product, based on its variation model
 * @param {dw.catalog.Product} product Product
 * @param {string} locale The desired locale
 * @return {[{title, alt, url, variationURL}]} An array of swatches
 */
function getColorVariations(product, locale) {
    if (locale) {
        request.setLocale(locale);
    }

    var colorVariations = [];
    var variationModel = product.getVariationModel();
    var colorVariationAttribute = variationModel.getProductVariationAttribute(COLOR_ATTRIBUTE_ID);
    if (!colorVariationAttribute) {
        return null;
    }
    var values = variationModel.getAllValues(colorVariationAttribute).iterator();
    while (values.hasNext()) {
        var colorValue = values.next();
        var hasOrderableVariants = variationModel.hasOrderableVariants(
            colorVariationAttribute,
            colorValue
        );
        if (!hasOrderableVariants) {
            logger.info(
                'Product ' + product.getID() + ' has no orderable variant for color ' + colorValue.getValue()
            );
            continue;
        }
        var image_groups = getColorVariationImagesGroup(variationModel, colorValue);


        if (image_groups) {

            var variationObject = {
                image_groups: image_groups,
                variationURL: URLUtils.url(
                    'Product-Show',
                    'pid',
                    product.getID(),
                    variationModel.getHtmlName(colorVariationAttribute), // returns 'dwvar_' + product.ID + '_color',
                    colorValue.getValue()
                ).toString(),
                color: colorValue.getDisplayValue(),
            };

            if (IS_PWA) {
                variationObject.colorCode = colorValue.getValue(); // Required to create product detail page URL in PWA
            }

            colorVariations.push(variationObject);
        }
    }
    return colorVariations;
}

/**
 * Return the image_groups of a given color for a VariationModel
 *
 * @param {dw.catalog.ProductVariationModel} variationModel a variation model
 * @param {dw.catalog.ProductVariationAttributeValue} colorAttributeValue a 'color' variation value
 * @return {*[]|null} An image_groups object for the given color value
 */
function getColorVariationImagesGroup(variationModel, colorAttributeValue) {
    var imageGroupsArr = [];

    variationModel.setSelectedAttributeValue('color', colorAttributeValue.getID());

    ['large', 'small', 'swatch'].forEach(function (viewtype) {
        var imagesList = variationModel.getImages(viewtype);
        var imageGroups = getImageGroups(imagesList, viewtype);
        if (!empty(imageGroups)) {
            imageGroupsArr.push(imageGroups);
        }
    });
    return imageGroupsArr.length > 0 ? imageGroupsArr : null;
}

/**
 * Function to generate Algolia Image Group of a list of dw.content.MediaFile
 * @param {dw.util.List} imagesList - a list of dw.content.MediaFile
 * @param {string} viewtype - the current viewtype
 * @returns  {Object} - Algolia Image Group Object
 */
function getImageGroups(imagesList, viewtype) {
    if (empty(imagesList)) {
        return null;
    }

    var result = {
        _type: 'image_group',
        images: [],
        view_type: viewtype,
    };

    var imagesListSize = imagesList.size();
    for (var i = 0; i < imagesListSize; ++i) {
        var image = {
            _type: 'image',
            alt: {},
            dis_base_link: {},
            title: {},
        };

        var mediaFile = imagesList.get(i);
        image.alt = mediaFile.getAlt();
        image.dis_base_link = mediaFile.getAbsURL().toString();
        image.title = mediaFile.getTitle();

        result.images.push(image);
    }

    return result;
}

/**
 * Build the attribute-sliced record product ID for a product.
 * @param {dw.catalog.Product | dw.catalog.Variant} product Product or Variant
 * @returns {string | null} Attribute-sliced product ID
 */
function getAttributeSlicedModelRecordID(product) {
    const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    let variationAttributeForAttributeSlicedRecordModel = algoliaData.getPreference('AttributeSlicedRecordModel_GroupingAttribute');

    let recordID = null;

    if (!empty(product) && !empty(variationAttributeForAttributeSlicedRecordModel)) {
        if (product.isMaster()) { // only for compatibility and reusability of the helper -- product added to the cart cannot be a master
            recordID = product.getID();
        } else if (product.isVariant()) {
            let productVariationModel = product.getVariationModel();
            let variationAttribute = productVariationModel.getProductVariationAttribute(variationAttributeForAttributeSlicedRecordModel);
            let masterProduct = productVariationModel.getMaster();
            let masterID = masterProduct.getID();

            if (!empty(variationAttribute)) { // attribute-sliced master record
                let variationAttributeValue = productVariationModel.getSelectedValue(variationAttribute);
                if (!empty(variationAttributeValue)) {
                    recordID = masterID + '-' + variationAttributeValue.getID();
                } else {
                    recordID = masterID;
                }

            } else {
                recordID = masterID; // regular master record
            }

        } else { // simple product
            recordID = product.getID();
        }
    };

    return recordID;
}

/**
 * Resolves the objectID a product is indexed under, for the configured record model.
 *
 * Conversion events have to name the record that exists in the index, which is not always the
 * product's own ID: under the master-level model a variant is indexed as its master, and under the
 * attribute-sliced model variants are not indexed at all, their variation group is.
 *
 * @param {dw.catalog.Product | dw.catalog.Variant} product Product or Variant
 * @param {string} recordModel one of RECORD_MODEL_TYPES
 * @returns {string | null} the record ID, or null when it cannot be resolved
 */
function getRecordIDForProduct(product, recordModel) {
    const RECORD_MODEL_TYPES = require('*/cartridge/scripts/algolia/lib/algoliaConstants').RECORD_MODEL_TYPES;

    if (empty(product)) {
        return null;
    }

    switch (recordModel) {
        case RECORD_MODEL_TYPES.ATTRIBUTE_SLICED:
            return getAttributeSlicedModelRecordID(product);
        case RECORD_MODEL_TYPES.MASTER_LEVEL:
            return product.isVariant() ? product.getMasterProduct().getID() : product.getID();
        case RECORD_MODEL_TYPES.VARIANT_LEVEL:
        default:
            return product.getID();
    }
}

/**
 * Build the list of stores that have an inventory list, used to compute the `storeAvailability` attribute.
 * The lookup is intentionally broad (whole world) so that every store assigned to the site is returned.
 * This is expensive, so callers should build it once and pass it to AlgoliaLocalizedProduct via `parameters.stores`.
 * @returns {Array<{id: string, storeInventory: dw.catalog.ProductInventoryList}>} stores with their inventory list
 */
function getStoresWithInventory() {
    const StoreMgr = require('dw/catalog/StoreMgr');
    const storesMap = StoreMgr.searchStoresByCoordinates(0, 0, 'mi', 99999999);
    var result = [];

    if (storesMap && !storesMap.empty) {
        var storeObjects = storesMap.keySet().toArray();
        for (let i = 0; i < storeObjects.length; i++) {
            let store = storeObjects[i];
            if (store && store.inventoryList) {
                result.push({
                    id: store.ID,
                    storeInventory: store.inventoryList
                });
            }
        }
    }

    return result;
}

module.exports = {
    getColorVariations: getColorVariations,
    getImageGroups: getImageGroups,
    getAttributeSlicedModelRecordID: getAttributeSlicedModelRecordID,
    getRecordIDForProduct: getRecordIDForProduct,
    getStoresWithInventory: getStoresWithInventory,
};
