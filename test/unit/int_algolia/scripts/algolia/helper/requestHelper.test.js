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

    test('collects the error message of a failed push', () => {
        mockPushByIndexName.mockReturnValue({
            ok: false,
            getErrorMessage: () => 'Push task not found for index index_en',
        });

        const res = requestHelper.sendGroupedIngestionAPIRecords({
            'index_en': { 'addObject': [{ objectID: '1' }] },
        });

        expect(res.errorMessages).toEqual(['Push task not found for index index_en']);
    });

    test('deduplicates identical messages across indices and actions', () => {
        // A missing task or a conflicting destination fails every chunk of an index with
        // identical text, so the report should carry one line, not one per push.
        mockPushByIndexName.mockReturnValue({
            ok: false,
            getErrorMessage: () => 'multiple tasks found for the Push connector',
        });

        const res = requestHelper.sendGroupedIngestionAPIRecords({
            'index_en': { 'addObject': [{ objectID: '1' }], 'deleteObject': [{ objectID: '2' }] },
            'index_fr': { 'addObject': [{ objectID: '1' }] },
        });

        expect(mockPushByIndexName).toHaveBeenCalledTimes(3);
        expect(res.errorMessages).toEqual(['multiple tasks found for the Push connector']);
    });

    test('keeps distinct messages, in the order they occurred', () => {
        mockPushByIndexName
            .mockReturnValueOnce({ ok: false, getErrorMessage: () => 'Task not found' })
            .mockReturnValueOnce({ ok: false, getErrorMessage: () => 'Invalid API key' });

        const res = requestHelper.sendGroupedIngestionAPIRecords({
            'index_en': { 'addObject': [{ objectID: '1' }] },
            'index_fr': { 'addObject': [{ objectID: '1' }] },
        });

        expect(res.errorMessages).toEqual(['Task not found', 'Invalid API key']);
    });

    test('returns no messages when every push succeeds', () => {
        mockPushByIndexName.mockReturnValue({
            ok: true,
            object: { body: { runID: 'run-1', eventID: 'evt-1' } },
        });

        const res = requestHelper.sendGroupedIngestionAPIRecords({
            'index_en': { 'addObject': [{ objectID: '1' }] },
        });

        expect(res.errorMessages).toEqual([]);
    });

    test('survives a failed result that exposes no getErrorMessage', () => {
        mockPushByIndexName.mockReturnValue({ ok: false });

        const res = requestHelper.sendGroupedIngestionAPIRecords({
            'index_en': { 'addObject': [{ objectID: '1' }] },
        });

        expect(res.errorMessages).toEqual([]);
        expect(res.failedRecords).toBe(1);
    });

    // Both reproduced against a live application, see the list in requestHelper.js
    const MISSING_TASK_ERROR = '{"error":{"code":"resource_not_found"},'
        + '"message":"cannot find task index_en","status":404}';
    const MULTIPLE_TASKS_ERROR = '{"error":{"code":"invalid_payload"},"message":"multiple tasks (a, b) found for the'
        + ' Push connector with indexName index_en, please use /2/tasks/:id/push instead","status":400}';
    // Shaped after the Search API's record-too-big response. The push endpoint reports
    // record problems asynchronously, so this stands in for a non-conflict 400.
    const OTHER_400_ERROR = '{"error":{"code":"invalid_payload"},"message":"Record 1 is too big:'
        + ' size: 11072 byte(s), maximum allowed: 10000 byte(s)","status":400}';
    // A different condition that happens to suggest the same endpoint as the remedy
    const SAME_REMEDY_ERROR = '{"error":{"code":"invalid_payload"},"message":"the destination is'
        + ' ambiguous, please use /2/tasks/:id/push instead","status":400}';

    test.each([
        // The two known cases: the status and the message both have to match
        { label: 'a missing task', status: 404, message: MISSING_TASK_ERROR, unrecoverable: true },
        { label: 'conflicting tasks', status: 400, message: MULTIPLE_TASKS_ERROR, unrecoverable: true },

        // The same statuses carrying a different message are not recognized
        { label: 'a 404 with an unfamiliar message', status: 404, message: 'something else', unrecoverable: false },
        { label: 'a 400 that does not name the task conflict', status: 400, message: OTHER_400_ERROR, unrecoverable: false },

        // Matching is on what went wrong, not the remedy, which other errors may suggest
        { label: 'an unrelated 400 suggesting the same endpoint', status: 400, message: SAME_REMEDY_ERROR, unrecoverable: false },

        // The known messages under a different status are not recognized either
        { label: 'the missing-task message under a 500', status: 500, message: MISSING_TASK_ERROR, unrecoverable: false },

        // Nothing else stops the job, auth included: no status for it is documented
        // or observed
        { label: 'a rejected key', status: 403, message: 'Invalid Application-ID or API key', unrecoverable: false },
        { label: 'a request timeout', status: 408, message: 'timeout', unrecoverable: false },
        { label: 'a rate limit', status: 429, message: 'rate limited', unrecoverable: false },
    ])('reports $label as unrecoverableFailure=$unrecoverable', ({ status, message, unrecoverable }) => {
        mockPushByIndexName.mockReturnValue({
            ok: false,
            getError: () => status,
            getErrorMessage: () => message,
        });

        const res = requestHelper.sendGroupedIngestionAPIRecords({
            'index_en': { 'addObject': [{ objectID: '1' }] },
        });

        expect(res.unrecoverableFailure).toBe(unrecoverable);
    });

    test('treats a failure with no readable message as recoverable', () => {
        mockPushByIndexName.mockReturnValue({ ok: false, getError: () => 404 });

        const res = requestHelper.sendGroupedIngestionAPIRecords({
            'index_en': { 'addObject': [{ objectID: '1' }] },
        });

        expect(res.unrecoverableFailure).toBe(false);
    });

    test('reports no unrecoverable failure when every push succeeds', () => {
        mockPushByIndexName.mockReturnValue({
            ok: true,
            object: { body: { runID: 'run-1', eventID: 'evt-1' } },
        });

        const res = requestHelper.sendGroupedIngestionAPIRecords({
            'index_en': { 'addObject': [{ objectID: '1' }] },
        });

        expect(res.unrecoverableFailure).toBe(false);
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
