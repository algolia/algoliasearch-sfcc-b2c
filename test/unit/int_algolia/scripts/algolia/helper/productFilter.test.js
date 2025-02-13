'use strict';

var ProductMock = require('../../../../../mocks/dw/catalog/Variant');

describe('productFilter.isInStock', () => {
    var productFilter = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');
    const AlgoliaLocalizedProductModel = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedProduct');

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