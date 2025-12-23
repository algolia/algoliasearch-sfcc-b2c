'use strict';

const orderHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/orderHelper');
const MasterVariantMock = require('../../../../../mocks/dw/catalog/MasterProduct');
const VariantMock = require('../../../../../mocks/dw/catalog/Variant');
const collectionHelper = require('../../../../../mocks/helpers/collectionHelper');


describe('Order Helper', function () {
    test('generateAlgoliaOperations should create operations for all locales', function () {
        // Arrange
        const masterProduct = new MasterVariantMock({
            variants: [
                new VariantMock({
                    ID: '701644031206M',
                    variationAttributes: { color: 'JJB52A0', size: '004' },
                    ats: 5,
                }),
            ]
        });

        const productConfig = {
            product: masterProduct,
            attributeList: ['variants', 'in_stock']
        };

        // Act
        const operations = orderHelper.generateAlgoliaOperations(productConfig);

        // Assert
        // Should have 3 operations (one for each locale)
        expect(operations.length).toBe(3);

        // Check the default locale operation
        expect(operations[0].action).toBe('partialUpdateObject');
        expect(operations[0].indexName).toBe('test_index___products__default');

        // Check the fr locale operation
        expect(operations[1].action).toBe('partialUpdateObject');
        expect(operations[1].indexName).toBe('test_index___products__fr');

        // Check the en locale operation
        expect(operations[2].action).toBe('partialUpdateObject');
        expect(operations[2].indexName).toBe('test_index___products__en');

        expect(operations).toMatchSnapshot();
    });

    test('generateAlgoliaOperations should handle stock status correctly', function () {
        // Arrange
        const masterProduct = new MasterVariantMock({
            variants: [
                new VariantMock({
                    ID: '701644031206M',
                    variationAttributes: { color: 'JJB52A0', size: '004' },
                    ats: 5,
                }),
            ]
        });

        const productConfig = {
            product: masterProduct,
            attributeList: ['in_stock']  // Only update the stock status
        };

        // Act
        const operations = orderHelper.generateAlgoliaOperations(productConfig);

        // Assert
        expect(operations[0].body.objectID).toBe('25592581M');
        expect(operations[0].body.in_stock).toBe(true);
        expect(operations[0].body.variants).toBeUndefined();
    });


    test('generateAlgoliaOperations should keep all product Config for master level', function () {
        // Arrange
        const masterProduct = new MasterVariantMock();

        const variantPinkSize4 = new VariantMock({
            ID: '701644031206M',
            variationAttributes: { color: 'JJB52A0', size: '004' },
            masterProduct,
        });
        const variantPinkSize6 = new VariantMock({
            ID: '701644031213M',
            variationAttributes: { color: 'JJB52A0', size: '006' },
            masterProduct,
        });
        masterProduct.variants = collectionHelper.createCollection([
            variantPinkSize4,
            variantPinkSize6,
        ]);

        const productConfig = {
            product: masterProduct,
            attributeList: ['variants'],
            variantAttributes: ['id', 'in_stock', 'storeAvailability'],
        };

        // Act
        const operations = orderHelper.generateAlgoliaOperations(productConfig);

        // Assert
        // Match snapshot
        expect(operations).toMatchSnapshot();
    });

    test('generateAlgoliaOperations should keep all product Config for variant level', function () {
        // Arrange
        const variantProduct = new VariantMock({
            ID: '701644031206M',
            variationAttributes: { color: 'JJB52A0', size: '004' },
        });

        const productConfig = {
            product: variantProduct,
            attributeList: ['in_stock', 'storeAvailability'],
        };

        // Act
        const operations = orderHelper.generateAlgoliaOperations(productConfig);

        // Assert
        // Match snapshot
        expect(operations).toMatchSnapshot();
    });
});
