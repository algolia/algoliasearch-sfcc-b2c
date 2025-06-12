'use strict';

var ProductMock = require('../../../../../mocks/dw/catalog/Variant');

describe('productFilter.isInStock', () => {
    var productFilter = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');

    beforeEach(() => {
        jest.resetModules();
    });

    test('Check if product is in stock', () => {
        const inStockProduct = new ProductMock();

        inStockProduct.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => {
                    return { getATS: () => { return { getValue: () => { return 5; } } } };
                },
            };
        }
        const inStock = productFilter.isInStock(inStockProduct, 1);

        expect(inStock).toBe(true);
    });

    test('Check if product is out of stock', () => {
        productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');

        const outOfStockProduct = new ProductMock();
        outOfStockProduct.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => {
                    return { getATS: () => { return { getValue: () => { return 0; } } } };
                },
            };
        }
        const inStock = productFilter.isInStock(outOfStockProduct, 1);

        expect(inStock).toBe(false);
    });
});

// Mock StoreMgr for isInStoreStock tests
jest.mock('dw/catalog/StoreMgr', () => {
    const storeMap = {
        'store-with-inventory': {
            inventoryList: {
                getRecord: (productId) => {
                    if (productId === 'in-stock-product') {
                        return { ATS: { value: 10 } };
                    } else if (productId === 'low-stock-product') {
                        return { ATS: { value: 1 } };
                    } else if (productId === 'out-of-stock-product') {
                        return { ATS: { value: 0 } };
                    }
                    return null;
                }
            }
        },
        'store-without-inventory': {
            inventoryList: null
        }
    };

    return {
        getStore: (storeId) => storeMap[storeId] || null
    };
}, { virtual: true });

describe('productFilter.isInStoreStock', () => {
    var productFilter = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');

    beforeEach(() => {
        jest.resetModules();
    });

    test('Product is in stock at store', () => {
        const product = new ProductMock({ ID: 'in-stock-product' });
        const inStock = productFilter.isInStoreStock(product, 'store-with-inventory', 2);
        expect(inStock).toBe(true);
    });

    test('Product is below threshold at store', () => {
        const product = new ProductMock({ ID: 'low-stock-product' });
        const inStock = productFilter.isInStoreStock(product, 'store-with-inventory', 2);
        expect(inStock).toBe(false);
    });

    test('Product is out of stock at store', () => {
        const product = new ProductMock({ ID: 'out-of-stock-product' });
        const inStock = productFilter.isInStoreStock(product, 'store-with-inventory', 2);
        expect(inStock).toBe(false);
    });

    test('Product not found in store inventory', () => {
        const product = new ProductMock({ ID: 'non-existent-product' });
        const inStock = productFilter.isInStoreStock(product, 'store-with-inventory', 2);
        expect(inStock).toBe(false);
    });

    test('Store does not exist', () => {
        const product = new ProductMock({ ID: 'in-stock-product' });
        const inStock = productFilter.isInStoreStock(product, 'non-existent-store', 2);
        expect(inStock).toBe(false);
    });

    test('Store has no inventory list', () => {
        const product = new ProductMock({ ID: 'in-stock-product' });
        const inStock = productFilter.isInStoreStock(product, 'store-without-inventory', 2);
        expect(inStock).toBe(false);
    });
});