// Mirrors the event-type constants of dw.io.XMLStreamConstants (javax.xml.stream.XMLStreamConstants).
// Only START_ELEMENT, END_ELEMENT and CHARACTERS are exercised by the delta export extraction, but
// the full set is included so the mock matches the real numeric values.
module.exports = {
    START_ELEMENT: 1,
    END_ELEMENT: 2,
    PROCESSING_INSTRUCTION: 3,
    CHARACTERS: 4,
    COMMENT: 5,
    SPACE: 6,
    START_DOCUMENT: 7,
    END_DOCUMENT: 8,
    ENTITY_REFERENCE: 9,
    ATTRIBUTE: 10,
    DTD: 11,
    CDATA: 12,
    NAMESPACE: 13,
    NOTATION_DECLARATION: 14,
    ENTITY_DECLARATION: 15,
};
