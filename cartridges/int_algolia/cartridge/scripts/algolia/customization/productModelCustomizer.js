'use strict';

/**
 * Create secondary category Algolia object
 * @param {Array} categories - array of catefories
 * @returns {Object} - secondary category Algolia object
 */
function categoriesToIndexTree(categories) {
    var CATEGORIES_SEPARATOR = ' > ';
    var CATEGORIES_LEVEL_PREFIX = 'level_';
    var result = {};

    categories
        .concat()
        .reverse()
        .reduce(function (previousCategory, category, index) {
            result[CATEGORIES_LEVEL_PREFIX + index] = {};
            Object.keys(category.name).forEach(function (locale) {
                result[CATEGORIES_LEVEL_PREFIX + index][locale] = previousCategory
                    ? previousCategory.name[locale] + CATEGORIES_SEPARATOR + category.name[locale]
                    : category.name[locale];
            });
            return category;
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

    var result = productModel;

    if (empty(result.categories)) {
        result[CATEGORY_ATTRIBUTE] = null;
    } else {
        for (var i = 0; i < result.categories.length; i += 1) {
            var rootCategoryId = result.categories[i][result.categories[i].length - 1].id;
            if (rootCategoryId === CATEGORY_ID) {
                result[CATEGORY_ATTRIBUTE] = categoriesToIndexTree(result.categories[i]);
                break;
            }
        }
    }
}

module.exports = {
    customizeProductModel: customizeProductModel
};
