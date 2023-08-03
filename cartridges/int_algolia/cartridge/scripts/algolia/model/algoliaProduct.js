'use strict';

var Site = require('dw/system/Site');
var Currency = require('dw/util/Currency');
var stringUtils = require('dw/util/StringUtils');
var URLUtils = require('dw/web/URLUtils');

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaUtils = require('*/cartridge/scripts/algolia/lib/utils');
var algoliaProductConfig = require('*/cartridge/scripts/algolia/lib/algoliaProductConfig');
var productModelCustomizer = require('*/cartridge/scripts/algolia/customization/productModelCustomizer');

const ALGOLIA_IN_STOCK_THRESHOLD = algoliaData.getPreference('InStockThreshold');

/**
 * Get the lowest promotional price for product
 * list all the active promotions for the product, then compares the prices and select the lowest.
 *
 * @param {dw.catalog.Product} product -product
 * @returns {dw.value.Money|null} lowest price or null if no price available
 */
function getPromotionalPrice(product) {
    var promotions = dw.campaign.PromotionMgr.getActivePromotions().getProductPromotions(product);
    var lowestPromoPrice = null;
    var promoPrices = promotions
        .toArray()
        .map(function (promotion) {
            // get all promotions for this product
            return promotion.getPromotionalPrice(product);
        })
        .filter(function (price) {
            // skip promotions without price
            return price !== dw.value.Money.NOT_AVAILABLE;
        });
    // find the lowest price
    if (promoPrices.length > 0) {
        lowestPromoPrice = promoPrices.reduce(function (a, b) {
            return Math.min(a.value, b.value);
        });
    }
    return lowestPromoPrice;
}

/**
 * Function get Algolia Image Group of Images attributes of Product
 * @param {dw.order.Product} product - product
 * @param {string} viewtype - image type ('large' or 'small')
 * @returns  {Object} - Algolia Image Group Object
 */
function getImagesGroup(product, viewtype) {
    if (empty(product) || empty(viewtype)) { return null; }

    var imagesList = product.getImages(viewtype);
    if (empty(imagesList)) { return null; }

    var currentSites = Site.getCurrent();
    var currentLocale = request.getLocale();
    var result = {
        _type: 'image_group',
        images: [],
        view_type: viewtype
    };

    var imagesListSize = imagesList.size();
    for (var i = 0; i < imagesListSize; i += 1) {
        var image = {
            _type: 'image',
            alt: {},
            dis_base_link: {},
            title: {}
        };

        var siteLocales = currentSites.getAllowedLocales();
        var siteLocalesSize = siteLocales.size();

        for (var loc = 0; loc < siteLocalesSize; loc += 1) {
            var localeName = siteLocales[loc];
            request.setLocale(localeName);
            var imageItems = product.getImages(viewtype);
            image.alt[localeName] = stringUtils.trim(imageItems[i].alt);
            image.dis_base_link[localeName] = stringUtils.trim(imageItems[i].absURL.toString());
            image.title[localeName] = stringUtils.trim(imageItems[i].title);
        }

        result.images.push(image);
    }
    request.setLocale(currentLocale);

    return result;
}

/**
 * Function get value of product property by attribute name.
 * An attribute name can be complex and consist of several levels.
 * Attribute names must be separated by dots.
 * Examle: primaryCategory.ID
 * @param {dw.catalog.Product} product - product
 * @param {string} productAttributeName - product attribute name
 * @returns {string|boolean|number|null} - value
 */
function getAttributeValue(product, productAttributeName) {
    var properties = productAttributeName.split('.');
    var result = properties.reduce(function (previousValue, currentProperty) {
        return previousValue ? previousValue[currentProperty] : null;
    }, product);

    if ((typeof result) === 'string') {
        result = empty(result) ? null : stringUtils.trim(algoliaUtils.escapeEmoji(result.toString()));
    }
    return result;
}

/**
 * Function get localazed value of product property by attribute name.
 * An attribute name can be complex and consist of several levels.
 * Attribute names must be separated by dots.
 * Examle: primaryCategory.ID
 * @param {dw.catalog.Product} product - product
 * @param {string} productAttributeName - product attribute name
 * @returns {Object} - value
 */
