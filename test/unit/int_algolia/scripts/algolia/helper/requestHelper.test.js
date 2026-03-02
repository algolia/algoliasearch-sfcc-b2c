const mockSendMultiIndexBatch = jest.fn();
jest.mock('*/cartridge/scripts/algoliaIndexingAPI', () => {
    return {
        deleteIndex: jest.fn(),
        getIndexSettings: jest.fn(),
        setIndexSettings: jest.fn(),
        copyIndexSettings: jest.fn(),
        moveIndex: jest.fn(),
        waitTask: jest.fn(),
        sendMultiIndexBatch: mockSendMultiIndexBatch,
        pushByIndexName: jest.fn(),
    }
}, {virtual: true});

const requestHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/requestHelper');

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

    const res = requestHelper.sendRetryableBatch(batch);

    expect(mockSendMultiIndexBatch).toHaveBeenCalledTimes(2);
    expect(res.result.ok).toBe(true);
    expect(res.failedRecords).toBe(2);
    expect(batch.length).toBe(4); // 2 records have been removed
});

test('groupPayloadsForIngestionAPI', () => {
    // TODO: write test
});

test('sendGroupedIngestionAPIPayloads', () => {
    // TODO: write test
});
