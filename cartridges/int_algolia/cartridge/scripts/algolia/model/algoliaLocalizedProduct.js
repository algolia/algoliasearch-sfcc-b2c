'use strict';

var Site = require('dw/system/Site');
var Currency = require('dw/util/Currency');
var PriceBookMgr = require('dw/catalog/PriceBookMgr');
var URLUtils = require('dw/web/URLUtils');

var modelHelper = require('*/cartridge/scripts/algolia/helper/modelHelper');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaProductConfig = require('*/cartridge/scripts/algolia/lib/algoliaProductConfig');
var productModelCustomizer = require('*/cartridge/scripts/algolia/customization/productModelCustomizer');
var ObjectHelper = require('*/cartridge/scripts/algolia/helper/objectHelper');
var logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();

var extendedProductAttributesConfig;
try {
    extendedProductAttributesConfig = require('*/cartridge/configuration/productAttributesConfig.js');
    logger.info('Extension file "productAttributesConfig.js" loaded');
} catch(e) {
    extendedProductAttributesConfig = {};
}
var extendedProductRecordCustomizer;
try {
    extendedProductRecordCustomizer = require('*/cartridge/configuration/productRecordCustomizer.js');
    logger.info('Extension file "productRecordCustomizer.js" loaded');
} catch(e) {
}

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
        name: ObjectHelper.getAttributeValue(currentCategory, 'displayName')
    });

    while (!currentCategory.topLevel && !currentCategory.root) {
        currentCategory = currentCategory.parent;
        if (!currentCategory.online) {
            break;
        }
        categoryTree.push({
            id: currentCategory.ID,
            name: ObjectHelper.getAttributeValue(currentCategory, 'displayName')
        });
    }

    return categoryTree;
}

/**
 * Compute hierarchical facets from the 'categories' field:
 * If we have the following categories:
 * [
 *   [{ id: 'newarrivals-televisions', name: 'New TVs' } ],
 *   [
 *     { id: 'electronics-televisions-flatscreen', name: 'Flat Screen' },
 *     { id: 'electronics-televisions', name: 'Televisions' },
 *     { id: 'electronics', name: 'Electronics' }
 *   ]
 * ]
 * And the primary category is "electronics-televisions-flatscreen",
 * this method returns the following object:
 * {
 *   0: "Electronics"
 *   1: "Electronics > Televisions"
 *   2: "Electronics > Televisions > Flat Screen"
 * }
 * https://www.algolia.com/doc/guides/managing-results/refine-results/faceting/#hierarchical-facets
 * @param {Array} categories - array containing one array per assigned categories, representing the category hierarchy
 * @param {string} primaryCategoryId - the id primary category
 * @returns {Object} - the primary category's hierarchical facets
 */
function computePrimaryCategoryHierarchicalFacets(categories, primaryCategoryId) {
    var res = {};

    // Find the hierarchy that contains the primary category
    var primaryCategoryHierarchy;
    for (let i = 0; i < categories.length && !primaryCategoryHierarchy; ++i) {
        for (let j = 0; j < categories[i].length && !primaryCategoryHierarchy; ++j) {
            if (categories[i][j].id === primaryCategoryId) {
                primaryCategoryHierarchy = categories[i];
            }
        }
    }
    if (!primaryCategoryHierarchy) {
        return res;
    }

    // Reverse the hierarchy to have the top category first, and keep only the name
    var reverseHierarchyNames = [];
    for (let i = 0; i < primaryCategoryHierarchy.length; ++i) {
        reverseHierarchyNames.unshift(primaryCategoryHierarchy[i].name);
    }

    for (let i = 0; i < reverseHierarchyNames.length; ++i) {
        res[i] = reverseHierarchyNames.slice(0, i + 1).join(' > ');
    }
    return res;
}

/**
 * Handler complex and calculated Product attributes
 */
