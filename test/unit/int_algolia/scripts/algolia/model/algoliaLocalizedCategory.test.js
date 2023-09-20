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
    // We define categories mocks that represent the following categories hierarchy:
    // Electronics
    // |__Digital Cameras
    // |__Audio
    //    |__Headphones
    const catalogId = 'testCatalog';
    const category = new CategoryMock({ name: 'Electronics' });
    const subcategory1 = new CategoryMock({ name: 'Digital Cameras', parent: category });
    const subcategory2 = new CategoryMock({ name: 'Audio', parent: category });
    const subsubcategory2 = new CategoryMock({ name: 'Headphones', parent: subcategory2 });
    category.subcategories = [subcategory1, subcategory2];
    subcategory2.subcategories = [subsubcategory2];

    test('default locale', function () {
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
                "testCatalog/storefront-catalog-m-en/audio",
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
        expect(new AlgoliaLocalizedCategory(subcategory1, catalogId)).toEqual(expectedSubCategoryModel);

        const expectedSubCategory2Model = {
            objectID: 'testCatalog/storefront-catalog-m-en/audio',
            id: 'testCatalog/storefront-catalog-m-en/audio',
            name: 'Audio',
            description: 'Description of Audio',
            image: 'http://example.com/audio.jpg',
            thumbnail: 'http://example.com/audio-thumbnail.jpg',
            url: '/on/demandware.store/Sites-Algolia_SFRA-Site/default/Search-Show?cgid=storefront-catalog-m-en/audio',
            parent_category_id: 'testCatalog/storefront-catalog-m-en/electronics',
            subCategories: [
                "testCatalog/storefront-catalog-m-en/headphones",
            ],
            _tags: ['id:testCatalog/storefront-catalog-m-en/audio'],
        }
        expect(new AlgoliaLocalizedCategory(subcategory2, catalogId)).toEqual(expectedSubCategory2Model);
    });

    test('french locale', function () {
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
                "testCatalog/storefront-catalog-m-en/audio",
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
        expect(new AlgoliaLocalizedCategory(subcategory1, catalogId, 'fr')).toEqual(expectedSubCategoryModel);

        const expectedSubCategory2Model = {
            objectID: 'testCatalog/storefront-catalog-m-en/audio',
            id: 'testCatalog/storefront-catalog-m-en/audio',
            name: 'Nom français de Audio',
            description: 'Description française de Audio',
            image: 'http://example.com/audio.jpg',
            thumbnail: 'http://example.com/audio-thumbnail.jpg',
            url: '/on/demandware.store/Sites-Algolia_SFRA-Site/fr/Search-Show?cgid=storefront-catalog-m-en/audio',
            parent_category_id: 'testCatalog/storefront-catalog-m-en/electronics',
            subCategories: [
                "testCatalog/storefront-catalog-m-en/headphones",
            ],
            _tags: ['id:testCatalog/storefront-catalog-m-en/audio'],
        }
        expect(new AlgoliaLocalizedCategory(subcategory2, catalogId, 'fr')).toEqual(expectedSubCategory2Model);

        const expectedSubSubCategory2Model = {
            objectID: 'testCatalog/storefront-catalog-m-en/headphones',
            id: 'testCatalog/storefront-catalog-m-en/headphones',
            name: 'Nom français de Headphones',
            description: 'Description française de Headphones',
            image: 'http://example.com/headphones.jpg',
            thumbnail: 'http://example.com/headphones-thumbnail.jpg',
            url: '/on/demandware.store/Sites-Algolia_SFRA-Site/fr/Search-Show?cgid=storefront-catalog-m-en/headphones',
            parent_category_id: 'testCatalog/storefront-catalog-m-en/audio',
            _tags: ['id:testCatalog/storefront-catalog-m-en/headphones'],
        }
        expect(new AlgoliaLocalizedCategory(subsubcategory2, catalogId, 'fr')).toEqual(expectedSubSubCategory2Model);
    });
});
