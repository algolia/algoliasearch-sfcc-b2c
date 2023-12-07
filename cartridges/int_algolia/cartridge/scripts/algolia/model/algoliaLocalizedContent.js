'use strict';

var StringUtils = require('dw/util/StringUtils');
var URLUtils = require('dw/web/URLUtils');
var AlgoliaUtils = require('*/cartridge/scripts/algolia/lib/utils');
var AlgoliaContentConfig = require('*/cartridge/scripts/algolia/lib/algoliaContentConfig');

var ACTION_ENDPOINT_CONTENT = 'Page-Show';

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

function safelyGetCustomAttribute(customAttributes, caKey) {
    try {
        return customAttributes[caKey];
    } catch (e) {
        return undefined;
    }
}

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
