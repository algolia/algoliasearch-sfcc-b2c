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
            taskID: 42,
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
const mockSendMultiIndexBatch = jest.fn();
jest.mock('*/cartridge/scripts/algoliaIndexingAPI', () => {
    return {
        deleteIndex: mockDeleteIndex,
        getIndexSettings: mockGetIndexSettings,
        setIndexSettings: mockSetIndexSettings,
        copyIndexSettings: mockCopySettingsFromProdIndices,
        moveIndex: mockMoveIndex,
        waitTask: mockWaitTask,
        sendMultiIndexBatch: mockSendMultiIndexBatch,
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
    mockSetIndexSettings.mockImplementation((indexName, settings) => {
        return {
            ok: true,
            object: {
                body: {
                    taskID:  indexName.endsWith('fr.tmp') ? 806 : 807,
                    updatedAt: '2023-10-01T12:00:00.000Z'
                }
            }
        }
    });

    var res = reindexHelper.copySettingsFromProdIndices('products', ['fr', 'en']);
    expect(mockGetIndexSettings).nthCalledWith(1, 'test_index___products__fr');
    expect(mockSetIndexSettings).nthCalledWith(1, 'test_index___products__fr.tmp', frSettings);
    expect(mockGetIndexSettings).nthCalledWith(2, 'test_index___products__en');
    expect(mockSetIndexSettings).nthCalledWith(2, 'test_index___products__en.tmp', enSettings);
    expect(res).toEqual({
        "test_index___products__fr.tmp": 806,
        "test_index___products__en.tmp": 807,
    });
});

test('moveTemporaryIndices', () => {
    reindexHelper.moveTemporaryIndices('products', ['fr', 'en']);
    expect(mockMoveIndex).nthCalledWith(1, 'test_index___products__fr.tmp', 'test_index___products__fr');
    expect(mockMoveIndex).nthCalledWith(2, 'test_index___products__en.tmp', 'test_index___products__en');
});

test('waitForTasks', () => {
    mockWaitTask
        .mockReturnValue({
            ok: true,
            object: { body: { status: 'published' }}
        });
    reindexHelper.waitForTasks({ 'testIndex': 33, 'testIndex2': 51 });

    expect(mockWaitTask).toHaveBeenCalledTimes(2);
    expect(mockWaitTask).toHaveBeenCalledWith('testIndex', 33);
    expect(mockWaitTask).toHaveBeenCalledWith('testIndex2', 51);
});

test('sendRetryableBatch', () => {
    const batch = [
        {
            action: 'addObject',
            indexName: 'test_index_fr_FR',
            body: { objectID: 'record1', name: 'record1' },
        },
        {
            action: 'addObject',
            indexName: 'test_index_en_US',
            body: { objectID: 'record1', name: 'record1' },
        },
        {
            action: 'addObject',
            indexName: 'test_index_fr_FR',
            body: { objectID: 'record2', name: 'record2' },
        },
        {
            action: 'addObject',
            indexName: 'test_index_en_US',
            body: { objectID: 'record2', name: 'record2' },
        }
        ,
        {
            action: 'addObject',
            indexName: 'test_index_fr_FR',
            body: { objectID: 'record3', name: 'record3' },
        },
        {
            action: 'addObject',
            indexName: 'test_index_en_US',
            body: { objectID: 'record3', name: 'record3' },
        }
    ];
    mockSendMultiIndexBatch.mockReturnValueOnce({
        error: true,
        getErrorMessage: () => '{"message":"Record at the position 0 objectID=record1 is too big size=11072/10000 bytes. Please have a look at https://www.algolia.com/doc/guides/sending-and-managing-data/prepare-your-data/in-depth/index-and-records-size-and-usage-limitations/#record-size-limits","position":2,"objectID":"record2","status":400}'
    });
    mockSendMultiIndexBatch.mockReturnValue({
        ok: true,
    });

    const res = reindexHelper.sendRetryableBatch(batch);

    expect(mockSendMultiIndexBatch).toHaveBeenCalledTimes(2);
    expect(res.result.ok).toBe(true);
    expect(res.failedRecords).toBe(2);
    expect(batch.length).toBe(4); // 2 records have been removed
});
