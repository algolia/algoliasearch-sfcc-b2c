'use strict';

var VariantMock = require('../../../../../mocks/dw/catalog/Variant');
var MasterProductMock = require('../../../../../mocks/dw/catalog/MasterProduct');

describe('productFilter.isInStock', () => {
    var productFilter = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');

    beforeEach(() => {
        jest.resetModules();
    });

    test('Check if product is in stock', () => {
        const inStockProduct = new VariantMock({ ats: 5 });
        const inStock = productFilter.isInStock(inStockProduct, 1);

        expect(inStock).toBe(true);
    });

    test('Check if product is out of stock', () => {
        productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');

        const outOfStockProduct = new VariantMock({ ats: 0 });
        const inStock = productFilter.isInStock(outOfStockProduct, 1);

        expect(inStock).toBe(false);
    });

    test('Master product with in-stock variant is considered in stock', () => {
        const inStockVariant = new VariantMock({ ats: 5 });
        const outOfStockVariant = new VariantMock({ ats: 0 });
        
        const masterProduct = new MasterProductMock({
            variants: [outOfStockVariant, inStockVariant]
        });
        
        const inStock = productFilter.isInStock(masterProduct, 1);
        expect(inStock).toBe(true);
    });

    test('Master product with all out-of-stock variants is considered out of stock', () => {
        const outOfStockVariant1 = new VariantMock({ ats: 0 });
        const outOfStockVariant2 = new VariantMock({ ats: 0 });
        
        const masterProduct = new MasterProductMock({
            variants: [outOfStockVariant1, outOfStockVariant2]
        });
        
        const inStock = productFilter.isInStock(masterProduct, 1);
        expect(inStock).toBe(false);
    });

    test('Variation group with in-stock variant is considered in stock', () => {
        const inStockVariant = new VariantMock({ ats: 3 });
        
        const variationGroup = new MasterProductMock({
            variationGroup: true,
            variants: [inStockVariant]
        });
        
        const inStock = productFilter.isInStock(variationGroup, 1);
        expect(inStock).toBe(true);
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

describe('productFilter.isOnline', () => {
    var productFilter = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');

    beforeEach(() => {
        jest.resetModules();
    });

    test('Product is online', () => {
        const onlineProduct = new MasterProductMock({
            online: true
        });
        
        const result = productFilter.isOnline(onlineProduct);
        expect(result).toBe(true);
    });

    test('Product is offline', () => {
        const offlineProduct = new MasterProductMock({
            online: false
        });
        
        const result = productFilter.isOnline(offlineProduct);
        expect(result).toBe(false);
    });
});

describe('productFilter.isSearchable', () => {
    var productFilter = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');

    beforeEach(() => {
        jest.resetModules();
    });

    test('Product is searchable', () => {
        const searchableProduct = new MasterProductMock({
            searchable: true
        });
        
        const result = productFilter.isSearchable(searchableProduct);
        expect(result).toBe(true);
    });

    test('Product is not searchable', () => {
        const nonSearchableProduct = new MasterProductMock({
            searchable: false
        });
        
        const result = productFilter.isSearchable(nonSearchableProduct);
        expect(result).toBe(false);
    });
});

describe('productFilter.hasOnlineCategory', () => {
    var productFilter = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');

    beforeEach(() => {
        jest.resetModules();
    });

    test('Product has online categories', () => {
        const productWithCategories = new MasterProductMock();
        
        const result = productFilter.hasOnlineCategory(productWithCategories);
        expect(result).toBe(true);
    });

    test('Product has no categories', () => {
        const productWithoutCategories = new MasterProductMock();
        productWithoutCategories.getOnlineCategories = () => [];
        
        const result = productFilter.hasOnlineCategory(productWithoutCategories);
        expect(result).toBe(false);
    });

    test('Product returns null for categories', () => {
        const productWithNullCategories = new MasterProductMock();
        productWithNullCategories.getOnlineCategories = () => null;
        
        const result = productFilter.hasOnlineCategory(productWithNullCategories);
        expect(result).toBe(false);
    });

    test('Product returns undefined for categories', () => {
        const productWithUndefinedCategories = new MasterProductMock();
        productWithUndefinedCategories.getOnlineCategories = () => undefined;
        
        const result = productFilter.hasOnlineCategory(productWithUndefinedCategories);
        expect(result).toBe(false);
    });
});

describe('productFilter.isInclude', () => {
    var productFilter = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');

    beforeEach(() => {
        jest.resetModules();
    });

    test('Valid product passes all filters', () => {
        const validProduct = new VariantMock();
        
        const result = productFilter.isInclude(validProduct);
        expect(result).toBe(true);
    });

    test('Master product is excluded', () => {
        const masterProduct = new MasterProductMock();
        
        const result = productFilter.isInclude(masterProduct);
        expect(result).toBe(false);
    });

    test('Variation group product is excluded', () => {
        const variationGroupProduct = new MasterProductMock({
            variationGroup: true
        });
        
        const result = productFilter.isInclude(variationGroupProduct);
        expect(result).toBe(false);
    });

    test('Offline product is excluded', () => {
        const offlineProduct = new VariantMock({
            online: false
        });
        
        const result = productFilter.isInclude(offlineProduct);
        expect(result).toBe(false);
    });

    test('Non-searchable product is excluded', () => {
        const nonSearchableProduct = new VariantMock({
            searchable: false
        });
        
        const result = productFilter.isInclude(nonSearchableProduct);
        expect(result).toBe(false);
    });

    test('Product without online categories is excluded', () => {
        const masterWithoutCategories = new MasterProductMock();
        masterWithoutCategories.getOnlineCategories = () => [];
        
        const productWithoutCategories = new VariantMock({
            masterProduct: masterWithoutCategories
        });
        
        const result = productFilter.isInclude(productWithoutCategories);
        expect(result).toBe(false);
    });
});

describe('productFilter.isInStoreStock', () => {
    var productFilter = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');

    beforeEach(() => {
        jest.resetModules();
    });

    test('Product is in stock at store', () => {
        const product = new VariantMock({ ID: 'in-stock-product' });
        const inStock = productFilter.isInStoreStock(product, 'store-with-inventory', 2);
        expect(inStock).toBe(true);
    });

    test('Product is below threshold at store', () => {
        const product = new VariantMock({ ID: 'low-stock-product' });
        const inStock = productFilter.isInStoreStock(product, 'store-with-inventory', 2);
        expect(inStock).toBe(false);
    });

    test('Product is out of stock at store', () => {
        const product = new VariantMock({ ID: 'out-of-stock-product' });
        const inStock = productFilter.isInStoreStock(product, 'store-with-inventory', 2);
        expect(inStock).toBe(false);
    });

    test('Product not found in store inventory', () => {
        const product = new VariantMock({ ID: 'non-existent-product' });
        const inStock = productFilter.isInStoreStock(product, 'store-with-inventory', 2);
        expect(inStock).toBe(false);
    });

    test('Store does not exist', () => {
        const product = new VariantMock({ ID: 'in-stock-product' });
        const inStock = productFilter.isInStoreStock(product, 'non-existent-store', 2);
        expect(inStock).toBe(false);
    });

    test('Store has no inventory list', () => {
        const product = new VariantMock({ ID: 'in-stock-product' });
        const inStock = productFilter.isInStoreStock(product, 'store-without-inventory', 2);
        expect(inStock).toBe(false);
    });
});