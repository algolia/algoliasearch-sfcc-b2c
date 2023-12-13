'use strict';

var Bytes = require('dw/util/Bytes');
var StringUtils = require('dw/util/StringUtils');
var DEFAULT_MAX_RECORD_BYTES = 10000; // expressed in bytes
var SAFETY_MARGIN = 250; // expressed in bytes
var RESTRICTED_TAGS = ['applet', 'area', 'audio', 'base', 'basefont', 'bgsound', 'button',
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
    var sections = htmlContent.split(splitterBegin);

    sections.forEach(function(section) {
        section = StringUtils.trim(splitterBegin + section) || '';

        if (!section.trim()) {
            return;
        }

        //remove restricted tags and their content
        RESTRICTED_TAGS.forEach(function(tag) {
            section = section.replace(new RegExp('<' + tag + '.*?' + tag + '>', 'g'), '');
        });

        //remove all HTML tags
        section = section.replace(/<[^>]*>/g, '');

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
 * Calculates the max byte size of a record.
 *
 * @param {dw.content.Content} content - Content object.
 * @returns {number} Max byte size.
 */
function getMaxByteSize(content) {
    var tempBody = content.body;
    delete content.body;
    var contentSize = new Bytes(JSON.stringify(content)).getLength() + SAFETY_MARGIN;
    content.body = tempBody;

    return DEFAULT_MAX_RECORD_BYTES - contentSize;
}

module.exports = {
    splitHtmlContent: splitHtmlContent,
    getMaxByteSize: getMaxByteSize
};
