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

    var result = {
        _type: 'image_group',
        images: [],
        view_type: viewtype
    };

    var imagesListSize = imagesList.size();
    for (var i = 0; i < imagesListSize; ++i) {
        var image = {
            _type: 'image',
            alt: {},
            dis_base_link: {},
            title: {}
        };

        image.alt = stringUtils.trim(imagesList[i].alt);
        image.dis_base_link = stringUtils.trim(imagesList[i].absURL.toString());
        image.title = stringUtils.trim(imagesList[i].title);

        result.images.push(image);
    }

    return result;
}

/**
 * Function get value of object property by attribute name.
 * An attribute name can be complex and consist of several levels.
 * Attribute names must be separated by dots.
 * Example: primaryCategory.ID
 * @param {dw.object.ExtensibleObject} extensibleObject - business object
 * @param {string} attributeName - object attribute name
 * @returns {string|boolean|number|null} - value
 */
function getAttributeValue(extensibleObject, attributeName) {
    var properties = attributeName.split('.');
    var result = properties.reduce(function (previousValue, currentProperty) {
        return previousValue ? previousValue[currentProperty] : null;
    }, extensibleObject);

    if ((typeof result) === 'string') {
        result = empty(result) ? null : stringUtils.trim(algoliaUtils.escapeEmoji(result.toString()));
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
        name: getAttributeValue(currentCategory, 'displayName')
    });

    while (!currentCategory.topLevel && !currentCategory.root) {
        currentCategory = currentCategory.parent;
        if (!currentCategory.online) {
            break;
        }
        categoryTree.push({
            id: currentCategory.ID,
            name: getAttributeValue(currentCategory, 'displayName')
        });
    }

    return categoryTree;
}

/**
 * Create hierarchical facets from the primary category path:
 * If the primary category is "Flat Screen" and the path to the primary category is "Electronics > Televisions > Flat Screen",
 * this method returns the following object:
 * {
 *   0: "Electronics"
 *   1: "Electronics > Televisions"
 *   2: "Electronics > Televisions > Flat Screen"
 * }
 * https://www.algolia.com/doc/guides/managing-results/refine-results/faceting/#hierarchical-facets
 * @param {dw.order.Product} product - product
 * @returns {Object} - the primary category's hierarchical facets
 */
function getPrimaryCategoryHierarchicalFacets(product) {
    var categoriesHierarchy = {};
    var categoriesTree = [];
    var currentCategory = product.getPrimaryCategory();

    if (empty(currentCategory) && product.isVariant()) {
        currentCategory = product.getMasterProduct().getPrimaryCategory();
    }
    if (empty(currentCategory)) {
        return;
    }

    categoriesTree.push(currentCategory.displayName);
    while (!currentCategory.topLevel && !currentCategory.root) {
        currentCategory = currentCategory.parent;
        if (!currentCategory.online) {
            break;
        }
        categoriesTree.push(currentCategory.displayName);
    }

    categoriesTree.reverse();
    for (var i = 0; i < categoriesTree.length; ++i) {
        categoriesHierarchy[i] = categoriesTree.slice(0, i + 1).join(' > ');
    }

    return categoriesHierarchy;
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
}

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
        let inventoryRecord = product.getAvailabilityModel().getInventoryRecord(); // can be null
        return (inventoryRecord ? inventoryRecord.getATS().getValue() >= ALGOLIA_IN_STOCK_THRESHOLD : false);
    },
    image_groups: function (product) {
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
        // Get product page url for the current locale
        var productPageUrl = URLUtils.url('Product-Show', 'pid', product.ID);
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
}

/**
 * AlgoliaLocalizedProduct class that represents a localized algoliaProduct ready to be indexed
 * @param {dw.order.Product} product - Product
 * @param {string} locale - The requested locale
 * @param {Array} [fieldListOverride] (optional) if supplied, it overrides the regular list of attributes to be sent (default + customFields)
 * @param {Object} baseProduct - A base product that contains pre-fetched properties
 * @constructor
 */
function algoliaLocalizedProduct(product, locale, fieldListOverride, baseProduct) {
    request.setLocale(locale || 'default');

    // list of fields to build the object with
    let algoliaFields;
    if (!empty(fieldListOverride)) {
        // use overridden list of fields
        algoliaFields = fieldListOverride;
    } else {
        // use regular list of fields (default behavior)
        const customFields = algoliaData.getSetOfArray('CustomFields');
        algoliaFields = algoliaProductConfig.defaultAttributes.concat(customFields);
    }

    if (empty(product)) {
        this.id = null;
    } else {
        this.objectID = product.ID;
        for (var i = 0; i < algoliaFields.length; i += 1) {
            var attributeName = algoliaFields[i];
            var config = algoliaProductConfig.attributeConfig[attributeName];

            if (!empty(config)) {
                if (baseProduct && baseProduct[attributeName]) {
                    this[attributeName] = baseProduct[attributeName];
                } else {
                    this[attributeName] = aggregatedValueHandlers[attributeName]
                        ? aggregatedValueHandlers[attributeName](product)
                        : getAttributeValue(product, config.attribute);
                }
            }
        }
        if (algoliaFields.indexOf('id') >= 0) {
            this._tags = ['id:' + product.ID];
        }
        if (algoliaFields.indexOf('primary_category_id') >= 0 && algoliaFields.indexOf('categories') >= 0) {
            this['__primary_category'] = getPrimaryCategoryHierarchicalFacets(product);
        }
        productModelCustomizer.customizeLocalizedProductModel(this, algoliaFields);
    }
}

module.exports = algoliaLocalizedProduct;
