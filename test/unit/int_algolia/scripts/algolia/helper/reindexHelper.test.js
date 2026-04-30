const mockDeleteIndex = jest.fn().mockReturnValue({
    ok: true,
    object: {
        body: {
            taskID: 42,
            deletedAt: '2023-10-01T12:00:00.000Z'
        }
    }
});
const mockCopySettingsFromProdIndices = jest.fn().mockReturnValue({
    ok: true,
    object: {
        body: {
            taskID: 43,
            updatedAt: '2023-10-01T12:00:00.000Z'
        }
    }
});
const mockMoveIndex = jest.fn().mockReturnValue({
    ok: true,
    object: {
        body: {
            taskID: 42,
            updatedAt: '2023-10-01T12:00:00.000Z'
        }
    }
});
const mockGetIndexSettings = jest.fn();
const mockSetIndexSettings = jest.fn();
const mockWaitTask = jest.fn();
const mockWaitForRunEvent = jest.fn();
const mockSendMultiIndexBatch = jest.fn();
jest.mock('*/cartridge/scripts/algoliaIndexingAPI', () => {
    return {
        deleteIndex: mockDeleteIndex,
        getIndexSettings: mockGetIndexSettings,
        setIndexSettings: mockSetIndexSettings,
        copyIndexSettings: mockCopySettingsFromProdIndices,
        moveIndex: mockMoveIndex,
        waitTask: mockWaitTask,
        waitForRunEvent: mockWaitForRunEvent,
        sendMultiIndexBatch: mockSendMultiIndexBatch,
        pushByIndexName: jest.fn(),
    }
}, {virtual: true});

const reindexHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/reindexHelper');

test('deleteTemporaryIndices', () => {
    const res = reindexHelper.deleteTemporaryIndices('products', ['fr', 'en']);
    expect(mockDeleteIndex).nthCalledWith(1, 'test_index___products__fr.tmp');
    expect(mockDeleteIndex).nthCalledWith(2, 'test_index___products__en.tmp');
    expect(res).toEqual({
        "test_index___products__en.tmp": 42,
        "test_index___products__fr.tmp": 42,
    });
});

test('copyIndexSettings', () => {
    const frSettings = { attributesForFaceting: ['price.EUR'] }
    const enSettings = { attributesForFaceting: ['price.USD'] }
    mockGetIndexSettings.mockImplementation(indexName => {
        return {
            ok: true,
            object: {
                body: indexName.endsWith('fr') ? frSettings : enSettings,
            }
        }
    });

    var res = reindexHelper.copySettingsFromProdIndices('products', ['fr', 'en']);
    expect(mockGetIndexSettings).nthCalledWith(1, 'test_index___products__fr');
    expect(mockGetIndexSettings).nthCalledWith(2, 'test_index___products__en');
    expect(mockCopySettingsFromProdIndices).nthCalledWith(1, 'test_index___products__fr', 'test_index___products__fr.tmp');
    expect(mockCopySettingsFromProdIndices).nthCalledWith(2, 'test_index___products__en', 'test_index___products__en.tmp');
    expect(res).toEqual({
        "test_index___products__fr.tmp": 43,
        "test_index___products__en.tmp": 43,
    });
});

test('moveTemporaryIndices', () => {
    reindexHelper.moveTemporaryIndices('products', ['fr', 'en']);
    expect(mockMoveIndex).nthCalledWith(1, 'test_index___products__fr.tmp', 'test_index___products__fr');
    expect(mockMoveIndex).nthCalledWith(2, 'test_index___products__en.tmp', 'test_index___products__en');
});

test('waitForTasks', () => {
    reindexHelper.waitForTasks({ 'testIndex': 33, 'testIndex2': 51 });

    expect(mockWaitTask).toHaveBeenCalledTimes(2);
    expect(mockWaitTask).toHaveBeenCalledWith('testIndex', 33);
    expect(mockWaitTask).toHaveBeenCalledWith('testIndex2', 51);
});

