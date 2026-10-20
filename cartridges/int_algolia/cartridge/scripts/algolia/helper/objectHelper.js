'use strict';

/**
 * Function get value of object property by attribute name.
 * An attribute name can be complex and consist of several levels.
 * Attribute names must be separated by dots.
 * Example: primaryCategory.ID
 * @param {dw.object.ExtensibleObject} extensibleObject - business object
 * @param {string} attributeName - object attribute name
 * @returns {string|boolean|number|null} - value
 */
function getAttributeValue(extensibleObject, attributeName) {
    if (!extensibleObject) {
        return null;
    }
    var properties = attributeName.split('.');
    var result = properties.reduce(function (previousValue, currentProperty) {
        if (previousValue === null || !(currentProperty in previousValue)) {
            return null;
        }

        return previousValue[currentProperty];
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
 * An attribute with no value is not always null: a String attribute returns null, but an
 * Enumeration attribute returns an EnumValue whose base value is null (see
 * dw.value.EnumValue), which is truthy. Check `.value` on Enumeration attributes.
 * @param {dw.object.CustomAttributes} customAttributes The CustomAttributes object,
 *                                                     e.g. content.getCustom()
 * @param {string} caKey The custom attribute's key whose value we want to return
 * @returns {*} The custom attribute value if exists,
 *              null or an EnumValue with a null base value if the custom attribute is
 *              defined but it has no value for this specific SO,
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
