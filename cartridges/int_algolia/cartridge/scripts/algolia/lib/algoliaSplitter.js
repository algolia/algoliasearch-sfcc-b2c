'use strict';

var Bytes = require('dw/util/Bytes');
var StringUtils = require('dw/util/StringUtils');
const DEFAULT_MAX_RECORD_BYTES = 10000; // expressed in bytes
const SAFETY_MARGIN = 300; // expressed in bytes
const IGNORED_TAGS = ['applet', 'area', 'audio', 'base', 'basefont', 'bgsound', 'button',
    'canvas', 'command', 'datalist', 'dialog', 'embed', 'form', 'frame', 'frameset', 'iframe',
    'image', 'input', 'map', 'noembed', 'noscript', 'object', 'picture', 'script', 'style',
    'svg', 'template', 'textarea', 'video'];

/**
 * Splits HTML content into multiple records based on a specified HTML element.
 *
 * @param {string} htmlContent - HTML content to split.
 * @param {number} maxByteSize - Maximum byte size for each split part.
 * @param {string} splitterElement - HTML element to use as the splitter.
 * @returns {string[]} Array of split content pieces.
 */
function splitHtmlContent(htmlContent, maxByteSize, splitterElement) {
    var split = [];
    var splitterBegin = '<' + splitterElement + '>';

    //remove restricted tags and their content
    var content = removeIgnoredContent(htmlContent);

    var sections = content.split(splitterBegin);

    if (sections[0] === '') {
        sections.shift();
    }

    sections.forEach(function(section) {
        section = StringUtils.trim(splitterBegin + section) || '';

        if (!section.trim()) {
            return;
        }


        //remove all HTML tags
        section = removeHtmlTagsAndFormat(section);

        var sectionSize = new Bytes(section).getLength();
        if (sectionSize > maxByteSize) {
            splitLargeContent(section, maxByteSize).forEach(function(subsection) {
                split.push(subsection);
            });
        } else {
            split.push(section);
        }
    });

    return split;
}

/**
 * Removes restricted tags
 *
 * @param {string} content - Content will be sanitized
 * @returns {string} Sanitized content
 */
function removeIgnoredContent(content) {
    //remove restricted tags and their content
    IGNORED_TAGS.forEach(function(tag) {
        content = content.replace(new RegExp('<' + tag + '.*?' + tag + '>', 'g'), '');
    });

    return content;
}

/**
 * removes all HTML tags and formats
 * @param {string} content - Content will be sanitized
 * @returns {string} Sanitized content
 */
function removeHtmlTagsAndFormat(content) {
    return content
        .replace(/<[^>]*>/g, '') // Removes HTML tags
        .replace(/&nbsp;/g, ' ') // Replaces non-breaking spaces with a space
        .replace(/\r\n/g, ' ') // Replaces carriage returns and newlines with spaces
        .replace(/\s+/g, ' '); // Condenses multiple consecutive spaces into a single space
}

/**
 * Splits a large content string into smaller parts.
 *
 * @param {string} content - Content to be split.
 * @param {number} maxByteSize - Maximum byte size for each split part.
 * @returns {string[]} Array of split content.
 */
function splitLargeContent(content, maxByteSize) {
    var splitContent = [];
    var parts = content.split(' ');
    var currentPart = '';

    parts.forEach(function(part) {
        var partBytes = new Bytes(part).getLength();
        var currentPartBytes = new Bytes(currentPart).getLength();

        if ((currentPartBytes + partBytes) > maxByteSize) {
            splitContent.push(currentPart);
            currentPart = part;
        } else {
            currentPart += (currentPart ? ' ' : '') + part;
        }
    });

    if (currentPart) {
        splitContent.push(currentPart);
    }

    return splitContent;
}

/**
 * Calculates the max byte size of body.
 *
 * @param {Object} content - Content object.
 * @returns {number} Max byte size.
 */
function getMaxBodySize(content) {
    var tempBody = content.body;
    delete content.body;
    var contentSize = new Bytes(JSON.stringify(content)).getLength() + SAFETY_MARGIN;
    content.body = tempBody;

    return DEFAULT_MAX_RECORD_BYTES - contentSize;
}

module.exports = {
    splitHtmlContent: splitHtmlContent,
    getMaxBodySize: getMaxBodySize,
    removeHtmlTagsAndFormat: removeHtmlTagsAndFormat
};
