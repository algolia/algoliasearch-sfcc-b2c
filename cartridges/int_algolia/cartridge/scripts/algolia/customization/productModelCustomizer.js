'use strict';

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

/**
 * Create a hierarchical category Algolia object from a categories flat tree, for a localized model.
 * For example, the following categories flat tree:
 *   [
 *     { id: 'newarrivals-electronics', name: 'Electronics' },
 *     { id: 'newarrivals', name: 'New Arrivals' }
 *   ]
 * Will generate:
 *   {
 *      0: 'New Arrivals',
 *      1: 'New Arrivals > Electronics'
 *   }
 * @param {Array} category - array of categories tree
 * @returns {Object} - secondary category Algolia object
 */
function createAlgoliaLocalizedCategoryObject(category) {
    var result = {};

    category
        .concat()
        .reverse()
        .reduce(function (parentCategory, childCategory, index) {
            result[index] = parentCategory
                ? parentCategory.name + algoliaData.CATEGORIES_SEPARATOR + childCategory.name
                : childCategory.name
            return childCategory;
        }, null);

    return result;
}

var NEW_ARRIVALS_CATEGORY_ID = 'newarrivals';
var specialValueHandlers = {
    newArrivalsCategory: function(productModel) {
        if (!empty(productModel.categories)) {
            for (var i = 0; i < productModel.categories.length; i += 1) {
                var topLevelCategoryId = productModel.categories[i][productModel.categories[i].length - 1].id;
                if (topLevelCategoryId === NEW_ARRIVALS_CATEGORY_ID) {
                    return createAlgoliaLocalizedCategoryObject(productModel.categories[i]);
                }
            }
        }
        return null;
    },
    newArrival: function(productModel) {
        if (!empty(productModel.categories)) {
            for (var i = 0; i < productModel.categories.length; i += 1) {
                var topLevelCategoryId = productModel.categories[i][productModel.categories[i].length - 1].id;
                if (topLevelCategoryId === NEW_ARRIVALS_CATEGORY_ID) {
                    return true;
                }
            }
        }
        return false;
    }
}

/**
 * Customize a Localized Algolia Product.
 * Add extra properties to the product model.
 * @param {Object} productModel - Algolia product model
 * @param {Array} algoliaAttributes - The attributes to index
 */
function customizeLocalizedProductModel(productModel, algoliaAttributes) {
    var specialAttributes = ['newArrival', 'newArrivalsCategory'];
    specialAttributes.forEach(function(attributeName) {
        if (algoliaAttributes.indexOf(attributeName) >= 0 && specialValueHandlers[attributeName]) {
            productModel[attributeName] = specialValueHandlers[attributeName](productModel);
        }
    })
}

module.exports = {
    customizeLocalizedProductModel: customizeLocalizedProductModel
};
