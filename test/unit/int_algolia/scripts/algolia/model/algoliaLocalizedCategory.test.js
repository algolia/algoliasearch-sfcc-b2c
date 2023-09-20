var GlobalMock = require('../../../../../mocks/global');
var CategoryMock = require('../../../../../mocks/dw/catalog/Category');

global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

jest.mock('dw/web/URLUtils', () => {
    return {
        https: function(endpoint, param, id) {
            var relURL = '/on/demandware.store/Sites-Algolia_SFRA-Site/';
            return relURL + global.request.getLocale() + '/' + endpoint + '?' + param + '=' + id;
        }
    }
}, {virtual: true});

const AlgoliaLocalizedCategory = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedCategory');

describe('algoliaLocalizedCategory', function () {
    test('default locale', function () {
        const catalogId = 'testCatalog';
        const category = new CategoryMock({ name: 'Electronics' });
        const subcategory = new CategoryMock({ name: 'Digital Cameras', parent: category });
        const subcategory2 = new CategoryMock({ name: 'Gaming', parent: category });
        category.subcategories = [subcategory, subcategory2];

        const expectedParentCategoryModel = {
            objectID: 'testCatalog/storefront-catalog-m-en/electronics',
            id: 'testCatalog/storefront-catalog-m-en/electronics',
            name: 'Electronics',
            description: 'Description of Electronics',
            image: 'http://example.com/electronics.jpg',
            thumbnail: 'http://example.com/electronics-thumbnail.jpg',
            url: '/on/demandware.store/Sites-Algolia_SFRA-Site/default/Search-Show?cgid=storefront-catalog-m-en/electronics',
            subCategories: [
                "testCatalog/storefront-catalog-m-en/digital-cameras",
                "testCatalog/storefront-catalog-m-en/gaming",
            ],
            _tags: ['id:testCatalog/storefront-catalog-m-en/electronics'],
        }
        expect(new AlgoliaLocalizedCategory(category, catalogId)).toEqual(expectedParentCategoryModel);

        const expectedSubCategoryModel = {
            objectID: 'testCatalog/storefront-catalog-m-en/digital-cameras',
            id: 'testCatalog/storefront-catalog-m-en/digital-cameras',
            name: 'Digital Cameras',
            description: 'Description of Digital Cameras',
            image: 'http://example.com/digital-cameras.jpg',
            thumbnail: 'http://example.com/digital-cameras-thumbnail.jpg',
            url: '/on/demandware.store/Sites-Algolia_SFRA-Site/default/Search-Show?cgid=storefront-catalog-m-en/digital-cameras',
            parent_category_id: 'testCatalog/storefront-catalog-m-en/electronics',
            _tags: ['id:testCatalog/storefront-catalog-m-en/digital-cameras'],
        }
        expect(new AlgoliaLocalizedCategory(subcategory, catalogId)).toEqual(expectedSubCategoryModel);

        const expectedSubCategory2Model = {
            objectID: 'testCatalog/storefront-catalog-m-en/gaming',
            id: 'testCatalog/storefront-catalog-m-en/gaming',
            name: 'Gaming',
            description: 'Description of Gaming',
            image: 'http://example.com/gaming.jpg',
            thumbnail: 'http://example.com/gaming-thumbnail.jpg',
            url: '/on/demandware.store/Sites-Algolia_SFRA-Site/default/Search-Show?cgid=storefront-catalog-m-en/gaming',
            parent_category_id: 'testCatalog/storefront-catalog-m-en/electronics',
            _tags: ['id:testCatalog/storefront-catalog-m-en/gaming'],
        }
        expect(new AlgoliaLocalizedCategory(subcategory2, catalogId)).toEqual(expectedSubCategory2Model);
    });

    test('french locale', function () {
        const catalogId = 'testCatalog';
        const category = new CategoryMock({ name: 'Electronics' });
        const subcategory = new CategoryMock({ name: 'Digital Cameras', parent: category });
        const subcategory2 = new CategoryMock({ name: 'Gaming', parent: category });
        category.subcategories = [subcategory, subcategory2];

        const expectedParentCategoryModel = {
            objectID: 'testCatalog/storefront-catalog-m-en/electronics',
            id: 'testCatalog/storefront-catalog-m-en/electronics',
            name: 'Nom français de Electronics',
            description: 'Description française de Electronics',
            image: 'http://example.com/electronics.jpg',
            thumbnail: 'http://example.com/electronics-thumbnail.jpg',
            url: '/on/demandware.store/Sites-Algolia_SFRA-Site/fr/Search-Show?cgid=storefront-catalog-m-en/electronics',
            subCategories: [
                "testCatalog/storefront-catalog-m-en/digital-cameras",
                "testCatalog/storefront-catalog-m-en/gaming",
            ],
            _tags: ['id:testCatalog/storefront-catalog-m-en/electronics'],
        }
        expect(new AlgoliaLocalizedCategory(category, catalogId, 'fr')).toEqual(expectedParentCategoryModel);

        const expectedSubCategoryModel = {
            objectID: 'testCatalog/storefront-catalog-m-en/digital-cameras',
            id: 'testCatalog/storefront-catalog-m-en/digital-cameras',
            name: 'Nom français de Digital Cameras',
            description: 'Description française de Digital Cameras',
            image: 'http://example.com/digital-cameras.jpg',
            thumbnail: 'http://example.com/digital-cameras-thumbnail.jpg',
            url: '/on/demandware.store/Sites-Algolia_SFRA-Site/fr/Search-Show?cgid=storefront-catalog-m-en/digital-cameras',
            parent_category_id: 'testCatalog/storefront-catalog-m-en/electronics',
            _tags: ['id:testCatalog/storefront-catalog-m-en/digital-cameras'],
        }
        expect(new AlgoliaLocalizedCategory(subcategory, catalogId, 'fr')).toEqual(expectedSubCategoryModel);

        const expectedSubCategory2Model = {
            objectID: 'testCatalog/storefront-catalog-m-en/gaming',
            id: 'testCatalog/storefront-catalog-m-en/gaming',
            name: 'Nom français de Gaming',
            description: 'Description française de Gaming',
            image: 'http://example.com/gaming.jpg',
            thumbnail: 'http://example.com/gaming-thumbnail.jpg',
            url: '/on/demandware.store/Sites-Algolia_SFRA-Site/fr/Search-Show?cgid=storefront-catalog-m-en/gaming',
            parent_category_id: 'testCatalog/storefront-catalog-m-en/electronics',
            _tags: ['id:testCatalog/storefront-catalog-m-en/gaming'],
        }
        expect(new AlgoliaLocalizedCategory(subcategory2, catalogId, 'fr')).toEqual(expectedSubCategory2Model);
    });
});
