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

let mockLocalesForIndexing;
jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaData');
    return {
        ...originalModule,
        getSetOfArray: function (id) {
            switch (id) {
                case 'LocalesForIndexing':
                    return mockLocalesForIndexing;
                default:
                    return [];
            }
        },
    }
}, {virtual: true});

jest.mock('*/cartridge/scripts/algolia/model/algoliaLocalizedCategory', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedCategory');
}, {virtual: true});

const mockSetJobInfo = jest.fn();
const mockSendMultiIndexBatch = jest.fn().mockReturnValue({
    ok: true,
    object: {
        body: {
            taskID: {
                test_index_fr: 33,
                test_index_en: 42,
            }
        }
    }
});
jest.mock('*/cartridge/scripts/algoliaIndexingAPI', () => {
    return {
        setJobInfo: mockSetJobInfo,
        sendMultiIndexBatch: mockSendMultiIndexBatch,
    }
}, {virtual: true});

const mockCopySettingsFromProdIndices = jest.fn();
const mockDeleteTemporaryIndices = jest.fn();
const mockFinishAtomicReindex = jest.fn();
jest.mock('*/cartridge/scripts/algolia/helper/reindexHelper', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/reindexHelper');
    return {
        sendRetryableBatch: originalModule.sendRetryableBatch,
        deleteTemporaryIndices: mockDeleteTemporaryIndices,
        copySettingsFromProdIndices: mockCopySettingsFromProdIndices,
        finishAtomicReindex: mockFinishAtomicReindex,
        waitForTasks: jest.fn(),
    };
}, {virtual: true});

const stepExecution = {
    getJobExecution: () => {
        return {
            getJobID: () => 'TestJobID',
        }
    },
    getStepID: () => 'TestStepID',
}

const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/steps/algoliaCategoryIndex');

beforeEach(() => {
    mockLocalesForIndexing = [];
});

describe('getSubCategoryModels', () => {
    test('default locale', () => {
        var categoriesModels = job.getSubCategoryModels(category, catalogId, 'default');
        expect(categoriesModels).toMatchSnapshot();
    });
    test('french locale', () => {
        var categoriesModels = job.getSubCategoryModels(category, catalogId, 'fr');
        expect(categoriesModels).toMatchSnapshot();
    });
});

describe('runCategoryExport', () => {
    test('default', () => {
        job.runCategoryExport({}, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID' });
        expect(mockDeleteTemporaryIndices).toHaveBeenCalledWith(
            'categories',
            ['default', 'fr', 'en']
        );
        expect(mockCopySettingsFromProdIndices).toHaveBeenCalledWith(
            'categories',
            ['default', 'fr', 'en']
        );
        expect(mockSendMultiIndexBatch).toMatchSnapshot();
        expect(mockFinishAtomicReindex).toHaveBeenCalledWith(
            'categories',
            ['default', 'fr', 'en'],
            { "test_index_fr": 33, "test_index_en": 42 }
        );
    });

    test('with LocalesForIndexing=["fr"]', () => {
        mockLocalesForIndexing = ['fr'];
        job.runCategoryExport({}, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID' });
        expect(mockDeleteTemporaryIndices).toHaveBeenCalledWith('categories', ['fr']);
        expect(mockCopySettingsFromProdIndices).toHaveBeenCalledWith('categories', ['fr']);
        expect(mockSendMultiIndexBatch).toMatchSnapshot();
    });

    test('with localesForIndexing at step level', () => {
        job.runCategoryExport({ localesForIndexing: 'en' }, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID' });
        expect(mockDeleteTemporaryIndices).toHaveBeenCalledWith('categories', ['en']);
        expect(mockCopySettingsFromProdIndices).toHaveBeenCalledWith('categories', ['en']);
    });
});
