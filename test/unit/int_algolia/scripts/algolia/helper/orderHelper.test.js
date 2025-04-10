'use strict';

// Mock the Site module
jest.mock('dw/system/Site', () => {
    return {
        getCurrent: function () {
            return {
                getAllowedLocales: function () {
                    var arr = ['default', 'fr', 'en'];
                    arr.size = function () {
                        return arr.length;
                    };
                    return arr;
                }
            };
        }
    }
}, { virtual: true });

// Mock AlgoliaLocalizedProduct
jest.mock('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct', () => {
    return function(config) {
        return {
            objectID: config.product ? config.product.ID : 'test-product-id',
            locale: config.locale,
            in_stock: config.product ? config.product.in_stock : true,
            price: {
                USD: 129.99,
                EUR: 119.99
            },
            _attributeList: config.attributeList
        };
    };
}, { virtual: true });

// Mock algoliaData
jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    return {
        calculateIndexName: function (indexType, locale) {
            return indexType + '_' + locale;
        }
    };
}, { virtual: true });

// Mock jobHelper
jest.mock('*/cartridge/scripts/algolia/helper/jobHelper', () => {
    return {
        AlgoliaOperation: function (action, obj, indexName) {
            return {
                action: action,
                obj: obj,
                indexName: indexName
            };
        }
    };
}, { virtual: true });

const orderHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/orderHelper');

describe('Order Helper', function () {
    test('generateAlgoliaOperations should create operations for all locales', function () {
        const masterProduct = {
            ID: 'test-product-id',
            in_stock: true
        };

        const productConfig = {
            product: masterProduct,
            attributeList: ['variants', 'in_stock']
        };

        const operations = orderHelper.generateAlgoliaOperations(productConfig);

        // Should have 3 operations (one for each locale)
        expect(operations.length).toBe(3);

        // Check the default locale operation
        expect(operations[0].action).toBe('partialUpdateObject');
        expect(operations[0].indexName).toBe('products_default');
        expect(operations[0].obj.objectID).toBe('test-product-id');
        expect(operations[0].obj._attributeList).toEqual(['variants', 'in_stock']);
        expect(operations[0].obj.in_stock).toBe(true);

        // Check the fr locale operation
        expect(operations[1].action).toBe('partialUpdateObject');
        expect(operations[1].indexName).toBe('products_fr');
        expect(operations[1].obj.locale).toBe('fr');
        expect(operations[1].obj._attributeList).toEqual(['variants', 'in_stock']);
    });

    test('generateAlgoliaOperations should handle stock status correctly', function () {
        const masterProduct = {
            ID: 'test-product-id',
            in_stock: false  // Product is out of stock
        };

        const productConfig = {
            product: masterProduct,
            attributeList: ['in_stock']  // Only update the stock status
        };

        const operations = orderHelper.generateAlgoliaOperations(productConfig);

        operations.forEach(operation => {
            expect(operation.obj.in_stock).toBe(false);
            expect(operation.obj['colorVariations']).toBe(undefined);
            expect(operation.action).toBe('partialUpdateObject');
            expect(operation.obj._attributeList).toEqual(['in_stock']);
        });
    });

    test('generateAlgoliaOperations should preserve all product configuration', function () {
        // Test with a more complex product configuration
        const masterProduct = {
            ID: 'complex-product',
            in_stock: true,
            online: true,
            name: 'Test Product'
        };

        const productConfig = {
            product: masterProduct,
            attributeList: ['in_stock', 'online', 'name'],
        };

        const operations = orderHelper.generateAlgoliaOperations(productConfig);

        expect(operations[0].obj.objectID).toBe('complex-product');
        expect(operations[0].obj.in_stock).toBe(true);
        expect(operations[0].obj._attributeList).toContain('in_stock');
        expect(operations[0].obj._attributeList).toContain('online');
        expect(operations[0].obj._attributeList).toContain('name');
    });
});