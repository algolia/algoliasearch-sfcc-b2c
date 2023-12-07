'use strict';


/**
 * Content index filter function
 * @TODO: We may extend it to include more attributes, but for now we only need a dummy function to return true.
 * @param {dw.catalog.Content} content - Content
 * @returns {boolean} - True if content should be included in the index, false if not.
 */
function isInclude(content) {
    return true;
}

module.exports.isInclude = isInclude;
