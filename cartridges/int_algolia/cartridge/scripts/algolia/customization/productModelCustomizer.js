'use strict';

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

/**
 * Create secondary category Algolia object from a flat category tree:
 * For example, the following categories flat tree:
 *   [
 *     { id: 'newarrivals-electronics', name: { en: 'Electronics', fr: 'Electronique' } },
 *     { id: 'newarrivals', name: { en: 'New Arrivals', fr: 'Nouveautés' } },
 *   ]
 * Will generate:
 *   {
 *      level_0: { en: 'New Arrivals', fr: 'Nouveautés' },
 *      level_1: { en: 'New Arrivals > Electronics', fr: 'Nouveautés > Electronique' }
 *   }
 * @param {Array} category - array of categories tree
 * @returns {Object} - secondary category Algolia object
 */
function createAlgoliaCategoryObject(category) {
    var CATEGORIES_LEVEL_PREFIX = 'level_';
    var result = {};

    category
        .concat()
        .reverse()
        .reduce(function (parentCategory, childCategory, index) {
            result[CATEGORIES_LEVEL_PREFIX + index] = {};
            Object.keys(childCategory.name).forEach(function (locale) {
                result[CATEGORIES_LEVEL_PREFIX + index][locale] = parentCategory
                    ? parentCategory.name[locale] + algoliaData.CATEGORIES_SEPARATOR + childCategory.name[locale]
                    : childCategory.name[locale];
            });
            return childCategory;
        }, null);

    return result;
}

/**
 * Customize Algolia Product.
 * Add any property to product model
 * @param {Object} productModel - Algolia product model
 */
function customizeProductModel(productModel) {
    /*
    * Add New arrivals
    */
    var CATEGORY_ATTRIBUTE = 'newArrivals';
    var CATEGORY_ID = 'newarrivals';

    var customizedProductModel = productModel;
    customizedProductModel[CATEGORY_ATTRIBUTE] = null;

    if (!empty(customizedProductModel.categories)) {
        for (var i = 0; i < customizedProductModel.categories.length; i += 1) {
            var rootCategoryId = customizedProductModel.categories[i][customizedProductModel.categories[i].length - 1].id;
            if (rootCategoryId === CATEGORY_ID) {
                customizedProductModel[CATEGORY_ATTRIBUTE] = createAlgoliaCategoryObject(customizedProductModel.categories[i]);
                break;
            }
        }
    }
}

/**
 * Create a hierarchical category Algolia object from a categories flat tree, for a localized model.
 * For example, the following categories flat tree:
 *   [
 *     { id: 'newarrivals-electronics', name: 'Electronics' },
 *     { id: 'newarrivals', name: 'New Arrivals' }
 *   ]
 * Will generate:
 *   {
 *      level_0: 'New Arrivals',
 *      level_1: 'New Arrivals > Electronics'
 *   }
 * @param {Array} category - array of categories tree
 * @returns {Object} - secondary category Algolia object
 */
function createAlgoliaLocalizedCategoryObject(category) {
    var CATEGORIES_LEVEL_PREFIX = 'level_';
    var result = {};

    category
        .concat()
        .reverse()
        .reduce(function (parentCategory, childCategory, index) {
            result[CATEGORIES_LEVEL_PREFIX + index] = parentCategory
                ? parentCategory.name + algoliaData.CATEGORIES_SEPARATOR + childCategory.name
                : childCategory.name
            return childCategory;
        }, null);

    return result;
}

/**
 * Customize a Localized Algolia Product.
 * Add extra properties to the product model.
 * @param {Object} productModel - Algolia product model
 * @param {Array} algoliaAttributes - The attributes to index
 */
function customizeLocalizedProductModel(productModel, algoliaAttributes) {
    var CATEGORY_ATTRIBUTE = 'newArrivals';
    var CATEGORY_ID = 'newarrivals';

    if (algoliaAttributes.indexOf(CATEGORY_ATTRIBUTE) >= 0) {
        productModel[CATEGORY_ATTRIBUTE] = null;

        if (!empty(productModel.categories)) {
            for (var i = 0; i < productModel.categories.length; i += 1) {
                var rootCategoryId = productModel.categories[i][productModel.categories[i].length - 1].id;
                if (rootCategoryId === CATEGORY_ID) {
                    productModel[CATEGORY_ATTRIBUTE] = createAlgoliaLocalizedCategoryObject(productModel.categories[i]);
                    break;
                }
            }
        }
    }
}

module.exports = {
    customizeProductModel: customizeProductModel,
    customizeLocalizedProductModel: customizeLocalizedProductModel
};
