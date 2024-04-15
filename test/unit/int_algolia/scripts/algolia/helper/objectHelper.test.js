'use strict';

const { getAttributeValue, safelyGetCustomAttribute } = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/objectHelper');

describe('getAttributeValue', () => {
    test('should return correct value for a simple attribute name', () => {
        const extensibleObject = { simpleAttribute: 'value' };
        expect(getAttributeValue(extensibleObject, 'simpleAttribute')).toBe('value');
    });

    test('should return correct value for a nested attribute name', () => {
        const extensibleObject = {
            nested: { attribute: 'nestedValue' }
        };
        expect(getAttributeValue(extensibleObject, 'nested.attribute')).toBe('nestedValue');
    });

    test('should return null for non-existing attribute', () => {
        const extensibleObject = { someAttribute: 'value' };
        expect(getAttributeValue(extensibleObject, 'nonExisting')).toBeNull();
    });

    test('encoding', () => {
        const object1 = { japaneseAttribute: '春 - ルック' };
        expect(getAttributeValue(object1, 'japaneseAttribute')).toBe('春 - ルック');
        const object2 = { emojiAttribute: 'Hi 🐣' };
        expect(getAttributeValue(object2, 'emojiAttribute')).toBe('Hi 🐣');
    });
});

describe('safelyGetCustomAttribute', () => {
    test('should return attribute value if exists', () => {
        const customAttributes = { existingAttribute: 'value' };
        expect(safelyGetCustomAttribute(customAttributes, 'existingAttribute')).toBe('value');
    });

    test('should return null if attribute exists but has no value', () => {
        const customAttributes = { emptyAttribute: null };
        expect(safelyGetCustomAttribute(customAttributes, 'emptyAttribute')).toBeNull();
    });

    test('should return undefined for non-defined custom attribute', () => {
        const customAttributes = { someAttribute: 'value' };
        expect(safelyGetCustomAttribute(customAttributes, 'nonDefined')).toBeUndefined();
    });
});
