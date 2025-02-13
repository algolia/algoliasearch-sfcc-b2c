'use strict';

var StringUtils = require('dw/util/StringUtils');
var AlgoliaUtils = require('*/cartridge/scripts/algolia/lib/utils');

/**
 * Function get value of object property by attribute name.
 * An attribute name can be complex and consist of several levels.
 * Attribute names must be separated by dots.
 * Example: primaryCategory.ID
 * @param {dw.object.ExtensibleObject} extensibleObject - business object
 * @param {string} attributeName - object attribute name
 * @param {boolean} escapeEmoji - for jobs v1 only: manually escape some emojis chars which can break XML
 * @returns {string|boolean|number|null} - value
 */
function getAttributeValue(extensibleObject, attributeName, escapeEmoji) {
    if (!extensibleObject) {
        return null;
    }
    var properties = attributeName.split('.');
    var result = properties.reduce(function (previousValue, currentProperty) {
        if (previousValue === null || !(currentProperty in previousValue)) {
            return null;
        }

        var tempResult = previousValue[currentProperty];

        if (escapeEmoji && typeof tempResult === 'string' && !empty(tempResult)) {
            tempResult = StringUtils.trim(AlgoliaUtils.escapeEmoji(tempResult));
        }

        return tempResult;
    }, extensibleObject);

    return result;
}

/**
 * Set a value to an object attribute.
 * If the attributeName is a path, the function builds the intermediate objects.
 * @param {Object} obj - JavaScript object
 * @param {string} attributeName - object attribute name or path
 * @param {any} attributeValue - value to set
 */
function setAttributeValue(obj, attributeName, attributeValue) {
    const attributeNameArr = attributeName.split('.');
    attributeNameArr.reduce(function (res, currentValue, index) {
        if (index === attributeNameArr.length - 1) {
            res[currentValue] = attributeValue;
        } else if (!res[currentValue]) {
            res[currentValue] = {};
        }
        return res[currentValue];
    }, obj);
}


/**
 * Safely gets a custom attribute from a System Object.
 * Since attempting to return a nonexistent custom attribute throws an error in SFCC,
 * this is the safest way to check whether an attribute exists.
 * @param {dw.object.CustomAttributes} customAttributes The CustomAttributes object, e.g. content.getCustom()
 * @param {string} caKey The custom attribute's key whose value we want to return
 * @returns {*} The custom attribute value if exists,
 *              null if the custom attribute is defined but it has no value for this specific SO,
 *              undefined if the custom attribute is not defined at all in BM
 */
function safelyGetCustomAttribute(customAttributes, caKey) {
    try {
        return customAttributes[caKey];
    } catch (e) { // eslint-disable-line no-unused-vars
        return undefined;
    }
}

module.exports.getAttributeValue = getAttributeValue;
module.exports.setAttributeValue = setAttributeValue;
module.exports.safelyGetCustomAttribute = safelyGetCustomAttribute;
