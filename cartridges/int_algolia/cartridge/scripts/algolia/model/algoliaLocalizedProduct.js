'use strict';

var Site = require('dw/system/Site');
var Currency = require('dw/util/Currency');
var PriceBookMgr = require('dw/catalog/PriceBookMgr');
var PromotionMgr = require('dw/campaign/PromotionMgr');
var URLUtils = require('dw/web/URLUtils');
var modelHelper = require('*/cartridge/scripts/algolia/helper/modelHelper');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaProductConfig = require('*/cartridge/scripts/algolia/lib/algoliaProductConfig');
var productModelCustomizer = require('*/cartridge/scripts/algolia/customization/productModelCustomizer');
var ObjectHelper = require('*/cartridge/scripts/algolia/helper/objectHelper');
var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
var logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();
var productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');

var extendedProductAttributesConfig;
try {
    extendedProductAttributesConfig = require('*/cartridge/configuration/productAttributesConfig.js');
    logger.info('Extension file "productAttributesConfig.js" loaded');
} catch (e) { // eslint-disable-line no-unused-vars
    extendedProductAttributesConfig = {};
}
var extendedProductRecordCustomizer;
try {
    extendedProductRecordCustomizer = require('*/cartridge/configuration/productRecordCustomizer.js');
    logger.info('Extension file "productRecordCustomizer.js" loaded');
} catch (e) { // eslint-disable-line no-unused-vars
}

const ALGOLIA_IN_STOCK_THRESHOLD = algoliaData.getPreference('InStockThreshold');
const INDEX_OUT_OF_STOCK = algoliaData.getPreference('IndexOutOfStock');

/**
 * Get the lowest promotional price for product
 * list all the active promotions for the product, then compares the prices and select the lowest.
 *
 * @param {dw.catalog.Product} product -product
 * @returns {dw.value.Money|null} lowest price or null if no price available
 */
