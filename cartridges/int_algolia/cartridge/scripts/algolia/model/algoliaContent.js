'use strict';

const Site = require('dw/system/Site');
const stringUtils = require('dw/util/StringUtils');
const URLUtils = require('dw/web/URLUtils');

const algoliaUtils = require('*/cartridge/scripts/algolia/lib/utils');
const algoliaContentConfig = require('*/cartridge/scripts/algolia/lib/algoliaContentConfig');

const ACTION_ENDPOINT_CONTENT = 'Page-Show';

function getAttributeValue(content, contentAttributeName) {
    const properties = contentAttributeName.split('.');
    let result = properties.reduce((previousValue, currentProperty) => 
        previousValue ? previousValue[currentProperty] : null, content);

    if (typeof result === 'string') {
        result = stringUtils.trim(algoliaUtils.escapeEmoji(result.toString()));
    }
    return result || null;
}

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

function safelyGetCustomAttribute(customAttributes, caKey) {
    try {
        return customAttributes[caKey];
    } catch (e) {
        return undefined;
    }
}

const aggregatedValueHandlers = {
    url: content => URLUtils.url(ACTION_ENDPOINT_CONTENT, 'cid', content.ID)?.toString() || null,
    body: content => content.custom.body?.source || null,
    order: () => null,
};

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
