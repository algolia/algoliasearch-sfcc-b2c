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
