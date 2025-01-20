const MasterProductMock = require("../../../../../mocks/dw/catalog/MasterProduct");
const VariantMock = require("../../../../../mocks/dw/catalog/Variant");
const collectionHelper = require("../../../../../mocks/helpers/collectionHelper");
const jobHelper = require("../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/jobHelper");

jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    return {
        getSetOfArray: function (id) {
            return id === 'AdditionalAttributes'
                ? ['url', 'UPC', 'searchable', 'variant', 'color', 'refinementColor', 'size', 'refinementSize', 'brand', 'online', 'pageDescription', 'pageKeywords',
                    'pageTitle', 'short_description', 'name', 'long_description', 'image_groups']
                : [];
        },
        getPreference: function (id) {
            switch (id) {
                case 'IndexOutofStock':
                    return true;
                case 'InStockThreshold':
                    return 1;
                default:
                    return [];
            }
        }
    }
}, {virtual: true});

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
