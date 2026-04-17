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

    expect(result).toMatchSnapshot('grouped records by index and action');
});

test('groupRecordsForIngestionAPI - realistic multi-locale product batch', () => {
    const batch = [
        { action: 'addObject', indexName: 'test_products_en.tmp', body: { objectID: 'M-25592581', name: 'Fitted Shirt', price: { USD: 29.99, EUR: 24.99 }, in_stock: true, variants: [{ objectID: '701644031206M', color: 'JJB52A0', size: '004' }] } },
        { action: 'addObject', indexName: 'test_products_fr.tmp', body: { objectID: 'M-25592581', name: 'Chemise ajustée', price: { USD: 29.99, EUR: 24.99 }, in_stock: true, variants: [{ objectID: '701644031206M', color: 'JJB52A0', size: '004' }] } },
        { action: 'addObject', indexName: 'test_products_en.tmp', body: { objectID: 'M-25604524', name: 'Classic Jeans', price: { USD: 49.99, EUR: 39.99 }, in_stock: true, variants: [{ objectID: '701644031300M', color: 'BLK', size: '032' }] } },
        { action: 'addObject', indexName: 'test_products_fr.tmp', body: { objectID: 'M-25604524', name: 'Jean classique', price: { USD: 49.99, EUR: 39.99 }, in_stock: true, variants: [{ objectID: '701644031300M', color: 'BLK', size: '032' }] } },
        { action: 'deleteObject', indexName: 'test_products_en.tmp', body: { objectID: 'M-99999999' } },
        { action: 'deleteObject', indexName: 'test_products_fr.tmp', body: { objectID: 'M-99999999' } },
    ];

    const groupedRecords = requestHelper.groupRecordsForIngestionAPI(batch);

    expect(groupedRecords).toMatchSnapshot('multi-locale grouped records with mixed actions');
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
        expect(res.sentRecords).toBe(3);
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
        expect(res.sentRecords).toBe(2);
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
        expect(res.sentRecords).toBe(2);
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

describe('Ingestion API payload snapshots', () => {
    test('full reindex flow: grouping → push payloads → response', () => {
        const batch = [
            { action: 'addObject', indexName: 'test_products_en.tmp', body: { objectID: 'M-25592581', name: 'Fitted Shirt', price: { USD: 29.99, EUR: 24.99 }, in_stock: true, variants: [{ objectID: '701644031206M', color: 'JJB52A0', size: '004' }] } },
            { action: 'addObject', indexName: 'test_products_fr.tmp', body: { objectID: 'M-25592581', name: 'Chemise ajustée', price: { USD: 29.99, EUR: 24.99 }, in_stock: true, variants: [{ objectID: '701644031206M', color: 'JJB52A0', size: '004' }] } },
            { action: 'addObject', indexName: 'test_products_en.tmp', body: { objectID: 'M-25604524', name: 'Classic Jeans', price: { USD: 49.99, EUR: 39.99 }, in_stock: true, variants: [{ objectID: '701644031300M', color: 'BLK', size: '032' }] } },
            { action: 'addObject', indexName: 'test_products_fr.tmp', body: { objectID: 'M-25604524', name: 'Jean classique', price: { USD: 49.99, EUR: 39.99 }, in_stock: true, variants: [{ objectID: '701644031300M', color: 'BLK', size: '032' }] } },
        ];

        const groupedRecords = requestHelper.groupRecordsForIngestionAPI(batch);
        expect(groupedRecords).toMatchSnapshot('grouped records for fullCatalogReindex');

        let callCount = 0;
        mockPushByIndexName.mockImplementation((payload, indexName) => {
            callCount++;
            return {
                ok: true,
                object: { body: { runID: 'run-' + indexName, eventID: 'evt-' + callCount } },
            };
        });

        const response = requestHelper.sendGroupedIngestionAPIRecords(groupedRecords, 'fullCatalogReindex');

        mockPushByIndexName.mock.calls.forEach(function(call, i) {
            expect({
                payload: call[0],
                indexName: call[1],
                indexingMethod: call[2],
            }).toMatchSnapshot('pushByIndexName call ' + (i + 1));
        });

        expect(response).toMatchSnapshot('sendGroupedIngestionAPIRecords response');
    });

    test('delta index flow: mixed addObject and deleteObject payloads', () => {
        const batch = [
            { action: 'addObject', indexName: 'test_products_en', body: { objectID: '701644031206M', name: 'Fitted Shirt', price: { USD: 29.99 }, in_stock: true } },
            { action: 'addObject', indexName: 'test_products_fr', body: { objectID: '701644031206M', name: 'Chemise ajustée', price: { EUR: 24.99 }, in_stock: true } },
            { action: 'deleteObject', indexName: 'test_products_en', body: { objectID: '701644031300M' } },
            { action: 'deleteObject', indexName: 'test_products_fr', body: { objectID: '701644031300M' } },
        ];

        const groupedRecords = requestHelper.groupRecordsForIngestionAPI(batch);
        expect(groupedRecords).toMatchSnapshot('grouped records for delta index');

        let callCount = 0;
        mockPushByIndexName.mockImplementation((payload, indexName) => {
            callCount++;
            return {
                ok: true,
                object: { body: { runID: 'run-' + indexName, eventID: 'evt-' + callCount } },
            };
        });

        const response = requestHelper.sendGroupedIngestionAPIRecords(groupedRecords);

        mockPushByIndexName.mock.calls.forEach(function(call, i) {
            expect({
                payload: call[0],
                indexName: call[1],
                indexingMethod: call[2],
            }).toMatchSnapshot('pushByIndexName call ' + (i + 1));
        });

        expect(response).toMatchSnapshot('sendGroupedIngestionAPIRecords response');
    });

    test('inventory update flow: single partialUpdateObject per locale', () => {
        const batch = [
            { action: 'partialUpdateObject', indexName: 'test_products_en', body: { objectID: 'M-25592581', variants: [{ objectID: '701644031206M', in_stock: false }] } },
            { action: 'partialUpdateObject', indexName: 'test_products_fr', body: { objectID: 'M-25592581', variants: [{ objectID: '701644031206M', in_stock: false }] } },
        ];

        const groupedRecords = requestHelper.groupRecordsForIngestionAPI(batch);
        expect(groupedRecords).toMatchSnapshot('grouped records for inventory update');

        let callCount = 0;
        mockPushByIndexName.mockImplementation((payload, indexName) => {
            callCount++;
            return {
                ok: true,
                object: { body: { runID: 'run-' + indexName, eventID: 'evt-' + callCount } },
            };
        });

        const response = requestHelper.sendGroupedIngestionAPIRecords(groupedRecords);

        mockPushByIndexName.mock.calls.forEach(function(call, i) {
            expect({
                payload: call[0],
                indexName: call[1],
                indexingMethod: call[2],
            }).toMatchSnapshot('pushByIndexName call ' + (i + 1));
        });

        expect(response).toMatchSnapshot('sendGroupedIngestionAPIRecords response');
    });
});
