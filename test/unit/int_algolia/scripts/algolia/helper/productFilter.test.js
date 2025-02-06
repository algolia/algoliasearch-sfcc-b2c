'use strict';

var ProductMock = require('../../../../../mocks/dw/catalog/Variant');

describe('productFilter.isIncludeOutOfStock', () => {
    var productFilter = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');
    const AlgoliaLocalizedProductModel = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedProduct');

    beforeEach(() => {
        jest.resetModules();
    });

    test('skips out-of-stock if IndexOutOfStock = false', () => {
        jest.doMock('*/cartridge/scripts/algolia/lib/algoliaData', () => ({
            getSetOfArray: () => [],
        }), { virtual: true });


        const product = new ProductMock();
        const inStockVariant =  new AlgoliaLocalizedProductModel({ 
            product: product,
            locale: 'default',
            attributeList: ['custom.displaySize']
        });

        inStockVariant.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => {
                    return { getATS: () => { return { getValue: () => { return 5; } } } };
                },
            };
        }
        const inStock = productFilter.isInStock(inStockVariant, 1);

        expect(inStock).toBe(true);
    });

    test('includes out-of-stock if IndexOutOfStock = true', () => {
        jest.doMock('*/cartridge/scripts/algolia/lib/algoliaData', () => ({
            getSetOfArray: () => [],
        }), { virtual: true });

        productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');

        const product = new ProductMock();
        const outOfStockVariant =  new AlgoliaLocalizedProductModel({ 
            product: product,
            locale: 'default',
            attributeList: ['custom.displaySize']
        });
        outOfStockVariant.getAvailabilityModel = () => {
            return {
                getInventoryRecord: () => {
                    return { getATS: () => { return { getValue: () => { return 0; } } } };
                },
            };
        }
        const inStock = productFilter.isInStock(outOfStockVariant, 1);

        expect(inStock).toBe(false);
    });
});