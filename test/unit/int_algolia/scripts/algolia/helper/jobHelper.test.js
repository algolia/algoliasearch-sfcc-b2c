const MasterProductMock = require("../../../../../mocks/dw/catalog/MasterProduct");
const VariantMock = require("../../../../../mocks/dw/catalog/Variant");
const collectionHelper = require("../../../../../mocks/helpers/collectionHelper");
const jobHelper = require("../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/jobHelper");

test('generateVariantRecordsWithColorVariations', () => {
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

    const variantRecords = jobHelper.generateVariantRecordsWithColorVariations({
        masterProduct,
        locales: collectionHelper.createCollection(['fr']),
        attributeList: ['name', 'primary_category_id', 'categories', 'in_stock', 'price', 'url'],
        nonLocalizedAttributes: [],
    });
    expect(variantRecords).toMatchSnapshot();
});

test('generateMasterRecords', () => {
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

    const variantRecords = jobHelper.generateMasterRecords({
        product: masterProduct,
        locales: collectionHelper.createCollection(['en']),
        masterAttributes: ['name', 'primary_category_id', 'categories'],
        variantAttributes: ['in_stock', 'price', 'url'],
        nonLocalizedAttributes: [],
    });
    expect(variantRecords).toMatchSnapshot();
});
