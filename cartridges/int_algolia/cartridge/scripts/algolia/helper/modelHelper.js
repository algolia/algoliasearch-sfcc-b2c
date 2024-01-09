const URLUtils = require('dw/web/URLUtils');

const AlgoliaLocalizedProduct = require('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
const productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');

const COLOR_ATTRIBUTE_ID = 'color';

/**
 * For a given master, generate all variant records with their 'color_variations'
 *
 * @param {Object} parameters - model parameters
 * @param {dw.order.Product} parameters.masterProduct - A master product
 * @param {string} parameters.locales - The requested locales
 * @param {Array} parameters.attributeList - list of attributes to be fetched
 * @param {Array} parameters.nonLocalizedAttributeList - list of non-localized attributes
 * @param {Array} parameters.fullRecordUpdate - specify if the generated records are mean to replace entirely the existing ones
 * @returns {Object} An object containing, for each locale, an array of AlgoliaLocalizedProduct
 */
function generateVariantRecordsWithColorVariations(parameters) {
    const algoliaRecordsPerLocale = {};
    const variants = parameters.masterProduct.getVariants();

    // Fetch all color variation images for each locale, to set them in each variant
    var colorVariationsPerLocale = {};
    for (let l = 0; l < parameters.locales.size(); ++l) {
        var locale = parameters.locales[l];
        colorVariationsPerLocale[locale] = getColorVariations(parameters.masterProduct, locale);
        algoliaRecordsPerLocale[locale] = [];
    }
    for (let v = 0; v < variants.size(); ++v) {
        var variant = variants[v];
        if (!productFilter.isInclude(variant)) {
            continue;
        }
        var baseModel = new AlgoliaLocalizedProduct({
            product: variant,
            locale: 'default',
            attributeList: parameters.nonLocalizedAttributeList,
            fullRecordUpdate: parameters.fullRecordUpdate
        });
        for (let l = 0; l < parameters.locales.size(); ++l) {
            var locale = parameters.locales[l];
            let localizedVariant = new AlgoliaLocalizedProduct({
                product: variant,
                locale: locale,
                attributeList: parameters.attributeList,
                baseModel: baseModel,
                fullRecordUpdate: parameters.fullRecordUpdate,
            });
            localizedVariant.color_variations = colorVariationsPerLocale[locale];
            algoliaRecordsPerLocale[locale].push(localizedVariant);
        }
    }
    return algoliaRecordsPerLocale;
}

/**
 * Return color_variations for a product, based on its variation model
 * @param {dw.catalog.Product} product Product
 * @param {string} locale The desired locale
 * @return {[{title, alt, url, variationUrl}]} An array of swatches
 */
function getColorVariations(product, locale) {
    request.setLocale(locale);

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
            continue;
        }
        var image_groups = getColorVariationImagesGroup(variationModel, colorValue);

        if (image_groups) {
            colorVariations.push({
                image_groups: image_groups,
                variant_url: URLUtils.url(
                    'Product-Show',
                    'pid',
                    product.ID,
                    variationModel.getHtmlName(colorVariationAttribute), // returns 'dwvar_' + product.ID + '_color',
                    colorValue.value
                ).toString(),
            });
        }
    }
    return colorVariations;
}

/**
 * Return the image_groups of a given color for a VariationModel
 *
 * @param {dw.catalog.ProductVariationModel} variationModel a variation model
 * @param {dw.catalog.ProductVariationAttributeValue} colorAttributeValue a 'color' variation value
 * @return {*[]|null} An image_group object for the giver color value
 */
function getColorVariationImagesGroup(variationModel, colorAttributeValue) {
    var imageGroupsArr = [];

    variationModel.setSelectedAttributeValue('color', colorAttributeValue.ID);
    var imagesList = variationModel.getImages('large');

    var imageGroup = getImageGroup(imagesList, 'large');
    if (!empty(imageGroup)) {
        imageGroupsArr.push(imageGroup);
    }

    imagesList = variationModel.getImages('small');
    imageGroup = getImageGroup(imagesList, 'small');
    if (!empty(imageGroup)) {
        imageGroupsArr.push(imageGroup);
    }

    imagesList = variationModel.getImages('swatch');
    imageGroup = getImageGroup(imagesList, 'swatch');
    if (!empty(imageGroup)) {
        imageGroupsArr.push(imageGroup);
    }
    return imageGroupsArr.length > 0 ? imageGroupsArr : null;
}

/**
 * Function get Algolia Image Group of Images attributes of Product
 * @param {dw.util.List} imagesList - a list of dw.content.MediaFile
 * @param {string} viewtype - the current viewtype
 * @returns  {Object} - Algolia Image Group Object
 */
function getImageGroup(imagesList, viewtype) {
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

        image.alt = imagesList[i].alt;
        image.dis_base_link = imagesList[i].absURL.toString();
        image.title = imagesList[i].title;

        result.images.push(image);
    }

    return result;
}

module.exports = {
    getColorVariations: getColorVariations,
    generateVariantRecordsWithColorVariations: generateVariantRecordsWithColorVariations,
};
