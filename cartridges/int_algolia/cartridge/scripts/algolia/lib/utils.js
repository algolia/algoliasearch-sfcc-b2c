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
 * @description Get emoji unicode
 * @param {string} emoji emoji
 * @returns {string} emoji unicode
 */
function getUnicode(emoji) {
    const comp = (emoji.length === 1)
        ? emoji.charCodeAt(0)
        : (
            ((emoji.charCodeAt(0) - 0xD800) * 0x400)
            + (emoji.charCodeAt(1) - 0xDC00) + 0x10000
        );

    return (comp < 0)
        ? emoji.charCodeAt(0).toString()
        : comp.toString(16);
}

/**
 * @description Escapes emoji
 * @param {string} str - original string
 * @returns {string} - string with emoji escaped in hexadecimal
 */
function escapeEmoji(str) {
    var emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gi;

    return str.replace(emojiRegex, function (m, emoji) {
        var unicode = getUnicode(emoji);
        return unicode ? '&#x' + unicode + ';' : '';
    });
}

module.exports = {
    getCategoryDisplayNamePath: getCategoryDisplayNamePath,
    escapeEmoji: escapeEmoji
};
