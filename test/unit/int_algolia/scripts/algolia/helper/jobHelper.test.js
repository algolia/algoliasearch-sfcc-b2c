const MasterProductMock = require("../../../../../mocks/dw/catalog/MasterProduct");
const VariantMock = require("../../../../../mocks/dw/catalog/Variant");
const collectionHelper = require("../../../../../mocks/helpers/collectionHelper");
const jobHelper = require("../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/jobHelper");

jest.mock('*/cartridge/scripts/algolia/lib/algoliaProductConfig', () => {
    const algoliaProductConfig = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaProductConfig');
    return {
        attributeConfig_v2: algoliaProductConfig.attributeConfig_v2,
        extendedProductAttributesConfig: algoliaProductConfig.extendedProductAttributesConfig,
        defaultAttributes_v2: algoliaProductConfig.defaultAttributes_v2,
        defaultVariantAttributes_v2: algoliaProductConfig.defaultVariantAttributes_v2,
        defaultMasterAttributes_v2: algoliaProductConfig.defaultMasterAttributes_v2
    }
}, { virtual: true });


describe('Job Helper', function () {
    test('generateVariantRecords', () => {
        // master product with two size variations on the same color variation
        const masterProduct = new MasterProductMock();
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
    
        const variantRecords = jobHelper.generateVariantRecords({
            masterProduct,
            locales: collectionHelper.createCollection(['fr']),
            attributeList: ['name', 'categoryPageId', '__primary_category', 'in_stock', 'price', 'url', 'colorVariations'],
            nonLocalizedAttributes: [],
        });
        expect(variantRecords).toMatchSnapshot();
    });

    test('Test getDefaultAttributeConfig', function () {
        expect(jobHelper.getDefaultAttributeConfig('dummy')).toEqual({
            attribute: 'dummy',
            localized: false,
            variantAttribute: true
        });
    });

    test('Test getAttributes', function () {
        const additionalAttributes = [];
        const result = jobHelper.getAttributes(additionalAttributes);

        // Check some variant attributes
        expect(result.variantAttributes).toContain('in_stock');
        expect(result.variantAttributes).toContain('price');

        // Check some master attributes
        expect(result.masterAttributes).toContain('variants');
        expect(result.masterAttributes).toContain('defaultVariantID');

        // Check some non-localized attributes
        expect(result.nonLocalizedAttributes).toContain('in_stock');
        expect(result.nonLocalizedAttributes).toContain('price');

        // Check non-localized master attributes
        expect(result.nonLocalizedMasterAttributes).toContain('categoryPageId');
    });
});
