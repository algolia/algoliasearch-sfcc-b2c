const Collection = require('../../../../../mocks/dw/util/Collection')

const GlobalMock = require('../../../../../mocks/global');
const CategoryMock = require('../../../../../mocks/dw/catalog/Category');

global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

// We define some categories mocks that represent the following categories hierarchy:
// Electronics
// |__Digital Cameras
// |__Audio
//    |__Headphones
const category = new CategoryMock({ name: 'Electronics' });
const subcategory1 = new CategoryMock({ name: 'Digital Cameras', parent: category });
const subcategory2 = new CategoryMock({ name: 'Audio', parent: category });
const subsubcategory2 = new CategoryMock({ name: 'Headphones', parent: subcategory2 });
subcategory2.subcategories = [subsubcategory2];
// This category won't be exported because showInMenu is false
const subcategory3 = new CategoryMock({ name: 'Video', parent: category, showInMenu: false });
category.subcategories = [subcategory1, subcategory2, subcategory3];
const catalogId = 'testCatalog';
const mockOnlineSubCategories = new Collection([category]);

jest.mock('dw/catalog/CatalogMgr', () => {
    return {
        getSiteCatalog: function() {
            return {
                getID: function() {
                    return catalogId;
                },
                getRoot: function() {
                    return {
                        hasOnlineSubCategories: () => true,
                        getOnlineSubCategories: () => {
                            return mockOnlineSubCategories;
                        }
                    }
                }
            }
        }
    }
}, {virtual: true});

jest.mock('*/cartridge/scripts/algolia/model/algoliaLocalizedCategory', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedCategory');
}, {virtual: true});

const mockSendMultiIndicesBatch = jest.fn().mockReturnValue({ ok: true });
jest.mock('*/cartridge/scripts/algoliaIndexingAPI', () => {
    return {
        sendMultiIndicesBatch: mockSendMultiIndicesBatch,
    }
}, {virtual: true});

const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/job/sendCategories');

describe('getSubCategoriesModels', () => {
    test('default locale', () => {
        var categoriesModels = job.getSubCategoriesModels(category, catalogId, 'default');
        expect(categoriesModels).toMatchSnapshot();
    });
    test('french locale', () => {
        var categoriesModels = job.getSubCategoriesModels(category, catalogId, 'fr');
        expect(categoriesModels).toMatchSnapshot();
    });
});

test('runCategoryExport', () => {
    job.execute();
    expect(mockSendMultiIndicesBatch).toMatchSnapshot();
});