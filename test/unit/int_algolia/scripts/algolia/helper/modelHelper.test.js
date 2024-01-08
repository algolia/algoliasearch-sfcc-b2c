const MasterProductMock = require('../../../../../mocks/dw/catalog/MasterProduct');

const modelHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/modelHelper');

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
