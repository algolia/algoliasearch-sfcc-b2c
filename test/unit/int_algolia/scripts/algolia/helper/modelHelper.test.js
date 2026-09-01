jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => ({
    getPreference: jest.fn(),
}), { virtual: true });

const MasterProductMock = require('../../../../../mocks/dw/catalog/MasterProduct');
const VariantMock = require('../../../../../mocks/dw/catalog/Variant');
const ProductVariationAttributeValueMock = require('../../../../../mocks/dw/catalog/ProductVariationAttributeValue');
const modelHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/modelHelper');
const algoliaDataMock = require('*/cartridge/scripts/algolia/lib/algoliaData');

describe('getColorVariations', () => {
    const masterProduct = new MasterProductMock({
        variants: [
            new VariantMock({
                ID: '701644031206M',
                variationAttributes: { color: 'JJB52A0', size: '004' },
            }),
        ]
    });
    test('en locale', () => {
        const colorVariations = modelHelper.getColorVariations(masterProduct, 'en');
        expect(colorVariations).toMatchSnapshot();
    });
    test('fr locale', () => {
        const colorVariations = modelHelper.getColorVariations(masterProduct, 'fr');
        expect(colorVariations).toMatchSnapshot();
    });
});

describe('getAttributeSlicedModelRecordID', () => {
    beforeEach(() => {
        algoliaDataMock.getPreference.mockReset();
        if (!ProductVariationAttributeValueMock.prototype.getID) {
            ProductVariationAttributeValueMock.prototype.getID = function getID() {
                return this.ID;
            };
        }
    });

    test('returns null when preference is empty', () => {
        algoliaDataMock.getPreference.mockReturnValue('');
        const masterProduct = new MasterProductMock({ ID: 'MASTER1' });
        expect(modelHelper.getAttributeSlicedModelRecordID(masterProduct)).toBeNull();
    });

    test('returns master ID for master product', () => {
        algoliaDataMock.getPreference.mockReturnValue('color');
        const masterProduct = new MasterProductMock({ ID: 'MASTER1' });
        expect(modelHelper.getAttributeSlicedModelRecordID(masterProduct)).toBe('MASTER1');
    });

    test('returns attribute-sliced ID for variant with selected attribute', () => {
        algoliaDataMock.getPreference.mockReturnValue('color');
        const masterProduct = new MasterProductMock({ ID: 'MASTER1' });
        const variantProduct = new VariantMock({
            ID: 'VAR1',
            masterProduct,
            variationAttributes: { color: 'JJB52A0', size: '004' },
        });
        expect(modelHelper.getAttributeSlicedModelRecordID(variantProduct)).toBe('MASTER1-JJB52A0');
    });

    test('returns master ID for variant when attribute value is missing', () => {
        algoliaDataMock.getPreference.mockReturnValue('color');
        const masterProduct = new MasterProductMock({ ID: 'MASTER1' });
        const variantProduct = new VariantMock({
            ID: 'VAR1',
            masterProduct,
            variationAttributes: { size: '004' },
        });
        expect(modelHelper.getAttributeSlicedModelRecordID(variantProduct)).toBe('MASTER1');
    });

    test('returns product ID for simple product', () => {
        algoliaDataMock.getPreference.mockReturnValue('color');
        const simpleProduct = {
            isMaster: () => false,
            isVariant: () => false,
            getID: () => 'SIMPLE1',
        };
        expect(modelHelper.getAttributeSlicedModelRecordID(simpleProduct)).toBe('SIMPLE1');
    });
});

describe('getRecordIDForProduct', () => {
    const simpleProduct = {
        isMaster: () => false,
        isVariant: () => false,
        isVariationGroup: () => false,
        getID: () => 'SIMPLE1',
    };

    const variationGroupProduct = {
        isMaster: () => false,
        isVariant: () => false,
        isVariationGroup: () => true,
        getMasterProduct: () => ({ getID: () => 'MASTER1' }),
        getID: () => 'VG1',
    };

    let variantProduct;

    beforeEach(() => {
        algoliaDataMock.getPreference.mockReset();
        if (!ProductVariationAttributeValueMock.prototype.getID) {
            ProductVariationAttributeValueMock.prototype.getID = function getID() {
                return this.ID;
            };
        }
        variantProduct = new VariantMock({
            ID: 'VAR1',
            masterProduct: new MasterProductMock({ ID: 'MASTER1' }),
            variationAttributes: { color: 'JJB52A0', size: '004' },
        });
    });

    test('attribute-sliced: a variant is reported as its variation group', () => {
        algoliaDataMock.getPreference.mockReturnValue('color');
        expect(modelHelper.getRecordIDForProduct(variantProduct, 'attribute-sliced')).toBe('MASTER1-JJB52A0');
    });

    test('attribute-sliced: a product without variants keeps its own ID', () => {
        algoliaDataMock.getPreference.mockReturnValue('color');
        expect(modelHelper.getRecordIDForProduct(simpleProduct, 'attribute-sliced')).toBe('SIMPLE1');
    });

    test('attribute-sliced: null without a grouping attribute, since no record ID can be built', () => {
        algoliaDataMock.getPreference.mockReturnValue('');
        expect(modelHelper.getRecordIDForProduct(variantProduct, 'attribute-sliced')).toBeNull();
    });

    test('master-level: a variant is reported as its master', () => {
        expect(modelHelper.getRecordIDForProduct(variantProduct, 'master-level')).toBe('MASTER1');
    });

    test('master-level: a product without a master keeps its own ID', () => {
        expect(modelHelper.getRecordIDForProduct(simpleProduct, 'master-level')).toBe('SIMPLE1');
    });

    test('master-level: a variation group is reported as its master, since it is not indexed', () => {
        expect(modelHelper.getRecordIDForProduct(variationGroupProduct, 'master-level')).toBe('MASTER1');
    });

    test('variant-level: the product keeps its own ID', () => {
        expect(modelHelper.getRecordIDForProduct(variantProduct, 'variant-level')).toBe('VAR1');
    });

    test('an unrecognized record model falls back to the product ID', () => {
        expect(modelHelper.getRecordIDForProduct(variantProduct, 'something-else')).toBe('VAR1');
    });

    test('returns null for a missing product', () => {
        expect(modelHelper.getRecordIDForProduct(null, 'variant-level')).toBeNull();
    });
});
