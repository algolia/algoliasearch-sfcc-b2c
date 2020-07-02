'use strict';

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

/**
 * Create secondary category Algolia object
 * @param {Array} category - array of catefories tree
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
    var CATEGORY_ATTRIBUTE = 'CATEGORIES_NEW_ARRIVALS';
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

module.exports = {
    customizeProductModel: customizeProductModel
};