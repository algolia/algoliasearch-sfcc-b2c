const GlobalMock = require('../../../../../mocks/global');
const CategoryMock = require('../../../../../mocks/dw/catalog/Category');

global.request = new GlobalMock.RequestMock();

jest.mock('dw/catalog/CatalogMgr', () => {}, {virtual: true});
jest.mock('dw/system/Site', () => {}, {virtual: true});

jest.mock('dw/web/URLUtils', () => {
    return {
        https: function(endpoint, param, id) {
            var relURL = '/on/demandware.store/Sites-Algolia_SFRA-Site/';
            return relURL + global.request.getLocale() + '/' + endpoint + '?' + param + '=' + id;
        },
    }
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/model/algoliaLocalizedCategory', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedCategory');
}, {virtual: true});

const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/job/sendCategories');

describe('getSubCategoriesModels', () => {
    // We define categories mocks that represent the following categories hierarchy:
    // Electronics
    // |__Digital Cameras
    // |__Audio
    //    |__Headphones
    const category = new CategoryMock({ name: 'Electronics' });
    const subcategory1 = new CategoryMock({ name: 'Digital Cameras', parent: category });
    const subcategory2 = new CategoryMock({ name: 'Audio', parent: category });
    const subsubcategory2 = new CategoryMock({ name: 'Headphones', parent: subcategory2 });
    subcategory2.subcategories = [subsubcategory2];
    // This category won't be exported as showInMenu is false
    const subcategory3 = new CategoryMock({ name: 'Video', parent: category, showInMenu: false });
    category.subcategories = [subcategory1, subcategory2, subcategory3];
    const catalogId = 'testCatalog';

    test('default locale', () => {
        var categoriesModels = job.getSubCategoriesModels(category, catalogId, 'default');
        expect(categoriesModels).toMatchSnapshot();
    });
    test('french locale', () => {
        var categoriesModels = job.getSubCategoriesModels(category, catalogId, 'fr');
        expect(categoriesModels).toMatchSnapshot();
    });
});
