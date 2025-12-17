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

var ALGOLIA_IN_STOCK_THRESHOLD = algoliaData.getPreference('InStockThreshold');
var INDEX_OUT_OF_STOCK = algoliaData.getPreference('IndexOutOfStock');
var ATTRIBUTE_LIST = algoliaData.getSetOfArray('AdditionalAttributes');
const stores = [];

if (ATTRIBUTE_LIST.indexOf('storeAvailability') !== -1) {
    var StoreMgr = require('dw/catalog/StoreMgr');
    var storesMap = StoreMgr.searchStoresByCoordinates(0, 0, 'mi', 99999999);

    if (storesMap && !storesMap.empty) {
        var storeObjects = storesMap.keySet().toArray();
        for (var l = 0; l < storeObjects.length; l++) {
            var store = storeObjects[l];
            if (store && store.inventoryList) {
                stores.push({
                    id: store.ID,
                    storeInventory: store.inventoryList
                });
            }
        }
    }
}

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
 * Handler for complex and calculated Product attributes
 */
var aggregatedValueHandlers = {
    masterID: function(product) {
        if (product.isVariant() || product.isVariationGroup()) {
            return product.getMasterProduct().getID();
        } else if (product.isMaster()) {
            return product.getID();
        }
        return null;
    },
    defaultVariantID: function(product) {
        const defaultVariant = product.getVariationModel().getDefaultVariant();
        return defaultVariant ? defaultVariant.ID : null;
    },
    categories: function (product) {
        var productCategories = product.getOnlineCategories();
        productCategories = empty(productCategories) ? [] : productCategories.toArray();

        if (product.isVariant()) {
            var masterProductCategories = product.getMasterProduct().getOnlineCategories();
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
            var masterProductCategories = product.getMasterProduct().getOnlineCategories();
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
            var primaryCategory = product.isVariant() ? product.getMasterProduct().getPrimaryCategory() : null;
            result = empty(primaryCategory) ? null : primaryCategory.ID;
        } else {
            result = product.getPrimaryCategory().getID();
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
    color: function (product, parameters) {
        var variationModel = parameters.variationModel || product.getVariationModel();
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
    size: function (product, parameters) {
        var variationModel = parameters.variationModel || product.getVariationModel();
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
    image_groups: function (product, parameters) {
        var imageGroupsArr = [];
        var imagesLarge = parameters.variationModel ?
            parameters.variationModel.getImages('large') :
            product.getImages('large');
        var imageGroup = modelHelper.getImageGroups(imagesLarge, 'large');
        if (!empty(imageGroup)) {
            imageGroupsArr.push(imageGroup);
        }

        var imagesSmall = parameters.variationModel ?
            parameters.variationModel.getImages('small') :
            product.getImages('small');
        imageGroup = modelHelper.getImageGroups(imagesSmall, 'small');
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
    variants: function(product, parameters) { // only called when record model is either MASTER_LEVEL or VARIATION_GROUP_LEVEL
        const variants = [];

        if (product.isMaster() || product.isVariationGroup()) {
            let variantsIt;

            if (parameters.variationModel) {
                variantsIt = parameters.variationModel.getSelectedVariants().iterator();
            } else {
                variantsIt = product.variants.iterator();
            }

            while (variantsIt.hasNext()) {
                var variant = variantsIt.next();

                if (!productFilter.isInclude(variant)) {
                    continue;
                }

                let inStock = productFilter.isInStock(variant, ALGOLIA_IN_STOCK_THRESHOLD);
                if (!inStock && !INDEX_OUT_OF_STOCK) {
                    continue;
                }

                // creating baseModel so that inStock is not calculated again in algoliaLocalizedProduct
                let baseModel = { in_stock: inStock };

                let localizedVariant = new algoliaLocalizedProduct({
                    product: variant,
                    locale: request.getLocale(),
                    attributeList: parameters.variantAttributes,
                    isVariant: true,
                    baseModel: baseModel,
                });
                variants.push(localizedVariant);
            }
            return variants;

        } else { // simple product
            // create a model to serve as the `variants` array in the record
            var localizedVariant = new algoliaLocalizedProduct({
                product: product,
                locale: request.getLocale(),
                attributeList: parameters.variantAttributes,
                isVariant: true, // otherwise the variant object will have an 'objectID'
            });
            variants.push(localizedVariant);

            return variants;
        }
    },
    _tags: function(product) {
        return ['id:' + product.ID];
    },
    storeAvailability: function(product) {
        var storeArray = [];
        if (stores.length > 0) {
            for (var i = 0; i < stores.length; i++) {
                var storeEl = stores[i];
                var storeElInventory = storeEl.storeInventory;
                if (storeElInventory) {
                    var inventoryRecord = storeElInventory.getRecord(product.ID);
                    if (inventoryRecord && inventoryRecord.ATS.value && inventoryRecord.ATS.value >= ALGOLIA_IN_STOCK_THRESHOLD && inventoryRecord.ATS.value > 0) { // comparing to zero explicitly so that a threshold of 0 wouldn't return true
                        storeArray.push(storeEl.id);
                    }
                }
            }
            if (storeArray.length > 0) {
                return storeArray;
            }
        }
        return storeArray;
    }
}

/**
 * AlgoliaLocalizedProduct class that represents a localized algoliaProduct ready to be indexed
 * @param {Object} parameters - model parameters
 * @param {dw.catalog.Product} parameters.product - Product
 * @param {string} parameters.locale - The requested locale
 * @param {Array} parameters.attributeList list of attributes to be fetched
 * @param {Array?} [parameters.variantAttributes] list of variant attributes (for product-level model)
 * @param {Object?} [parameters.baseModel] - A base model object that contains some pre-fetched properties
 * @param {boolean?} [parameters.fullRecordUpdate] - Indicates if the model is meant to fully replace the existing record or just update it partially
 * @param {boolean?} [parameters.isVariant] -  Indicates if the model is meant to live in a parent record
 * @param {Object?} [parameters.variationModel] - variationModel of a master
 * @param {string?} [parameters.variationValueID] - variationValueID to append to the objectID
 * @constructor
 */
function algoliaLocalizedProduct(parameters) {
    const product = parameters.product;
    const attributeList = parameters.attributeList || [];
    const baseModel = parameters.baseModel;

    request.setLocale(parameters.locale || 'default');

    if (empty(product)) {
        this.id = null;
    } else {
        if (parameters.isVariant) {
            let isSimpleProduct = !product.isMaster() && !product.isVariant() && !product.isVariationGroup();

            // set `variantID` explicitly to null in the `variants` array object for simple products
            this.variantID = isSimpleProduct ? null : product.getID();
        } else if (parameters.variationModel) { // ATTRIBUTE_SLICED indexing, master case
            this.objectID = product.getID() + '-' + parameters.variationValueID;
        } else { // all other cases
            this.objectID = product.getID();
        }

        for (var i = 0; i < attributeList.length; i += 1) {
            var attributeName = attributeList[i];

            // if the supplied baseModel contains the attribute, use the supplied value to avoid hitting the database...
            var baseAttributeValue = ObjectHelper.getAttributeValue(baseModel, attributeName);
            if (baseAttributeValue) {
                ObjectHelper.setAttributeValue(this, attributeName, baseAttributeValue);

            // ...otherwise get the value directly from the product
            // -- try productAttributesConfig.js (optional file) first...
            } else if (extendedProductAttributesConfig[attributeName]) {
                var attributeConfig = extendedProductAttributesConfig[attributeName];
                if (typeof attributeConfig.attribute === 'function') {
                    this[attributeName] = attributeConfig.attribute(product);
                } else if (attributeConfig.attribute) {
                    this[attributeName] = ObjectHelper.getAttributeValue(product, attributeConfig.attribute);
                }

            // ...try aggregatedValueHandlers next...
            } else if (aggregatedValueHandlers[attributeName]) {
                this[attributeName] = aggregatedValueHandlers[attributeName](product, parameters);

            // if all else fails, fall back to algoliaProductConfig v2 and get the value from the product based on that
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

        // apply any customizations in productRecordCustomizer.js (optional file)
        productModelCustomizer.customizeLocalizedProductModel(this, attributeList);
        if (extendedProductRecordCustomizer) {
            extendedProductRecordCustomizer(this);
        }
    }
}

// For testing - static methods on constructor
algoliaLocalizedProduct.__setThreshold = function(threshold) {
    ALGOLIA_IN_STOCK_THRESHOLD = threshold;
};

algoliaLocalizedProduct.__setIndexOutOfStock = function(indexOutOfStock) {
    INDEX_OUT_OF_STOCK = indexOutOfStock;
};

algoliaLocalizedProduct.__setAttributeList = function(attributeList) {
    ATTRIBUTE_LIST = attributeList;
};

module.exports = algoliaLocalizedProduct;
