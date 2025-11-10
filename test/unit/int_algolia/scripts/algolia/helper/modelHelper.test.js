const MasterProductMock = require('../../../../../mocks/dw/catalog/MasterProduct');

const modelHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/modelHelper');
const VariantMock = require('../../../../../mocks/dw/catalog/Variant');

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
