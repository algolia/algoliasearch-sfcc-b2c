const GlobalMock = require('../../../../../mocks/global');
const ProductMock = require('../../../../../mocks/dw/catalog/Product');

global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

jest.mock('*/cartridge/scripts/algolia/helper/logHelper', () => {}, {virtual: true});

const mockDeleteTemporariesIndices = jest.fn();
const mockCopySettingsFromProdIndices = jest.fn();
const mockMoveTemporariesIndices = jest.fn();
const mockFinishAtomicReindex = jest.fn();
jest.mock('*/cartridge/scripts/algolia/helper/reindexHelper', () => {
    return {
        deleteTemporariesIndices: mockDeleteTemporariesIndices,
        copySettingsFromProdIndices: mockCopySettingsFromProdIndices,
        moveTemporariesIndices: mockMoveTemporariesIndices,
        finishAtomicReindex: mockFinishAtomicReindex,
    };
}, {virtual: true});

jest.mock('*/cartridge/scripts/services/algoliaIndexingService', () => {}, {virtual: true});

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
        sendMultiIndicesBatch: mockSendMultiIndicesBatch,
        waitForTasks: jest.fn(),
    }
}, {virtual: true});

const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/steps/sendChunkOrientedProductUpdates');

describe('process', () => {
    test('partialRecordUpdate', () => {
        job.beforeStep({ resourceType: 'test', indexingMethod: 'partialRecordUpdate' });
        expect(mockDeleteTemporariesIndices).not.toHaveBeenCalled();

        var algoliaOperations = job.process(new ProductMock());
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('fullCatalogReindex', () => {
        job.beforeStep({ resourceType: 'test', indexingMethod: 'fullCatalogReindex' });
        expect(mockDeleteTemporariesIndices).toHaveBeenCalledWith('products', expect.arrayContaining(['default', 'fr', 'en']));

        var algoliaOperations = job.process(new ProductMock());
        expect(algoliaOperations).toMatchSnapshot();
    });
});

test('send', () => {
    job.beforeStep({ resourceType: 'test' });

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
        job.beforeStep({ resourceType: 'test', indexingMethod: 'partialRecordUpdate' });
        job.afterStep();
        expect(mockFinishAtomicReindex).not.toHaveBeenCalled();
    });
    test('fullCatalogReindex', () => {
        job.beforeStep({ resourceType: 'test', indexingMethod: 'fullCatalogReindex' });
        job.afterStep();
        expect(mockFinishAtomicReindex).toHaveBeenCalledWith(
            'products',
            expect.arrayContaining(['default', 'fr', 'en']),
            { "test_index_fr": 42, "test_index_en": 51 }
        );
    });
});
