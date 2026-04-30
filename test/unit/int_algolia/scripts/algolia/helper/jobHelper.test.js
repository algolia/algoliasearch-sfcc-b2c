const ArrayList = require('dw/util/ArrayList');
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
            locales: new ArrayList(['fr']),
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
        const additionalAttributes = ['size', 'test'];
        const result = jobHelper.getAttributes(additionalAttributes);

        // Check some variant attributes
        expect(result.variantAttributes).toContain('in_stock');
        expect(result.variantAttributes).toContain('price');
        expect(result.variantAttributes).toContain('test');
        expect(result.variantAttributes).toContain('size');

        // Check some master attributes
        expect(result.masterAttributes).toContain('variants');
        expect(result.masterAttributes).toContain('defaultVariantID');

        // Check some non-localized attributes
        expect(result.nonLocalizedAttributes).toContain('in_stock');
        expect(result.nonLocalizedAttributes).toContain('price');

        // Check non-localized master attributes
        expect(result.nonLocalizedMasterAttributes).toContain('categoryPageId');
    });

    describe('toTmp', () => {
        it('appends the tmp suffix to a primary index name', () => {
            expect(jobHelper.toTmp('products_en')).toBe('products_en.tmp');
        });

        it('is idempotent with fromTmp (round-trips)', () => {
            const primary = 'test_index___products__en_US';
            expect(jobHelper.fromTmp(jobHelper.toTmp(primary))).toBe(primary);
        });

        it('appends the suffix even if the input already ends in .tmp (by design)', () => {
            // Callers are responsible for not double-tagging; this documents current behavior.
            expect(jobHelper.toTmp('products_en.tmp')).toBe('products_en.tmp.tmp');
        });
    });

    describe('fromTmp', () => {
        it('strips the tmp suffix from a valid tmp index name', () => {
            expect(jobHelper.fromTmp('products_en.tmp')).toBe('products_en');
        });

        it('throws when the input does not end in .tmp', () => {
            expect(() => jobHelper.fromTmp('products_en'))
                .toThrow(/temporary index name ending in/i);
        });

        it('throws when the input is exactly ".tmp" (would yield empty primary)', () => {
            expect(() => jobHelper.fromTmp('.tmp'))
                .toThrow(/temporary index name ending in/i);
        });

        it('throws when the input is an empty string', () => {
            expect(() => jobHelper.fromTmp(''))
                .toThrow(/temporary index name ending in/i);
        });

        it('throws when the input is not a string', () => {
            expect(() => jobHelper.fromTmp(undefined))
                .toThrow(/temporary index name ending in/i);
            expect(() => jobHelper.fromTmp(null))
                .toThrow(/temporary index name ending in/i);
            expect(() => jobHelper.fromTmp(42))
                .toThrow(/temporary index name ending in/i);
        });

        it('only strips the final suffix, not intermediate occurrences', () => {
            expect(jobHelper.fromTmp('name.tmp.tmp')).toBe('name.tmp');
        });
    });
});
