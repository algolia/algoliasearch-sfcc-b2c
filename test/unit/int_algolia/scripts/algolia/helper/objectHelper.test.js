'use strict';

const { getAttributeValue, setAttributeValue, safelyGetCustomAttribute } = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/objectHelper');

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

    test('should return correct value for a deeply nested attribute name', () => {
        const extensibleObject = {
            deeply: { nested: { attribute: 'nestedValue' } }
        };
        expect(getAttributeValue(extensibleObject, 'deeply.nested.attribute')).toBe('nestedValue');
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

describe('setAttributeValue', () => {
    test('should set a simple attribute name', () => {
        const res = {};
        setAttributeValue(res, 'simpleAttribute', 'value');
        expect(res).toEqual({ simpleAttribute: 'value' });
    });

    test('should set a nested attribute name', () => {
        const res = {};
        setAttributeValue(res, 'nested.attribute', 'nestedValue');
        expect(res).toEqual({
            nested: { attribute: 'nestedValue' }
        });
    });

    test('should work for any level of nesting', () => {
        const res = {};
        setAttributeValue(res, 'deeply.nested.attribute', 'nestedValue');
        expect(res).toEqual({
            deeply: {
                nested: {
                    attribute: 'nestedValue'
                }
            }
        });
    });

    test('should set a second nested attribute name', () => {
        const res = { nested: { firstAttribute: 'nestedValue1' } };
        setAttributeValue(res, 'nested.secondAttribute', 'nestedValue2');
        expect(res).toEqual({
            nested: {
                firstAttribute: 'nestedValue1',
                secondAttribute: 'nestedValue2'
            }
        });
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