function getAttributeLocalizedValues(product, productAttributeName) {
    var currentSites = Site.getCurrent();
    var siteLocales = currentSites.getAllowedLocales();
    var siteLocalesSize = siteLocales.size();
    var currentLocale = request.getLocale();

    var value = {};
    for (var l = 0; l < siteLocalesSize; l += 1) {
        var localeName = siteLocales[l];
        request.setLocale(localeName);
        value[localeName] = getAttributeValue(product, productAttributeName);
    }
    request.setLocale(currentLocale);
    return value;
}

/**
 * Create category tree of Product
 * @param {dw.catalog.Category} category - category
 * @returns {Object} - category tree
 */
function getCategoryFlatTree(category) {
    if (empty(category)) return [];

    var categoryTree = [];
    var currentCategory = category;
    categoryTree.push({
        id: currentCategory.ID,
        name: getAttributeLocalizedValues(currentCategory, 'displayName')
    });

    while (!currentCategory.topLevel && !currentCategory.root) {
        currentCategory = currentCategory.parent;
        if (!currentCategory.online) {
            break;
        }
        categoryTree.push({
            id: currentCategory.ID,
            name: getAttributeLocalizedValues(currentCategory, 'displayName')
        });
    }

    return categoryTree;
}

/**
 * Safely gets a custom attribute from a System Object.
 * Since attempting to return a nonexistent custom attribute throws an error in SFCC,
 * this is the safest way to check whether an attribute exists.
 * @param {dw.object.CustomAttributes} customAttributes The CustomAttributes object, e.g. product.getCustom()
 * @param {string} caKey The custom attribute's key whose value we want to return
 * @returns {*} The custom attribute value if exists,
 *              null if the custom attribute is defined but it has no value for this specific SO,
 *              undefined if the custom attribute is not defined at all in BM
 */
function safelyGetCustomAttribute(customAttributes, caKey) {
    let customAttributeValue;
    try {
        customAttributeValue = customAttributes[caKey];
    } catch(e) {
        customAttributeValue = undefined;
    } finally {
        return customAttributeValue;
    }
};

/**
 * Handler complex and calculated Product attributes
 */
