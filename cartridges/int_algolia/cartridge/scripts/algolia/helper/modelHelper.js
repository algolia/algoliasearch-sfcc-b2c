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
                'Product ' + product.ID + ' has no orderable variant for color ' + colorValue.value
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
                    product.ID,
                    variationModel.getHtmlName(colorVariationAttribute), // returns 'dwvar_' + product.ID + '_color',
                    colorValue.value
                ).toString(),
                color: colorValue.displayValue,
            };

            if (IS_PWA) {
                variationObject.colorCode = colorValue.value; // Required to create product detail page URL in PWA
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

    variationModel.setSelectedAttributeValue('color', colorAttributeValue.ID);

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

        image.alt = imagesList[i].alt;
        image.dis_base_link = imagesList[i].absURL.toString();
        image.title = imagesList[i].title;

        result.images.push(image);
    }

    return result;
}

module.exports = {
    getColorVariations: getColorVariations,
    getImageGroups: getImageGroups,
};
