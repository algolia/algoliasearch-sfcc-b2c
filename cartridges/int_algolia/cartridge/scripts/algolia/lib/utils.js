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

module.exports = {
    getCategoryDisplayNamePath: getCategoryDisplayNamePath
};
