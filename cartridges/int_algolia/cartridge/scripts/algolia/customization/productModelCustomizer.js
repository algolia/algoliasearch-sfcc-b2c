'use strict';

/**
 * Create secondary category Algolia object
 * @param {Array} categories - array of catefories
 * @returns {Object} - secondary category Algolia object
 */
function categoriesToIndex(categories) {
    var CATEGORIES_SEPARATOR = ' > ';
    var result = {};
    for (var i = 0; i < categories.length; i += 1) {
        result['level_' + i] = {};
        var categoryNames = categories[categories.length - i - 1].name;
        // eslint-disable-next-line no-loop-func
        Object.keys(categoryNames).forEach(function (locale) {
            result['level_' + i][locale] = i
                ? result['level_' + (i - 1)][locale] + CATEGORIES_SEPARATOR + categoryNames[locale]
                : categoryNames[locale];
        });
    }
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
        result.categories.forEach(function (categoryTree) {
            var rootCategoryId = categoryTree[categoryTree.length - 1].id;
            if (rootCategoryId !== result.primary_category_id
                && rootCategoryId === CATEGORY_ID) {
                result[CATEGORY_ATTRIBUTE] = categoriesToIndex(categoryTree);
            }
        });
        /*
        for (var i = 0; i < result.categories.length; i += 1) {
            var rootCategoryId = result.categories[i][result.categories[i].length - 1].id;
            if (rootCategoryId !== result.primary_category_id
                && rootCategoryId === CATEGORY_ID) {
                result[CATEGORY_ATTRIBUTE] = categoriesToIndex(result.categories[i]);
            }
        }
        */
    }
}

module.exports = {
    customizeProductModel: customizeProductModel
};
