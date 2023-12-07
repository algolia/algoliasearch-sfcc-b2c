'use strict';

const Site = require('dw/system/Site');
const stringUtils = require('dw/util/StringUtils');
const URLUtils = require('dw/web/URLUtils');

const algoliaUtils = require('*/cartridge/scripts/algolia/lib/utils');
const algoliaContentConfig = require('*/cartridge/scripts/algolia/lib/algoliaContentConfig');

const ACTION_ENDPOINT_CONTENT = 'Page-Show';

/**
 * Function get value of content property by attribute name.
 * An attribute name can be complex and consist of several levels.
 * Attribute names must be separated by dots.
 * Examle: primaryCategory.ID
 * @param {dw.content.Content} content - content
 * @param {string} contentAttributeName - content attribute name
 * @returns {string|boolean|number|null} - value
 */
function getAttributeValue(content, contentAttributeName) {
    const properties = contentAttributeName.split('.');
    let result = properties.reduce((previousValue, currentProperty) => 
        previousValue ? previousValue[currentProperty] : null, content);

    if (typeof result === 'string') {
        result = stringUtils.trim(algoliaUtils.escapeEmoji(result.toString()));
    }
    return result || null;
}

/**
 * Function get localazed value of content property by attribute name.
 * An attribute name can be complex and consist of several levels.
 * Attribute names must be separated by dots.
 * Examle: primaryCategory.ID
 * @param {dw.content.Content} content - content
 * @param {string} contentAttributeName - content attribute name
 * @returns {Object} - value
 */
function getAttributeLocalizedValues(content, contentAttributeName) {
    const currentSites = Site.getCurrent();
    const siteLocales = currentSites.getAllowedLocales();
    const originalLocale = request.getLocale();
    const value = {};

    siteLocales.forEach(localeName => {
        request.setLocale(localeName);
        value[localeName] = getAttributeValue(content, contentAttributeName);
    });

    request.setLocale(originalLocale);
    return value;
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
    } catch (e) {
        return undefined;
    }
}

/**
 * Handler complex and calculated Content attributes
 */
var aggregatedValueHandlers = {
    url: function (content) {
        var pageURL = URLUtils.url(ACTION_ENDPOINT_CONTENT, 'cid', content.ID);
        return pageURL ? pageURL.toString() : null;
    },
    body: function (content) {
        if (content && content.custom && content.custom.body) {
            return content.custom.body.source;
        }
        return null;
    },
    order: function () {
        return null;
    }
};

/**
 * AlgoliaContent class that represents an algoliaContent Object
 * @param {dw.content.Content} content content
 * @param {Array} [fieldListOverride] (optional) if supplied, it overrides the regular list of attributes to be sent (default + customFields)
 * @constructor
 */
function algoliaContent(content, fieldListOverride) {
    const algoliaFields = fieldListOverride || algoliaContentConfig.defaultAttributes.concat(algoliaData.getSetOfArray('CustomFields'));

    if (content) {
        algoliaFields.forEach(attributeName => {
            const config = algoliaContentConfig.attributeConfig[attributeName];
            if (config) {
                let value;
                if (config.localized) {
                    value = getAttributeLocalizedValues(content, config.attribute);
                } else {
                    value = aggregatedValueHandlers[attributeName]
                        ? aggregatedValueHandlers[attributeName](content)
                        : getAttributeValue(content, config.attribute);
                }
                if (value) this[attributeName] = value;
            }
        });
    } else {
        this.id = null;
    }
}

module.exports = algoliaContent;