function getPromotionalPrice(product) {
    var promotions = PromotionMgr.getActivePromotions().getProductPromotions(product);
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
 * Retrieves the promotional prices for a given product.
 * This function fetches that active promotions from now to one month later for the specified product, (not including rule based promotions)
 * extracts the promotional prices, and returns them as an array of objects.
 * Promotions without a price are filtered out.
 * @param {dw.catalog.Product} product - The product for which to get promotional prices.
 * @param {dw.campaign.Campaign[]} campaigns - The campaigns to consider.
 * @returns {Array<Object>} An array of promotional price objects.
 * @returns {number} return[].price - The promotional price value.
 * @returns {string} return[].promoId - The ID of the promotion.
 */
function getPromotionalPrices(product, campaigns) {
    var now = new Date();
    var oneMonthLater = new Date();
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    var promotionObjects = [];

    for (var i = 0; i < campaigns.length; i++) {
        var campaignPromos = PromotionMgr.getActivePromotionsForCampaign(campaigns[i], now, oneMonthLater).getProductPromotions(product);

        var campPromotionObj = campaignPromos
            .toArray()
            .map(function (promotion) {
                // get all promotions for this product
                let price = promotion.getPromotionalPrice(product);
                if (price === dw.value.Money.NOT_AVAILABLE) {
                    return null;
                }
                let promoId = promotion.ID;
                return {
                    price: price.getValue(),
                    promoId: promoId
                };
            })
            .filter(Boolean); // Remove null values from the array

        promotionObjects = promotionObjects.concat(campPromotionObj);
    }

    return promotionObjects;
}

/**
 * Create category tree of Product
 * @example
 *  For the `mens-clothing-shorts` category, who has the following hierarchy:
 *   |_`mens`
 *     |_`mens-clothing`
 *       |_`mens-clothing-shorts`
 *  The function returns:
 *      [
 *          { id: 'mens-clothing-shorts', 'Shorts' }
 *          { id: 'mens-clothing', name: 'Clothing' },
 *          { id: 'mens', name: 'Men' },
 *      ]
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
 * Compute the hierarchical facets for a given category.
 * Return an array containing the hierarchical facets, ordered from top to bottom.
 * Note: if one of the parent category is 'offline', an empty array is returned.
 * @example
 * For the `mens-clothing-shorts` category, who has the following hierarchy:
 *  |_`mens`
 *    |_`mens-clothing`
 *      |_`mens-clothing-shorts`
 * The function returns: ['Men', 'Men > Clothing', 'Men > Clothing > Shorts']
 * @param {dw.catalog.Category} category
 * @returns {Array}
 */
function getHierarchicalCategories(category) {
    var res = [];
    if (empty(category)) {
        return res;
    }

    // Build an array of the category hierarchy names, e.g.: ['Men', 'Clothing', 'Shorts']
    var currentCategory = category;
    var categoryHierarchyNames = [currentCategory.displayName];
    while (!currentCategory.topLevel && !currentCategory.root) {
        currentCategory = currentCategory.parent;
        if (!currentCategory.online) { // If a parent category is not online, don't index anything
            return [];
        }
        categoryHierarchyNames.unshift(currentCategory.displayName);
    }

    // Transform it into an array of hierarchical facets: ['Men', 'Men > Clothing', 'Men > Clothing > Shorts']
    for (let i = 0; i < categoryHierarchyNames.length; ++i) {
        res.push(categoryHierarchyNames.slice(0, i + 1).join(' > '));
    }
    return res;
}

/**
 * Get the category ids of each level of a category hierarchy
 * Example:
 *  For the `mens-clothing-shorts` category, who has the following hierarchy:
 *   |_`mens`
 *     |_`mens-clothing`
 *       |_`mens-clothing-shorts`
 *  The function returns: ['mens', 'mens-clothing', 'mens-clothing-shorts']
 *
 * @param {dw.catalog.Category} category
 * @return {string[]} an array containing the categoryIds of each level, ordered from the root
 */
function getCategoryHierarchyIds(category) {
    var res = [];
    if (empty(category)) {
        return res;
    }

    res.unshift(category.ID);
    var currentCategory = category;
    while (!currentCategory.topLevel && !currentCategory.root) {
        currentCategory = currentCategory.parent;
        if (!currentCategory.online) { // If a parent category is not online, we don't want to index anything
            return [];
        }
        res.unshift(currentCategory.ID);
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
    categoryPageId: function (product) {
        var res = [];
        var productCategories = product.getOnlineCategories();
        productCategories = empty(productCategories) ? [] : productCategories.toArray();

        if (product.isVariant()) {
            var masterProductCategories = product.masterProduct.getOnlineCategories();
            masterProductCategories = empty(masterProductCategories) ? [] : masterProductCategories.toArray();
            productCategories = productCategories.concat(masterProductCategories);
        }

        productCategories.forEach(function (category) {
            res = res.concat(getCategoryHierarchyIds(category));
        });
        return res;
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
    __primary_category: function (product) {
        var res = {};
        var primaryCategory = product.primaryCategory;
        if (empty(primaryCategory)) {
            primaryCategory = product.isVariant() ? product.masterProduct.primaryCategory : null;
            if (empty(primaryCategory)) {
                return null;
            }
        }
        var hierarchicalCategories = getHierarchicalCategories(primaryCategory);
        for (let i = 0; i < hierarchicalCategories.length; ++i) {
            res[i] = hierarchicalCategories[i];
        }
        return res;
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
        let inStock = productFilter.isInStock(product, ALGOLIA_IN_STOCK_THRESHOLD);

        if (!inStock && !INDEX_OUT_OF_STOCK) {
            return undefined;
        }

        return inStock;
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
    promotions: function (product) {
        // Get promotional price for all currencies
        var promotionalPrices = null;
        var currentSession = request.getSession();
        var siteCurrencies = Site.getCurrent().getAllowedCurrencies();
        var siteCurrenciesSize = siteCurrencies.size();
        var currentCurrency = currentSession.getCurrency();
        var campaigns = PromotionMgr.getCampaigns().toArray();
        for (var k = 0; k < siteCurrenciesSize; k += 1) {
            var currency = Currency.getCurrency(siteCurrencies[k]);
            currentSession.setCurrency(currency);
            var promotionObjects = getPromotionalPrices(product, campaigns);

            if (promotionObjects.length > 0) {
                if (!promotionalPrices) { promotionalPrices = {}; }
                promotionalPrices[siteCurrencies[k]] = promotionObjects;
            }
        }
        currentSession.setCurrency(currentCurrency);
        return promotionalPrices;
    },
    variants: function(product, parameters) {
        if (!product.isMaster() && !product.isVariationGroup()) {
            return null;
        }

        const variants = [];
        const variantsIt = product.variants.iterator();
        while (variantsIt.hasNext()) {
            var variant = variantsIt.next();

            let inStock = productFilter.isInStock(variant, ALGOLIA_IN_STOCK_THRESHOLD);

            if (!inStock && !INDEX_OUT_OF_STOCK) {
                continue;
            }

            var baseModel = { in_stock: inStock };

            var localizedVariant = new algoliaLocalizedProduct({
                product: variant,
                locale: request.getLocale(),
                attributeList: parameters.variantAttributes,
                isVariant: true,
                baseModel: baseModel,
            });
            variants.push(localizedVariant);
        }
        return variants;
    },
    _tags: function(product) {
        return ['id:' + product.ID];
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

            var baseAttributeValue = ObjectHelper.getAttributeValue(baseModel, attributeName);
            if (baseAttributeValue) {
                ObjectHelper.setAttributeValue(this, attributeName, baseAttributeValue);
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

                if (empty(config)) {
                    config = jobHelper.getDefaultAttributeConfig(attributeName);
                }

                ObjectHelper.setAttributeValue(
                    this,
                    attributeName,
                    ObjectHelper.getAttributeValue(product, config.attribute)
                );
            }
        }
        productModelCustomizer.customizeLocalizedProductModel(this, attributeList);
        if (extendedProductRecordCustomizer) {
            extendedProductRecordCustomizer(this);
        }
    }
}

module.exports = algoliaLocalizedProduct;
