const MasterProductMock = require('../../../../../mocks/dw/catalog/MasterProduct');

const modelHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/modelHelper');
const VariantMock = require("../../../../../mocks/dw/catalog/Variant");
const collectionHelper = require("../../../../../mocks/helpers/collectionHelper");

describe('getColorVariations', () => {
    test('en locale', () => {
        const masterProduct = new MasterProductMock();
        const colorVariations = modelHelper.getColorVariations(masterProduct, 'en');
        expect(colorVariations).toMatchSnapshot();
    });
    test('fr locale', () => {
        const masterProduct = new MasterProductMock();
        const colorVariations = modelHelper.getColorVariations(masterProduct, 'fr');
        expect(colorVariations).toMatchSnapshot();
    });
});

test('generateVariantRecordsWithColorVariations', () => {
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

    const variantRecords = modelHelper.generateVariantRecordsWithColorVariations({
        masterProduct,
        locales: collectionHelper.createCollection(['fr']),
        attributeList: ['name', 'primary_category_id', 'categories', 'in_stock', 'price', 'url'],
        nonLocalizedAttributeList: [],
    });
    expect(variantRecords).toMatchSnapshot();
});
