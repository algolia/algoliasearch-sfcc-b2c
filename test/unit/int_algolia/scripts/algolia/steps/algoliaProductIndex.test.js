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
const mockSendMultiIndicesBatch = jest.fn().mockReturnValue({
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
        sendMultiIndicesBatch: mockSendMultiIndicesBatch,
    }
}, {virtual: true});

const stepExecution = {
    getJobExecution: () => {
        return {
            getJobID: () => 'SendProductsTestJob',
        }
    },
    getStepID: () => 'sendProductsTestStep',
};

const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/steps/sendChunkOrientedProductUpdates');

describe('process', () => {
    test('default', () => {
        job.beforeStep({}, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'SendProductsTestJob', stepID: 'sendProductsTestStep' });
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();

        var algoliaOperations = job.process(new ProductMock());
        expect(algoliaOperations).toMatchSnapshot(); //  "action" should be "partialUpdateObject" when no indexingMethod is specified
    });
    test('partialRecordUpdate', () => {
        job.beforeStep({ indexingMethod: 'partialRecordUpdate' }, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'SendProductsTestJob', stepID: 'sendProductsTestStep' });
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();

        var algoliaOperations = job.process(new ProductMock());
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('fullRecordUpdate', () => {
        job.beforeStep({ indexingMethod: 'fullRecordUpdate' }, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'SendProductsTestJob', stepID: 'sendProductsTestStep' });
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();

        var algoliaOperations = job.process(new ProductMock());
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('fullCatalogReindex', () => {
        job.beforeStep({ indexingMethod: 'fullCatalogReindex' }, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'SendProductsTestJob', stepID: 'sendProductsTestStep' });
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

    expect(mockSendMultiIndicesBatch).toHaveBeenCalledWith(algoliaOperationsChunk.flat());
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
