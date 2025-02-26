'use strict';

const GlobalMock = require('../../../../../mocks/global');
const ProductMock = require('../../../../../mocks/dw/catalog/Variant');

global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

jest.mock('dw/object/SystemObjectMgr', () => {
    return {
        getAllSystemObjects: jest.fn().mockImplementation((objType) => {
            if (objType === 'Store') {
                const storeIterator = {
                    hasNext: function() {
                        if (!this.index) {
                            this.index = 0;
                        }
                        return this.index < this.stores.length;
                    },
                    next: function() {
                        const store = this.stores[this.index];
                        this.index++;
                        return store;
                    },
                    stores: [
                        {
                            ID: 'store1',
                            inventoryList: {
                                getRecord: jest.fn().mockImplementation((productId) => {
                                    if (productId === 'product-in-stock') {
                                        return {
                                            ATS: { value: 10 }
                                        };
                                    } else if (productId === 'product-low-stock') {
                                        return {
                                            ATS: { value: 1 }
                                        };
                                    } else if (productId === 'product-out-of-stock') {
                                        return {
                                            ATS: { value: 0 }
                                        };
                                    }
                                    return null;
                                })
                            }
                        },
                        {
                            ID: 'store2',
                            inventoryList: {
                                getRecord: jest.fn().mockImplementation((productId) => {
                                    if (productId === 'product-in-stock') {
                                        return {
                                            ATS: { value: 15 }
                                        };
                                    } else if (productId === 'product-store2-only') {
                                        return {
                                            ATS: { value: 5 }
                                        };
                                    }
                                    return null;
                                })
                            }
                        },
                        {
                            // Store without inventory list
                            ID: 'store3',
                            inventoryList: null
                        }
                    ]
                };
                return storeIterator;
            }
            return null;
        })
    };
}, { virtual: true });


jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    return {
        getSetOfArray: function(id) {
            return id === 'AdditionalAttributes'
                ? ['storeAvailability', 'url', 'UPC', 'name']
                : [];
        },
        getPreference: function(id) {
            return id === 'InStockThreshold' ? 1 : (id === 'IndexOutOfStock' ? true : null);
        }
    };
}, { virtual: true });

jest.mock('*/cartridge/scripts/algolia/filters/productFilter', () => {
    return {};
}, { virtual: true });

const AlgoliaLocalizedProduct = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedProduct');

describe('storeAvailability Tests', function() {
    test('Product in stock in multiple stores', function() {
        const product = new ProductMock({
            ID: 'product-in-stock'
        });

        const algoliaProduct = new AlgoliaLocalizedProduct({
            product: product,
            locale: 'default',
            attributeList: ['storeAvailability']
        });

        expect(algoliaProduct.storeAvailability).toBeDefined();
        expect(Array.isArray(algoliaProduct.storeAvailability)).toBe(true);
        expect(algoliaProduct.storeAvailability).toContain('store1');
        expect(algoliaProduct.storeAvailability).toContain('store2');
        expect(algoliaProduct.storeAvailability.length).toBe(2);
    });

    test('Product only available in one store', function() {
        const product = new ProductMock({
            ID: 'product-store2-only'
        });

        const algoliaProduct = new AlgoliaLocalizedProduct({
            product: product,
            locale: 'default',
            attributeList: ['storeAvailability']
        });

        expect(algoliaProduct.storeAvailability).toBeDefined();
        expect(Array.isArray(algoliaProduct.storeAvailability)).toBe(true);
        expect(algoliaProduct.storeAvailability).toContain('store2');
        expect(algoliaProduct.storeAvailability.length).toBe(1);
    });

    test('Product with low stock (below threshold)', function() {
        const product = new ProductMock({
            ID: 'product-low-stock'
        });

        const algoliaProduct = new AlgoliaLocalizedProduct({
            product: product,
            locale: 'default',
            attributeList: ['storeAvailability']
        });

        expect(algoliaProduct.storeAvailability).toBeDefined();
        expect(Array.isArray(algoliaProduct.storeAvailability)).toBe(true);
        expect(algoliaProduct.storeAvailability.length).toBe(0);
    });

    test('Product out of stock', function() {
        const product = new ProductMock({
            ID: 'product-out-of-stock'
        });

        const algoliaProduct = new AlgoliaLocalizedProduct({
            product: product,
            locale: 'default',
            attributeList: ['storeAvailability']
        });

        expect(algoliaProduct.storeAvailability).toBeDefined();
        expect(Array.isArray(algoliaProduct.storeAvailability)).toBe(true);
        expect(algoliaProduct.storeAvailability.length).toBe(0);
    });

    test('Product not in any store inventory', function() {
        const product = new ProductMock({
            ID: 'product-not-in-inventory'
        });

        const algoliaProduct = new AlgoliaLocalizedProduct({
            product: product,
            locale: 'default',
            attributeList: ['storeAvailability']
        });

        expect(algoliaProduct.storeAvailability).toBeDefined();
        expect(Array.isArray(algoliaProduct.storeAvailability)).toBe(true);
        expect(algoliaProduct.storeAvailability.length).toBe(0);
    });
});