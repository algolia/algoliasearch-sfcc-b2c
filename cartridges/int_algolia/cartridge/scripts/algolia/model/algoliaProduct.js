'use strict';

var Site = require('dw/system/Site');
var Currency = require('dw/util/Currency');
var stringUtils = require('dw/util/StringUtils');
var URLUtils = require('dw/web/URLUtils');

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaProductConfig = require('*/cartridge/scripts/algolia/model/algoliaProductConfig');

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
    var currentSites = Site.getCurrent();

    if (empty(product) || empty(viewtype)) { return null; }

    var imagesList = product.getImages(viewtype);
    if (empty(imagesList)) { return null; }

    var result = {
        _type: 'image_group',
        images: [],
        view_type: viewtype
    };

    var imagesListSize = imagesList.size();
    for (var i = 0; i < imagesListSize; i += 1) {
        var imageItem = imagesList[i];
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
            image.alt[localeName] = stringUtils.trim(imageItem.alt);
            image.dis_base_link[localeName] = stringUtils.trim(imageItem.absURL.toString());
            image.title[localeName] = stringUtils.trim(imageItem.title);
        }

        result.images.push(image);
    }

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
        result = empty(result) ? null : stringUtils.trim(result.toString());
    }
    return result;
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
        name: currentCategory.displayName
    });

    while (!currentCategory.topLevel && !currentCategory.root) {
        currentCategory = currentCategory.parent;
        categoryTree.push({
            id: currentCategory.ID,
            name: currentCategory.displayName
        });
    }

    return categoryTree;
}

/**
 * Handler complex and calculated Product attributes
 */
var agregatedValueHanlders = {
    categories: function categories(product) {
        var productCategories = product.isVariant()
            ? product.masterProduct.getOnlineCategories()
            : product.getOnlineCategories();

        return productCategories
            .toArray()
            .map(function (category) {
                return getCategoryFlatTree(category);
            });
    },
    color: function (product) {
        var variationModel = product.getVariationModel();
        var colorAttribute = variationModel.getProductVariationAttribute('color');
        return (colorAttribute && variationModel.getSelectedValue(colorAttribute))
            ? variationModel.getSelectedValue(colorAttribute).displayValue
            : null;
    },
    size: function (product) {
        var variationModel = product.getVariationModel();
        var sizeAttribute = variationModel.getProductVariationAttribute('size');
        return (sizeAttribute && variationModel.getSelectedValue(sizeAttribute))
            ? variationModel.getSelectedValue(sizeAttribute).displayValue
            : null;
    },
    price: function (product) {
        // Get price for all currencies
        var productPrice = null;
        var currentSession = request.getSession();
        var siteCurrencies = Site.getCurrent().getAllowedCurrencies();
        var siteCurrenciesSize = siteCurrencies.size();

        for (var k = 0; k < siteCurrenciesSize; k += 1) {
            var currency = Currency.getCurrency(siteCurrencies[k]);
            currentSession.setCurrency(currency);
            var price = product.priceModel.price;
            if (price.available) {
                if (!productPrice) { productPrice = {}; }
                productPrice[price.currencyCode] = price.value;
            }
        }
        return productPrice;
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

        for (var k = 0; k < siteCurrenciesSize; k += 1) {
            var currency = Currency.getCurrency(siteCurrencies[k]);
            currentSession.setCurrency(currency);
            var price = getPromotionalPrice(product);
            if (price) {
                if (!promotionalPrice) { promotionalPrice = {}; }
                promotionalPrice[price.currencyCode] = price.value;
            }
        }
        return promotionalPrice;
    }
};

/**
 * AlgoliaProduct class that represents an algoliaProduct Object
 * @param {dw.order.Product} product - Product
 * @constructor
 */
function algoliaProduct(product) {
    //var customFields = algoliaData.getSetOfArray('CustomFields');
    //var customFields = ['color', 'size'];
    
    var customFields = ['brand', 'EAN', 'image_groups', 'long_description', 'manufacturerName', 'manufacturerSKU',
        'master', 'name', 'online', 'optionProduct', 'pageDescription', 'pageKeywords', 'pageTitle', 'productSet',
        'productSetProduct', 'searchable', 'short_description', 'url', 'unit', 'UPC', 'variant', 'promotionalPrice', 'color', 'size'];
    
    var algoliaFields = algoliaProductConfig.defaultAttributes.concat(customFields);
    //algoliaFields = ['id', 'categories'];

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

                    value = {};
                    for (var l = 0; l < siteLocalesSize; l += 1) {
                        var localeName = siteLocales[l];
                        request.setLocale(localeName);
                        value[localeName] = agregatedValueHanlders[attributeName]
                            ? agregatedValueHanlders[attributeName](product)
                            : getAttributeValue(product, config.attribute);
                    }
                } else {
                    value = agregatedValueHanlders[attributeName]
                        ? agregatedValueHanlders[attributeName](product)
                        : getAttributeValue(product, config.attribute);
                }

                if (value) { this[attributeName] = value; }
            }
        }
    }
}

module.exports = algoliaProduct;