var aggregatedValueHandlers = {
    categories: function (product) {
        var productCategories = product.getOnlineCategories();
        productCategories = empty(productCategories) ? [] : productCategories.toArray();

        if (product.isVariant()) {
            var masterProductCategories = product.masterProduct.getOnlineCategories();
            masterProductCategories = empty(masterProductCategories) ? [] : masterProductCategories.toArray();
            productCategories = productCategories.concat(masterProductCategories);
        }

        return productCategories
            .map(function (category) {
                return getCategoryFlatTree(category);
            });
    },
    primary_category_id: function (product) {
        var result = null;
        if (empty(product.primaryCategory)) {
            var primaryCategory = product.isVariant() ? product.masterProduct.primaryCategory : null;
            result = empty(primaryCategory) ? null : primaryCategory.ID;
        } else {
            result = product.primaryCategory.ID;
        }
        return result;
    },
    color: function (product) {
        var variationModel = product.getVariationModel();
        var colorAttribute = variationModel.getProductVariationAttribute('color');
        return (colorAttribute && variationModel.getSelectedValue(colorAttribute))
            ? variationModel.getSelectedValue(colorAttribute).displayValue
            : null;
    },
    refinementColor: function (product) {
        return safelyGetCustomAttribute(product.custom, 'refinementColor')
            ? product.custom.refinementColor.displayValue
            : null;
    },
    size: function (product) {
        var variationModel = product.getVariationModel();
        var sizeAttribute = variationModel.getProductVariationAttribute('size');
        return (sizeAttribute && variationModel.getSelectedValue(sizeAttribute))
            ? variationModel.getSelectedValue(sizeAttribute).displayValue
            : null;
    },
    refinementSize: function (product) {
        return safelyGetCustomAttribute(product.custom, 'refinementSize')
            ? product.custom.refinementSize
            : null;
    },
    price: function (product) {
        // Get price for all currencies
        var productPrice = null;
        var currentSession = request.getSession();
        var siteCurrencies = Site.getCurrent().getAllowedCurrencies();
        var siteCurrenciesSize = siteCurrencies.size();
        var currentCurrency = currentSession.getCurrency();

        for (var k = 0; k < siteCurrenciesSize; k += 1) {
            var currency = Currency.getCurrency(siteCurrencies[k]);
            currentSession.setCurrency(currency);
            var price = product.productSet ? product.priceModel.minPrice : product.priceModel.price;
            if (price.available) {
                if (!productPrice) { productPrice = {}; }
                productPrice[price.currencyCode] = price.value;
            }
        }
        currentSession.setCurrency(currentCurrency);
        return productPrice;
    },
    in_stock: function (product) {
        // the in_stock property now exports a boolean indicating whether the number of products in stock
        // (ATS or available to sell) is higher than the threshold set in the custom site preference Algolia_InStockThreshold,
        // as originally intended. The previous logic was flawed in that it compared the sitepref to product.availabilityModel.availability,
        // which is a number between 0 and 1 and does not represent the number of products in stock.
        let inventoryRecord = product.getAvailabilityModel().getInventoryRecord(); // can be null
        return (inventoryRecord ? inventoryRecord.getATS().getValue() > ALGOLIA_IN_STOCK_THRESHOLD : false);
    },
    image_groups: function (product) {
        // Get all image Groups of product for all locales
        var imageGroupsArr = [];
        var imageGroup = getImagesGroup(product, 'large');
        if (!empty(imageGroup)) {
            imageGroupsArr.push(imageGroup);
        }

        imageGroup = getImagesGroup(product, 'small');
        if (!empty(imageGroup)) {
            imageGroupsArr.push(imageGroup);
        }
        return imageGroupsArr.length > 0 ? imageGroupsArr : null;
    },
    url: function (product) {
        // Get product page urlfor current locale
        var productPageUrl = URLUtils.https('Product-Show', 'pid', product.ID);
        return productPageUrl ? productPageUrl.toString() : null;
    },
    promotionalPrice: function (product) {
        // Get promotional price for all currencies
        var promotionalPrice = null;
        var currentSession = request.getSession();
        var siteCurrencies = Site.getCurrent().getAllowedCurrencies();
        var siteCurrenciesSize = siteCurrencies.size();
        var currentCurrency = currentSession.getCurrency();

        for (var k = 0; k < siteCurrenciesSize; k += 1) {
            var currency = Currency.getCurrency(siteCurrencies[k]);
            currentSession.setCurrency(currency);
            var price = getPromotionalPrice(product);
            if (price) {
                if (!promotionalPrice) { promotionalPrice = {}; }
                promotionalPrice[price.currencyCode] = price.value;
            }
        }
        currentSession.setCurrency(currentCurrency);
        return promotionalPrice;
    }
};

/**
 * AlgoliaProduct class that represents an algoliaProduct Object
 * @param {dw.order.Product} product Product
 * @param {Array} [fieldListOverride] (optional) if supplied, it overrides the regular list of attributes to be sent (default + customFields)
 * @constructor
 */
function algoliaProduct(product, fieldListOverride) {

    // list of fields to build the object with
    var algoliaFields;

    if (!empty(fieldListOverride)) {
        // use overridden list of fields
        algoliaFields = fieldListOverride;
    } else {
        // use regular list of fields (default behavior)
        let customFields = algoliaData.getSetOfArray('CustomFields');
        algoliaFields = algoliaProductConfig.defaultAttributes.concat(customFields);
    }

    if (empty(product)) {
        this.id = null;
    } else {
        for (var i = 0; i < algoliaFields.length; i += 1) {
            var attributeName = algoliaFields[i];
            var config = algoliaProductConfig.attributeConfig[attributeName];

            if (!empty(config)) {
                var value = null;
                if (config.localized) {
                    var currentSites = Site.getCurrent();
                    var siteLocales = currentSites.getAllowedLocales();
                    var siteLocalesSize = siteLocales.size();
                    var currentLocale = request.getLocale();

                    value = {};
                    for (var l = 0; l < siteLocalesSize; l += 1) {
                        var localeName = siteLocales[l];
                        request.setLocale(localeName);
                        value[localeName] = aggregatedValueHandlers[attributeName]
                            ? aggregatedValueHandlers[attributeName](product)
                            : getAttributeValue(product, config.attribute);
                    }
                    request.setLocale(currentLocale);
                } else {
                    value = aggregatedValueHandlers[attributeName]
                        ? aggregatedValueHandlers[attributeName](product)
                        : getAttributeValue(product, config.attribute);
                }

                if (!empty(value)) { this[attributeName] = value; }
            }
        }
        productModelCustomizer.customizeProductModel(this);
    }
}

module.exports = algoliaProduct;