test('waitForEvents', () => {
    reindexHelper.waitForEvents({
        'run-1': ['evt-1', 'evt-2', 'evt-3'],
        'run-2': ['evt-4'],
    });

    expect(mockWaitForRunEvent).toHaveBeenCalledTimes(4);
    expect(mockWaitForRunEvent).toHaveBeenCalledWith('run-1', 'evt-1');
    expect(mockWaitForRunEvent).toHaveBeenCalledWith('run-1', 'evt-2');
    expect(mockWaitForRunEvent).toHaveBeenCalledWith('run-1', 'evt-3');
    expect(mockWaitForRunEvent).toHaveBeenCalledWith('run-2', 'evt-4');
});

describe('finishAtomicReindex', () => {
    beforeEach(() => {
        mockGetIndexSettings.mockReturnValue({
            ok: true,
            object: { body: { attributesForFaceting: ['price.USD'] } },
        });
        mockCopySettingsFromProdIndices.mockReturnValue({
            ok: true,
            object: { body: { taskID: 99, updatedAt: '2023-10-01T12:00:00.000Z' } },
        });
        mockWaitTask.mockClear();
        mockWaitForRunEvent.mockClear();
        mockMoveIndex.mockClear();
    });

    test('Search API - calls waitForTasks for indexing tasks, copy settings tasks, then moveTemporaryIndices', () => {
        const indexingTasks = { 'test_index___products__fr.tmp': 100, 'test_index___products__en.tmp': 101 };

        reindexHelper.finishAtomicReindex('products', ['fr', 'en'], indexingTasks, 'search-api');

        // copySettingsFromProdIndices called first (via getIndexSettings + copyIndexSettings)
        expect(mockGetIndexSettings).toHaveBeenCalledTimes(2);

        // waitTask called for: indexing tasks (2) + copy settings tasks (2)
        expect(mockWaitTask).toHaveBeenCalledWith('test_index___products__fr.tmp', 100);
        expect(mockWaitTask).toHaveBeenCalledWith('test_index___products__en.tmp', 101);

        // waitForRunEvent should NOT be called for Search API
        expect(mockWaitForRunEvent).not.toHaveBeenCalled();

        // moveTemporaryIndices called
        expect(mockMoveIndex).toHaveBeenCalledTimes(2);
        expect(mockMoveIndex).toHaveBeenCalledWith('test_index___products__fr.tmp', 'test_index___products__fr');
        expect(mockMoveIndex).toHaveBeenCalledWith('test_index___products__en.tmp', 'test_index___products__en');
    });

    test('Ingestion API - calls waitForEvents instead of waitForTasks for indexing events', () => {
        const indexingEvents = {
            'run-1': ['evt-1', 'evt-2'],
            'run-2': ['evt-3'],
        };

        reindexHelper.finishAtomicReindex('products', ['fr', 'en'], indexingEvents, 'ingestion-api');

        // waitForRunEvent called for each event
        expect(mockWaitForRunEvent).toHaveBeenCalledTimes(3);
        expect(mockWaitForRunEvent).toHaveBeenCalledWith('run-1', 'evt-1');
        expect(mockWaitForRunEvent).toHaveBeenCalledWith('run-1', 'evt-2');
        expect(mockWaitForRunEvent).toHaveBeenCalledWith('run-2', 'evt-3');

        // waitTask still called for copy settings tasks
        expect(mockWaitTask).toHaveBeenCalled();

        // moveTemporaryIndices called
        expect(mockMoveIndex).toHaveBeenCalledTimes(2);
    });

    test('default (undefined) indexingAPI uses Search API path', () => {
        const indexingTasks = { 'test_index___products__fr.tmp': 200 };

        reindexHelper.finishAtomicReindex('products', ['fr'], indexingTasks);

        expect(mockWaitTask).toHaveBeenCalledWith('test_index___products__fr.tmp', 200);
        expect(mockWaitForRunEvent).not.toHaveBeenCalled();
        expect(mockMoveIndex).toHaveBeenCalledTimes(1);
    });

    test('Ingestion API with empty indexingEvents - still copies settings and moves indices', () => {
        reindexHelper.finishAtomicReindex('products', ['fr'], {}, 'ingestion-api');

        expect(mockWaitForRunEvent).not.toHaveBeenCalled();
        // copy settings wait + move still happens
        expect(mockWaitTask).toHaveBeenCalled();
        expect(mockMoveIndex).toHaveBeenCalledTimes(1);
    });
});
