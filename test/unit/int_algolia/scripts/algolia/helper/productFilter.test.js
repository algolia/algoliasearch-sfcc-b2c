'use strict';

var VariantMock = require('../../../../../mocks/dw/catalog/Variant');
var MasterProductMock = require('../../../../../mocks/dw/catalog/MasterProduct');

// To override the MasterProductMock for testing purposes
function ProductMock(props = {}) {
    const product = new MasterProductMock({ ID: props.ID || '008884303989M' });
    product.master = false;
    product.variant = false;
    
    // Override methods if provided in props
    if (props.getOnlineCategories) product.getOnlineCategories = props.getOnlineCategories;
    if (props.getAvailabilityModel) product.getAvailabilityModel = props.getAvailabilityModel;
    if (props.getMasterProduct) product.getMasterProduct = props.getMasterProduct;
    if (props.getVariants) product.getVariants = props.getVariants;
    
    // Apply property overrides
    Object.assign(product, props);
    
    return product;
}

describe('productFilter.isInStock', () => {
    var productFilter = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');

    beforeEach(() => {
        jest.resetModules();
    });

    test('Check if product is in stock', () => {
        const inStockProduct = new VariantMock();

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

    test('Master product with in-stock variant is considered in stock', () => {
        const masterProduct = new VariantMock();
        masterProduct.master = true;
        masterProduct.variationGroup = false;
        
        const inStockVariant = new VariantMock();
        inStockVariant.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => {
                    return { getATS: () => { return { getValue: () => { return 5; } } } };
                }
            };
        };
        
        const outOfStockVariant = new VariantMock();
        outOfStockVariant.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => {
                    return { getATS: () => { return { getValue: () => { return 0; } } } };
                }
            };
        };
        
        masterProduct.variants = {
            iterator: () => {
                let index = 0;
                const variants = [outOfStockVariant, inStockVariant];
                return {
                    hasNext: () => index < variants.length,
                    next: () => variants[index++]
                };
            }
        };
        
        // Reflecting a real-world scenario where master products do not have their own inventory record
        masterProduct.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => null
            };
        };
        
        const inStock = productFilter.isInStock(masterProduct, 1);
        expect(inStock).toBe(true);
    });

    test('Master product with all out-of-stock variants is considered out of stock', () => {
        const masterProduct = new VariantMock();
        masterProduct.master = true;
        masterProduct.variationGroup = false;
        
        const outOfStockVariant1 = new VariantMock();
        outOfStockVariant1.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => {
                    return { getATS: () => { return { getValue: () => { return 0; } } } };
                }
            };
        };
        
        const outOfStockVariant2 = new VariantMock();
        outOfStockVariant2.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => {
                    return { getATS: () => { return { getValue: () => { return 0; } } } };
                }
            };
        };
        
        masterProduct.variants = {
            iterator: () => {
                let index = 0;
                const variants = [outOfStockVariant1, outOfStockVariant2];
                return {
                    hasNext: () => index < variants.length,
                    next: () => variants[index++]
                };
            }
        };
        
        masterProduct.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => null
            };
        };
        
        const inStock = productFilter.isInStock(masterProduct, 1);
        expect(inStock).toBe(false);
    });

    test('Variation group with in-stock variant is considered in stock', () => {
        const variationGroup = new VariantMock();
        variationGroup.master = false;
        variationGroup.variationGroup = true;
        
        const inStockVariant = new VariantMock();
        inStockVariant.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => {
                    return { getATS: () => { return { getValue: () => { return 3; } } } };
                }
            };
        };
        
        variationGroup.variants = {
            iterator: () => {
                let index = 0;
                const variants = [inStockVariant];
                return {
                    hasNext: () => index < variants.length,
                    next: () => variants[index++]
                };
            }
        };
        
        variationGroup.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => null
            };
        };
        
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
        const onlineProduct = new ProductMock({
            online: true
        });
        
        const result = productFilter.isOnline(onlineProduct);
        expect(result).toBe(true);
    });

    test('Product is offline', () => {
        const offlineProduct = new ProductMock({
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
        const searchableProduct = new ProductMock({
            searchable: true
        });
        
        const result = productFilter.isSearchable(searchableProduct);
        expect(result).toBe(true);
    });

    test('Product is not searchable', () => {
        const nonSearchableProduct = new ProductMock({
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
        const productWithCategories = new ProductMock({
            getOnlineCategories: () => [
                { ID: 'category1', online: true },
                { ID: 'category2', online: true }
            ]
        });
        
        const result = productFilter.hasOnlineCategory(productWithCategories);
        expect(result).toBe(true);
    });

    test('Product has no categories', () => {
        const productWithoutCategories = new ProductMock({
            getOnlineCategories: () => []
        });
        
        const result = productFilter.hasOnlineCategory(productWithoutCategories);
        expect(result).toBe(false);
    });

    test('Product returns null for categories', () => {
        const productWithNullCategories = new ProductMock({
            getOnlineCategories: () => null
        });
        
        const result = productFilter.hasOnlineCategory(productWithNullCategories);
        expect(result).toBe(false);
    });

    test('Product returns undefined for categories', () => {
        const productWithUndefinedCategories = new ProductMock({
            getOnlineCategories: () => undefined
        });
        
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
        const validProduct = new ProductMock({
            getOnlineCategories: () => [{ ID: 'category1', online: true }]
        });
        
        const result = productFilter.isInclude(validProduct);
        expect(result).toBe(true);
    });

    test('Master product is excluded', () => {
        const masterProduct = new ProductMock({
            master: true,
            getOnlineCategories: () => [{ ID: 'category1', online: true }]
        });
        
        const result = productFilter.isInclude(masterProduct);
        expect(result).toBe(false);
    });

    test('Variation group product is excluded', () => {
        const variationGroupProduct = new ProductMock({
            variationGroup: true,
            getOnlineCategories: () => [{ ID: 'category1', online: true }]
        });
        
        const result = productFilter.isInclude(variationGroupProduct);
        expect(result).toBe(false);
    });

    test('Offline product is excluded', () => {
        const offlineProduct = new ProductMock({
            online: false,
            getOnlineCategories: () => [{ ID: 'category1', online: true }]
        });
        
        const result = productFilter.isInclude(offlineProduct);
        expect(result).toBe(false);
    });

    test('Non-searchable product is excluded', () => {
        const nonSearchableProduct = new ProductMock({
            searchable: false,
            getOnlineCategories: () => [{ ID: 'category1', online: true }]
        });
        
        const result = productFilter.isInclude(nonSearchableProduct);
        expect(result).toBe(false);
    });

    test('Product without online categories is excluded', () => {
        const productWithoutCategories = new ProductMock({
            getOnlineCategories: () => []
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