var aggregatedValueHandlers = {
    masterID: function(product) {
        return product.isVariant() || product.isVariationGroup() ?
            product.masterProduct.ID : null;
    },
    defaultVariantID: function(product) {
        const defaultVariant = product.getVariationModel().getDefaultVariant();
        return defaultVariant ? defaultVariant.ID : null;
    },
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
        return ObjectHelper.safelyGetCustomAttribute(product.custom, 'refinementColor')
            ? product.custom.refinementColor.displayValue
            : null;
    },
    colorVariations: function(product) {
        if (product.isMaster() || product.isVariationGroup()) {
            return modelHelper.getColorVariations(product);
        }
        const masterProduct = product.getVariationModel().master;
        if (!masterProduct) {
            return null;
        }
        return modelHelper.getColorVariations(masterProduct);
    },
    size: function (product) {
        var variationModel = product.getVariationModel();
        var sizeAttribute = variationModel.getProductVariationAttribute('size');
        return (sizeAttribute && variationModel.getSelectedValue(sizeAttribute))
            ? variationModel.getSelectedValue(sizeAttribute).displayValue
            : null;
    },
    refinementSize: function (product) {
        return ObjectHelper.safelyGetCustomAttribute(product.custom, 'refinementSize')
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
    pricebooks: function (product) {
        const pricebooks = {};
        const siteCurrencies = Site.getCurrent().getAllowedCurrencies();
        const sitePriceBooks = PriceBookMgr.getSitePriceBooks().iterator();

        while (sitePriceBooks.hasNext()) {
            var pricebook = sitePriceBooks.next();
            if (siteCurrencies.indexOf(pricebook.currencyCode) < 0) {
                continue;
            }
            var priceInfo = product.priceModel.getPriceBookPriceInfo(pricebook.ID);
            if (priceInfo) {
                if (!pricebooks[pricebook.currencyCode]) {
                    pricebooks[pricebook.currencyCode] = [];
                }
                pricebooks[pricebook.currencyCode].push({
                    price: priceInfo.price.value,
                    onlineFrom: priceInfo.onlineFrom ? priceInfo.onlineFrom.getTime() : undefined,
                    onlineTo: priceInfo.onlineTo ? priceInfo.onlineTo.getTime() : undefined,
                    pricebookID: pricebook.ID,
                });
            }
        }
        return pricebooks;
    },
    in_stock: function (product) {
        if (product.isMaster() || product.isVariationGroup()) {
            return undefined;
        }
        let inventoryRecord = product.getAvailabilityModel().getInventoryRecord(); // can be null
        return (inventoryRecord ? inventoryRecord.getATS().getValue() >= ALGOLIA_IN_STOCK_THRESHOLD : false);
    },
    image_groups: function (product) {
        var imageGroupsArr = [];
        var imageGroup = modelHelper.getImageGroups(product.getImages('large'), 'large');
        if (!empty(imageGroup)) {
            imageGroupsArr.push(imageGroup);
        }

        imageGroup = modelHelper.getImageGroups(product.getImages('small'), 'small');
        if (!empty(imageGroup)) {
            imageGroupsArr.push(imageGroup);
        }
        return imageGroupsArr.length > 0 ? imageGroupsArr : null;
    },
    // @FIXME: This is a temporary solution to get the first image of the first image group for looking similar model, needs to be improved in the future
    lsImage: function (product) {
        var imageGroups = product.getImages('large');
        if (empty(imageGroups)) {
            return null;
        }
        var image = imageGroups.iterator().next();
        var absURL = image.getAbsURL();
        return absURL ? absURL.toString() : null;
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
    },
    variants: function(product, parameters) {
        if (!product.isMaster() && !product.isVariationGroup()) {
            return null;
        }

        const variants = [];
        const variantsIt = product.variants.iterator();
        while (variantsIt.hasNext()) {
            var variant = variantsIt.next();
            var localizedVariant = new algoliaLocalizedProduct({
                product: variant,
                locale: request.getLocale(),
                attributeList: parameters.variantAttributes,
                isVariant: true,
            });
            variants.push(localizedVariant);
        }
        return variants;
    }
}

/**
 * AlgoliaLocalizedProduct class that represents a localized algoliaProduct ready to be indexed
 * @param {Object} parameters - model parameters
 * @param {dw.catalog.Product} parameters.product - Product
 * @param {string} parameters.locale - The requested locale
 * @param {Array} parameters.attributeList list of attributes to be fetched
 * @param {Array} parameters.variantAttributes list of variant attributes (for product-level model)
 * @param {Object?} parameters.baseModel - (optional) A base model object that contains some pre-fetched properties
 * @param {boolean?} parameters.fullRecordUpdate - (optional) Indicate if the model is meant to fully replace the existing record
 * @param {boolean?} parameters.isVariant - (optional) Indicate if the model is meant to live in a parent record
 * @constructor
 */
function algoliaLocalizedProduct(parameters) {
    const product = parameters.product;
    const attributeList = parameters.attributeList;
    const baseModel = parameters.baseModel;

    request.setLocale(parameters.locale || 'default');

    if (empty(product) || empty(attributeList)) {
        this.id = null;
    } else {
        if (parameters.isVariant) {
            this.variantID = product.ID;
        } else {
            this.objectID = product.ID;
        }

        for (var i = 0; i < attributeList.length; i += 1) {
            var attributeName = attributeList[i];

            if (baseModel && baseModel[attributeName]) {
                this[attributeName] = baseModel[attributeName];
            } else if (extendedProductAttributesConfig[attributeName]) {
                var attributeConfig = extendedProductAttributesConfig[attributeName];
                if (typeof attributeConfig.attribute === 'function') {
                    this[attributeName] = attributeConfig.attribute(product);
                } else if (attributeConfig.attribute) {
                    this[attributeName] = ObjectHelper.getAttributeValue(product, attributeConfig.attribute);
                }
            } else if (aggregatedValueHandlers[attributeName]) {
                this[attributeName] = aggregatedValueHandlers[attributeName](product, parameters);
            } else {
                var config = algoliaProductConfig.attributeConfig_v2[attributeName];
                if (!empty(config)) {
                    this[attributeName] = ObjectHelper.getAttributeValue(product, config.attribute);
                }
            }
        }
        if (parameters.fullRecordUpdate) {
            this._tags = ['id:' + product.ID];
        }
        if (this.primary_category_id && this.categories) {
            this['__primary_category'] = computePrimaryCategoryHierarchicalFacets(this.categories, this.primary_category_id);
        }
        productModelCustomizer.customizeLocalizedProductModel(this, attributeList);
        if (extendedProductRecordCustomizer) {
            extendedProductRecordCustomizer(this);
        }
    }
}

module.exports = algoliaLocalizedProduct;
