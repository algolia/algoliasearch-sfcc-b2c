'use strict';

var StringUtils = require('dw/util/StringUtils');
var URLUtils = require('dw/web/URLUtils');
var AlgoliaUtils = require('*/cartridge/scripts/algolia/lib/utils');
var AlgoliaContentConfig = require('*/cartridge/scripts/algolia/lib/algoliaContentConfig');

var ACTION_ENDPOINT_CONTENT = 'Page-Show';

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
    var properties = attributeName.split('.');
    var result = properties.reduce(function (previousValue, currentProperty) {
        var tempResult = previousValue ? previousValue[currentProperty] : null;
        if (typeof tempResult === 'string' && !empty(tempResult)) {
            tempResult = StringUtils.trim(AlgoliaUtils.escapeEmoji(tempResult));
        }
        return tempResult;
    }, extensibleObject);

    return result;
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
        var pageDesignerContent;

        if (content.isPage()) {
            var pageDesignerHelper = require('*/cartridge/scripts/algolia/lib/pageDesignerHelper');
            var body = pageDesignerHelper.getContainerContent(content, 'pages');
            return body;
        }

        if (content && content.custom && content.custom.body) {
            return content.custom.body.source;
        }
        return null;
    },

    algolia_chunk_order: function () {
        return null;
    }
};

/**
 * AlgoliaLocalizedContent class that represents a localized algoliaContent ready to be indexed
 * @param {Object} parameters - model parameters
 * @param {dw.content.Content} parameters.content - Content
 * @param {string} parameters.locale - The requested locale
 * @param {Array} parameters.attributeList list of attributes to be fetched
 * @param {Object?} parameters.baseModel - (optional) A base model object that contains some pre-fetched properties
 * @param {boolean?} parameters.fullRecordUpdate - (optional) Indicate if the model is meant to fully replace the existing record
 * @constructor
 */
function AlgoliaLocalizedContent(parameters) {
    request.setLocale(parameters.locale || 'default');
    this.objectID = parameters.content && parameters.content.ID ? parameters.content.ID : null;

    parameters.attributeList.forEach(function (attributeName) {
        var config = AlgoliaContentConfig.attributeConfig[attributeName];
        if (config) {
            if (parameters.baseModel && parameters.baseModel[attributeName]) {
                this[attributeName] = parameters.baseModel[attributeName];
            } else {
                this[attributeName] = aggregatedValueHandlers[attributeName]
                    ? aggregatedValueHandlers[attributeName](parameters.content)
                    : getAttributeValue(parameters.content, config.attribute);
            }
        }
    }, this);
}

module.exports = AlgoliaLocalizedContent;
