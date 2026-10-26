'use strict';

/**
 * @description Get category display name path
 * @param {dw.catalog.Category} category - category
 * @returns {Array} - array of category display name path
 */
function getCategoryDisplayNamePath(category) {
    if (category.ID === 'root') return [];

    var output = [category.displayName];
    if (category.parent) {
        output = getCategoryDisplayNamePath(category.parent).concat(output);
    }
    return output;
}

/**
 * forEach method for dw.util.Collection subclass instances
 * @param {dw.util.Collection} collection - Collection subclass instance to map over
 * @param {Function} callback - Callback function for each item
 * @param {Object} [scope] - Optional execution scope to pass to callback
 * @returns {void}
 */
function forEach(collection, callback, scope) {
    var iterator = collection.iterator();
    var index = 0;
    var item;
    while (iterator.hasNext()) {
        item = iterator.next();
        if (scope) {
            callback.call(scope, item, index, collection);
        } else {
            callback(item, index, collection);
        }
        ++index;
    }
}

module.exports = {
    getCategoryDisplayNamePath: getCategoryDisplayNamePath,
    forEach: forEach
};
