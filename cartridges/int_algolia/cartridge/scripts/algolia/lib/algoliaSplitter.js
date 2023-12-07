'use strict';

const Bytes = require('dw/util/Bytes');
const StringUtils = require('dw/util/StringUtils');
const DEFAULT_MAX_RECORD_BYTES = 10000; // expressed in bytes

/**
 * Splits HTML content into multiple records based on a specified HTML element.
 *
 * @param {string} htmlContent - HTML content to split.
 * @param {number} maxByteSize - Maximum byte size for each split part.
 * @param {string} splitterElement - HTML element to use as the splitter.
 * @returns {string[]} Array of split content pieces.
 */
function splitHtmlContent(htmlContent, maxByteSize, splitterElement) {
    const split = [];
    const splitterBegin = `<${splitterElement}>`;
    const sections = htmlContent.split(splitterBegin);

    sections.forEach(section => {
        section = StringUtils.trim(`${splitterBegin}${section}`) || '';

        if (!section.trim()) {
            return;
        }

        const sectionSize = new Bytes(section).getLength();
        if (sectionSize > maxByteSize) {
            splitLargeContent(section, maxByteSize).forEach(subsection => split.push(subsection));
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
    const splitContent = [];
    const parts = content.split(' ');
    let currentPart = '';

    parts.forEach(part => {
        const partBytes = new Bytes(part).getLength();
        const currentPartBytes = new Bytes(currentPart).getLength();

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
    const tempBody = content.body;
    delete content.body;
    const contentSize = new Bytes(JSON.stringify(content)).getLength() + 250;
    content.body = tempBody;

    return DEFAULT_MAX_RECORD_BYTES - contentSize;
}

module.exports = {
    splitHtmlContent,
    getMaxByteSize
};
