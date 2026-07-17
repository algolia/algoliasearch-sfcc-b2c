const XMLStreamConstants = require('./XMLStreamConstants');

/**
 * Removes a namespace prefix from an element or attribute name (e.g. "ns:name" -> "name").
 * @param {string} name element or attribute name
 * @returns {string} the local part of the name
 */
function stripPrefix(name) {
    const idx = name.indexOf(':');
    return idx === -1 ? name : name.slice(idx + 1);
}

/**
 * Parses the attribute portion of a start tag into a map keyed by the attribute name as written.
 * @param {string} attrString the text after the element name, e.g. 'product-id="X" mode="delete"'
 * @returns {Object} map of attribute name to value
 */
function parseAttributes(attrString) {
    const attributes = {};
    const attrRegex = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = attrRegex.exec(attrString)) !== null) {
        attributes[m[1]] = m[2];
    }
    return attributes;
}

/**
 * Tokenizes an XML string into a flat list of StAX-style (Streaming API for XML) events. Handles the element, attribute
 * and text shapes used by the delta export fixtures; it is not a general-purpose XML parser.
 * @param {string} xml the raw XML string
 * @returns {Array} an array of { type, localName?, attributes? } events
 */
function tokenize(xml) {
    const events = [];
    const tagRegex = /<[^>]+>/g;
    let match;
    let lastIndex = 0;

    while ((match = tagRegex.exec(xml)) !== null) {
        const text = xml.slice(lastIndex, match.index);
        if (text.trim().length > 0) {
            events.push({ type: XMLStreamConstants.CHARACTERS });
        }
        lastIndex = tagRegex.lastIndex;

        const tag = match[0];
        if (tag.startsWith('<?') || tag.startsWith('<!')) {
            continue; // XML declaration, comment or doctype
        }

        if (tag.startsWith('</')) {
            events.push({ type: XMLStreamConstants.END_ELEMENT, localName: stripPrefix(tag.slice(2, -1).trim()) });
        } else {
            const selfClosing = tag.endsWith('/>');
            const inner = tag.slice(1, selfClosing ? -2 : -1).trim();
            const spaceIdx = inner.search(/\s/);
            const rawName = spaceIdx === -1 ? inner : inner.slice(0, spaceIdx);
            const attrString = spaceIdx === -1 ? '' : inner.slice(spaceIdx + 1);
            const localName = stripPrefix(rawName);

            events.push({ type: XMLStreamConstants.START_ELEMENT, localName: localName, attributes: parseAttributes(attrString) });
            if (selfClosing) {
                events.push({ type: XMLStreamConstants.END_ELEMENT, localName: localName });
            }
        }
    }

    return events;
}

/**
 * Minimal dw.io.XMLStreamReader mock. Converts an XML string (read from the supplied FileReader
 * mock) into a stream of START_ELEMENT / END_ELEMENT / CHARACTERS events, exposing the subset of
 * the StAX API the delta export extraction relies on.
 */
class XMLStreamReader {
    constructor(reader) {
        const xml = reader && typeof reader.getString === 'function' ? reader.getString() : String(reader || '');
        this._events = tokenize(xml);
        this._index = -1;
        this._current = null;
    }
    hasNext() {
        return this._index < this._events.length - 1;
    }
    next() {
        this._index += 1;
        this._current = this._events[this._index];
        return this._current.type;
    }
    getLocalName() {
        return this._current ? this._current.localName : null;
    }
    getAttributeValue(uri, localName) {
        if (this._current && this._current.attributes && Object.prototype.hasOwnProperty.call(this._current.attributes, localName)) {
            return this._current.attributes[localName];
        }
        return null;
    }
    readXMLObject() {
        return null;
    }
    close() {}
}

module.exports = XMLStreamReader;
