'use strict';

var URLUtils = require('dw/web/URLUtils');
var AlgoliaUtils = require('*/cartridge/scripts/algolia/lib/utils');
var AlgoliaContentConfig = require('*/cartridge/scripts/algolia/lib/algoliaContentConfig');
var ObjectHelper = require('*/cartridge/scripts/algolia/helper/objectHelper');

var ACTION_ENDPOINT_CONTENT = 'Page-Show';

/**
 * Handler complex and calculated Content attributes
 */
var aggregatedValueHandlers = {
    url: function (content, includedContent) {
        var pageURL = URLUtils.url(ACTION_ENDPOINT_CONTENT, 'cid', content.ID);
        return pageURL ? pageURL.toString() : null;
    },
    body: function (content, includedContent) {
        var body = null;
        var pageDesignerContent;

        if (content.isPage() && (includedContent === 'allContents' || includedContent === 'pageDesignerComponents')) {
            var pageDesignerHelper = require('*/cartridge/scripts/algolia/lib/pageDesignerHelper');
            body = pageDesignerHelper.getContainerContent(content, 'pages');
        }

        if (content && content.custom && content.custom.body && (includedContent === 'allContents' || includedContent === 'contentAssets')) {
            body = content.custom.body.source;
        }

        return body;
    }
};

/**
 * AlgoliaLocalizedContent class that represents a localized algoliaContent ready to be indexed
 * @param {Object} parameters - model parameters
 * @param {dw.content.Content} parameters.content - Content
 * @param {string} parameters.locale - The requested locale
 * @param {Array} parameters.attributeList list of attributes to be fetched
 * @param {Object?} parameters.baseModel - (optional) A base model object that contains some pre-fetched properties
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
                    ? aggregatedValueHandlers[attributeName](parameters.content, parameters.includedContent)
                    : ObjectHelper.getAttributeValue(parameters.content, config.attribute);
            }
        }
    }, this);
}

module.exports = AlgoliaLocalizedContent;
