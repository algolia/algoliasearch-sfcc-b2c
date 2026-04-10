const mockSendMultiIndexBatch = jest.fn();
const mockPushByIndexName = jest.fn();
jest.mock('*/cartridge/scripts/algoliaIndexingAPI', () => {
    return {
        deleteIndex: jest.fn(),
        getIndexSettings: jest.fn(),
        setIndexSettings: jest.fn(),
        copyIndexSettings: jest.fn(),
        moveIndex: jest.fn(),
        waitTask: jest.fn(),
        sendMultiIndexBatch: mockSendMultiIndexBatch,
        pushByIndexName: mockPushByIndexName,
    }
}, {virtual: true});

const requestHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/requestHelper');

beforeEach(() => {
    mockSendMultiIndexBatch.mockReset();
    mockPushByIndexName.mockReset();
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

    const res = requestHelper.sendRetryableBatch(batch);

    expect(mockSendMultiIndexBatch).toHaveBeenCalledTimes(2);
    expect(res.result.ok).toBe(true);
    expect(res.failedRecords).toBe(2);
    expect(batch.length).toBe(4); // 2 records have been removed
});

test('groupRecordsForIngestionAPI', () => {
    const records = [
        { action: 'addObject', indexName: 'index_en', body: { objectID: '1', name: 'Product 1' } },
        { action: 'addObject', indexName: 'index_fr', body: { objectID: '1', name: 'Produit 1' } },
        { action: 'addObject', indexName: 'index_en', body: { objectID: '2', name: 'Product 2' } },
        { action: 'deleteObject', indexName: 'index_en', body: { objectID: '3' } },
    ];

    const result = requestHelper.groupRecordsForIngestionAPI(records);

    expect(result).toEqual({
        'index_en': {
            'addObject': [
                { objectID: '1', name: 'Product 1' },
                { objectID: '2', name: 'Product 2' },
            ],
            'deleteObject': [
                { objectID: '3' },
            ],
        },
        'index_fr': {
            'addObject': [
                { objectID: '1', name: 'Produit 1' },
            ],
        },
    });
});

describe('sendGroupedIngestionAPIRecords', () => {
    test('all pushes succeed - returns ok with indexingEvents keyed by runID', () => {
        const runIDs = { 'index_en': 'run-en', 'index_fr': 'run-fr' };
        let callCount = 0;
        mockPushByIndexName.mockImplementation((payload, indexName) => {
            callCount++;
            return {
                ok: true,
                object: { body: { runID: runIDs[indexName], eventID: 'evt-' + callCount } },
            };
        });

        const groupedRecords = {
            'index_en': {
                'addObject': [{ objectID: '1' }, { objectID: '2' }],
            },
            'index_fr': {
                'addObject': [{ objectID: '1' }],
            },
        };

        const res = requestHelper.sendGroupedIngestionAPIRecords(groupedRecords);

        expect(mockPushByIndexName).toHaveBeenCalledTimes(2);
        expect(mockPushByIndexName).toHaveBeenCalledWith(
            { action: 'addObject', records: [{ objectID: '1' }, { objectID: '2' }] },
            'index_en',
            undefined
        );
        expect(mockPushByIndexName).toHaveBeenCalledWith(
            { action: 'addObject', records: [{ objectID: '1' }] },
            'index_fr',
            undefined
        );
        expect(res.result.ok).toBe(true);
        expect(res.failedRecords).toBe(0);
        expect(res.result.object.body.indexingEvents).toEqual({
            'run-en': ['evt-1'],
            'run-fr': ['evt-2'],
        });
    });

    test('partial failure - ok is false, failed records counted, successful events kept', () => {
        mockPushByIndexName
            .mockReturnValueOnce({
                ok: true,
                object: { body: { runID: 'run-en', eventID: 'evt-1' } },
            })
            .mockReturnValueOnce({
                ok: false,
                getErrorMessage: () => 'Service error',
            });

        const groupedRecords = {
            'index_en': {
                'addObject': [{ objectID: '1' }, { objectID: '2' }],
            },
            'index_fr': {
                'addObject': [{ objectID: '3' }],
            },
        };

        const res = requestHelper.sendGroupedIngestionAPIRecords(groupedRecords);

        expect(mockPushByIndexName).toHaveBeenCalledTimes(2);
        expect(res.result.ok).toBe(false);
        expect(res.failedRecords).toBe(1);
        expect(res.result.object.body.indexingEvents).toEqual({
            'run-en': ['evt-1'],
        });
    });

    test('multiple actions per index - same runID, multiple eventIDs', () => {
        let callCount = 0;
        mockPushByIndexName.mockImplementation(() => {
            callCount++;
            return {
                ok: true,
                object: { body: { runID: 'run-en', eventID: 'evt-' + callCount } },
            };
        });

        const groupedRecords = {
            'index_en': {
                'addObject': [{ objectID: '1' }],
                'deleteObject': [{ objectID: '2' }],
            },
        };

        const res = requestHelper.sendGroupedIngestionAPIRecords(groupedRecords);

        expect(mockPushByIndexName).toHaveBeenCalledTimes(2);
        expect(res.result.ok).toBe(true);
        expect(res.failedRecords).toBe(0);
        expect(res.result.object.body.indexingEvents).toEqual({
            'run-en': ['evt-1', 'evt-2'],
        });
    });

    test('forwards indexingMethod to pushByIndexName', () => {
        mockPushByIndexName.mockReturnValue({
            ok: true,
            object: { body: { runID: 'run-1', eventID: 'evt-1' } },
        });

        const groupedRecords = {
            'index_en.tmp': {
                'addObject': [{ objectID: '1' }],
            },
        };

        requestHelper.sendGroupedIngestionAPIRecords(groupedRecords, 'fullCatalogReindex');

        expect(mockPushByIndexName).toHaveBeenCalledWith(
            { action: 'addObject', records: [{ objectID: '1' }] },
            'index_en.tmp',
            'fullCatalogReindex'
        );
    });
});
