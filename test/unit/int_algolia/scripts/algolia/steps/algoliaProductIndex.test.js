const GlobalMock = require('../../../../../mocks/global');
const ProductMock = require('../../../../../mocks/dw/catalog/Product');

global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

jest.mock('*/cartridge/scripts/algolia/helper/logHelper', () => {}, {virtual: true});

const mockDeleteTemporaryIndices = jest.fn();
const mockCopySettingsFromProdIndices = jest.fn();
const mockMoveTemporaryIndices = jest.fn();
const mockFinishAtomicReindex = jest.fn();
jest.mock('*/cartridge/scripts/algolia/helper/reindexHelper', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/reindexHelper');
    return {
        sendRetryableBatch: originalModule.sendRetryableBatch,
        deleteTemporaryIndices: mockDeleteTemporaryIndices,
        copySettingsFromProdIndices: mockCopySettingsFromProdIndices,
        moveTemporaryIndices: mockMoveTemporaryIndices,
        finishAtomicReindex: mockFinishAtomicReindex,
        waitForTasks: jest.fn(),
    };
}, {virtual: true});

jest.mock('*/cartridge/scripts/services/algoliaIndexingService', () => {}, {virtual: true});

const mockSetJobInfo = jest.fn();
const mockSendMultiIndexBatch = jest.fn().mockReturnValue({
    ok: true,
    object: {
        body: {
            taskID: {
                test_index_fr: 42,
                test_index_en: 51,
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

let mockCustomFields;
jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaData');
    return {
        ...originalModule,
        getSetOfArray: function (id) {
            return id === 'CustomFields'
                ? mockCustomFields
                : null;
        },
    }
}, {virtual: true});

const stepExecution = {
    getJobExecution: () => {
        return {
            getJobID: () => 'TestJobID',
        }
    },
    getStepID: () => 'TestStepID',
};

const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/steps/algoliaProductIndex');

beforeEach(() => {
    mockCustomFields = ['url', 'UPC', 'searchable', 'variant', 'color', 'refinementColor', 'size', 'refinementSize', 'brand', 'online', 'pageDescription', 'pageKeywords',
        'pageTitle', 'short_description', 'name', 'long_description', 'image_groups']
});

describe('beforeStep', () => {
    test('defaultAttributes', () => {
        mockCustomFields = [];
        job.beforeStep({}, stepExecution);
        expect(job.__getFieldsToSend()).toStrictEqual(['name', 'primary_category_id',
            'categories', 'in_stock', 'price', 'image_groups', 'url']);
    });
    test('no duplicated attributes', () => {
        mockCustomFields = ['name'];
        job.beforeStep({}, stepExecution);
        expect(job.__getFieldsToSend()).toStrictEqual(['name', 'primary_category_id',
            'categories', 'in_stock', 'price', 'image_groups', 'url']);
    });
});

describe('process', () => {
    test('default', () => {
        job.beforeStep({}, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID' });
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();

        var algoliaOperations = job.process(new ProductMock());
        expect(algoliaOperations).toMatchSnapshot(); //  "action" should be "partialUpdateObject" when no indexingMethod is specified
    });
    test('partialRecordUpdate', () => {
        job.beforeStep({ indexingMethod: 'partialRecordUpdate' }, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID' });
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();

        var algoliaOperations = job.process(new ProductMock());
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('fullRecordUpdate', () => {
        job.beforeStep({ indexingMethod: 'fullRecordUpdate' }, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID' });
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();

        var algoliaOperations = job.process(new ProductMock());
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('fullCatalogReindex', () => {
        job.beforeStep({ indexingMethod: 'fullCatalogReindex' }, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID' });
        expect(mockDeleteTemporaryIndices).toHaveBeenCalledWith('products', expect.arrayContaining(['default', 'fr', 'en']));

        var algoliaOperations = job.process(new ProductMock());
        expect(algoliaOperations).toMatchSnapshot();
    });
});

test('send', () => {
    job.beforeStep({}, stepExecution);

    const algoliaOperationsChunk = [];
    for (let i = 0; i < 3; ++i) {
        const algoliaOperations = [
            { action: 'addObject', indexName: 'test_en', body: { id: `${i}` } },
            { action: 'addObject', indexName: 'test_fr', body: { id: `${i}` } },
        ];
        algoliaOperations.toArray = function () {
            return algoliaOperations;
        };
        algoliaOperationsChunk.push(algoliaOperations);
    }
    algoliaOperationsChunk.toArray = function () {
        return algoliaOperationsChunk;
    };

    job.send(algoliaOperationsChunk);

    expect(mockSendMultiIndexBatch).toHaveBeenCalledWith(algoliaOperationsChunk.flat());
});

describe('afterStep', () => {
    beforeAll(() => {
        job.__setLastIndexingTasks({ "test_index_fr": 42, "test_index_en": 51 });
    });

    test('partialRecordUpdate', () => {
        job.beforeStep({ indexingMethod: 'partialRecordUpdate' }, stepExecution);
        job.afterStep();
        expect(mockFinishAtomicReindex).not.toHaveBeenCalled();
    });
    test('fullCatalogReindex', () => {
        job.beforeStep({ indexingMethod: 'fullCatalogReindex' }, stepExecution);
        job.afterStep();
        expect(mockFinishAtomicReindex).toHaveBeenCalledWith(
            'products',
            expect.arrayContaining(['default', 'fr', 'en']),
            { "test_index_fr": 42, "test_index_en": 51 }
        );
    });
});