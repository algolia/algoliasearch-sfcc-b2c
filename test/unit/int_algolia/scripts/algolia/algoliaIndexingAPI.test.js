const mockService = jest.fn();
const mockRetryableCall = jest.fn();

jest.mock('*/cartridge/scripts/services/algoliaIndexingService', () => {
    return {
        getService: jest.fn(() => mockService),
    }
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/helper/retryStrategy', () => {
    return {
        retryableCall: mockRetryableCall,
    }
}, {virtual: true});

const indexingAPI = require('../../../../../cartridges/int_algolia/cartridge/scripts/algoliaIndexingAPI');
const jobHelper = require('../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/jobHelper');

// Replace the backoff spin-wait with a no-op so polling loops in tests complete instantly.
// `algoliaIndexingAPI` calls `jobHelper.sleepFor(...)` through the module reference,
// so this spy intercepts every call from production code.
jest.spyOn(jobHelper, 'sleepFor').mockImplementation(function () {});

beforeEach(() => {
    mockRetryableCall.mockReturnValue({
        ok: true
    });
});

test('sendBatch', () => {
    const indexName = 'testIndex';
    const algoliaRequests = [
        {
            action: 'addObject',
            body: { firstname: 'Jimmie', lastname: 'Barninger' }
        },
        {
            action: 'addObject',
            body: { firstname: 'Warren', lastname: 'Speach' }
        }
    ];

    indexingAPI.sendBatch(indexName, algoliaRequests);

    expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
        method: 'POST',
        path: '/1/indexes/' + indexName + '/batch',
        body: {
            requests: algoliaRequests
        }
    });
});

test('sendMultiIndexBatch', () => {
    const algoliaRequests = [
        {
            action: 'addObject',
            indexName: 'index1',
            body: { firstname: 'Jimmie', lastname: 'Barninger' }
        },
        {
            action: 'addObject',
            indexName: 'index2',
            body: { firstname: 'Warren', lastname: 'Speach' }
        }
    ];

    indexingAPI.sendMultiIndexBatch(algoliaRequests);

    expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
        method: 'POST',
        path: '/1/indexes/*/batch',
        body: {
            requests: algoliaRequests
        }
    });
});

test('deleteIndex', () => {
    indexingAPI.deleteIndex('testIndex');

    expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
        method: 'DELETE',
        path: '/1/indexes/testIndex',
    });
});

test('getIndexSettings', () => {
    indexingAPI.getIndexSettings('testIndex');

    expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
        method: 'GET',
        path: '/1/indexes/testIndex/settings',
    });
});

test('setIndexSettings', () => {
    const settings = { 'testSetting': 'testValue' };
    indexingAPI.setIndexSettings('testIndex', settings);

    expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
        method: 'PUT',
        path: '/1/indexes/testIndex/settings',
        body: settings,
    });
});

test('copyIndexSettings', () => {
    indexingAPI.copyIndexSettings('testIndexSrc', 'testIndexDest');

    expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
        method: 'POST',
        path: '/1/indexes/testIndexSrc/operation',
        body: {
            operation: 'copy',
            destination: 'testIndexDest',
            scope: ['settings', 'synonyms', 'rules'],
        }
    });
});

test('moveIndex', () => {
    indexingAPI.moveIndex('testIndexSrc', 'testIndexDest');

    expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
        method: 'POST',
        path: '/1/indexes/testIndexSrc/operation',
        body: {
            operation: 'move',
            destination: 'testIndexDest',
        }
    });
});

test('waitForTask', () => {
    mockRetryableCall
        .mockReturnValue({
            ok: true,
            object: { body: { status: 'published' }}
        })
        .mockReturnValueOnce({
            ok: true,
            object: { body: { status: 'notPublished' }}
        })
        .mockReturnValueOnce({
            ok: true,
            object: { body: { status: 'notPublished' }}
        });
    indexingAPI.waitTask('testIndex', 33);

    expect(mockRetryableCall).toHaveBeenCalledTimes(3);
    expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
        method: 'GET',
        path: '/1/indexes/testIndex/task/33',
    });
});

describe('pushByIndexName', () => {
    test('sends to Ingestion API without referenceIndexName for non-tmp index', () => {
        const payload = { action: 'addObject', records: [{ objectID: '1' }] };
        indexingAPI.pushByIndexName(payload, 'my_index');

        expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
            method: 'POST',
            path: '/1/push/my_index',
            body: payload,
            indexingAPI: 'ingestion-api',
        });
    });

    test('appends referenceIndexName query param for fullCatalogReindex', () => {
        const payload = { action: 'addObject', records: [{ objectID: '1' }] };
        indexingAPI.pushByIndexName(payload, 'my_index.tmp', 'fullCatalogReindex');

        expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
            method: 'POST',
            path: '/1/push/my_index.tmp?referenceIndexName=my_index',
            body: payload,
            indexingAPI: 'ingestion-api',
        });
    });

    test('does not append referenceIndexName without fullCatalogReindex even for .tmp index', () => {
        const payload = { action: 'addObject', records: [{ objectID: '1' }] };
        indexingAPI.pushByIndexName(payload, 'my_index.tmp');

        expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
            method: 'POST',
            path: '/1/push/my_index.tmp',
            body: payload,
            indexingAPI: 'ingestion-api',
        });
    });

    // fullCatalogReindex derives referenceIndexName by stripping the trailing ".tmp".
    // Passing a production (non-.tmp) index name in this mode would silently truncate it,
    // so pushByIndexName must fail fast.
    test('throws when fullCatalogReindex is used with a non-.tmp index name', () => {
        const payload = { action: 'addObject', records: [{ objectID: '1' }] };
        expect(() => indexingAPI.pushByIndexName(payload, 'products_en', 'fullCatalogReindex'))
            .toThrow(/must end in|temporary index name ending in/i);
        expect(mockRetryableCall).not.toHaveBeenCalled();
    });

    test('throws when fullCatalogReindex is used with the bare .tmp suffix', () => {
        const payload = { action: 'addObject', records: [{ objectID: '1' }] };
        expect(() => indexingAPI.pushByIndexName(payload, '.tmp', 'fullCatalogReindex'))
            .toThrow(/temporary index name ending in/i);
        expect(mockRetryableCall).not.toHaveBeenCalled();
    });
});

describe('pushByIndexName - HTTP request snapshots', () => {
    test('addObject push for fullCatalogReindex with realistic payload', () => {
        const payload = {
            action: 'addObject',
            records: [
                { objectID: 'M-25592581', name: 'Fitted Shirt', price: { USD: 29.99, EUR: 24.99 }, in_stock: true, variants: [{ objectID: '701644031206M', color: 'JJB52A0', size: '004' }] },
                { objectID: 'M-25604524', name: 'Classic Jeans', price: { USD: 49.99, EUR: 39.99 }, in_stock: true, variants: [{ objectID: '701644031300M', color: 'BLK', size: '032' }] },
            ],
        };

        indexingAPI.pushByIndexName(payload, 'test_products_en.tmp', 'fullCatalogReindex');

        expect(mockRetryableCall.mock.calls[0][1]).toMatchSnapshot('fullCatalogReindex push request params');
    });

    test('deleteObject push for delta index', () => {
        const payload = {
            action: 'deleteObject',
            records: [
                { objectID: '701644031206M' },
                { objectID: '701644031300M' },
            ],
        };

        indexingAPI.pushByIndexName(payload, 'test_products_en');

        expect(mockRetryableCall.mock.calls[0][1]).toMatchSnapshot('delta deleteObject push request params');
    });

    test('partialUpdateObject push for inventory update', () => {
        const payload = {
            action: 'partialUpdateObject',
            records: [
                { objectID: 'M-25592581', variants: [{ objectID: '701644031206M', in_stock: false }] },
            ],
        };

        indexingAPI.pushByIndexName(payload, 'test_products_en');

        expect(mockRetryableCall.mock.calls[0][1]).toMatchSnapshot('inventory update push request params');
    });
});

describe('waitForRunEvent', () => {
    test('polls event endpoint until non-404', () => {
        mockRetryableCall
            .mockReturnValueOnce({
                ok: false,
                error: 404,
                getErrorMessage: () => 'Not found',
            })
            .mockReturnValueOnce({
                ok: false,
                error: 404,
                getErrorMessage: () => 'Not found',
            })
            .mockReturnValue({
                ok: true,
                object: { body: { eventID: 'evt-abc', runID: 'run-uuid-123', status: 'succeeded', type: 'record', batchSize: 10 }}
            });
        indexingAPI.waitForRunEvent('run-uuid-123', 'evt-abc');

        expect(mockRetryableCall).toHaveBeenCalledTimes(3);
        expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
            method: 'GET',
            path: '/1/runs/run-uuid-123/events/evt-abc',
            indexingAPI: 'ingestion-api',
        });
    });

    test('returns immediately on first success', () => {
        mockRetryableCall
            .mockReturnValue({
                ok: true,
                object: { body: { eventID: 'evt-abc', runID: 'run-uuid-123', status: 'succeeded' }}
            });
        indexingAPI.waitForRunEvent('run-uuid-123', 'evt-abc');

        expect(mockRetryableCall).toHaveBeenCalledTimes(1);
    });

    test('throws on timeout when event never becomes available', () => {
        const originalDateNow = Date.now;
        let callCount = 0;
        Date.now = jest.fn(() => {
            callCount++;
            if (callCount <= 2) return 0;
            return 999999999;
        });

        mockRetryableCall.mockReturnValue({
            ok: false,
            error: 404,
            getErrorMessage: () => 'Not found',
        });

        expect(() => {
            indexingAPI.waitForRunEvent('run-timeout', 'evt-timeout');
        }).toThrow('Max wait time reached. Run: run-timeout; event: evt-timeout');

        Date.now = originalDateNow;
    });

    // Any non-404 response from the event endpoint (auth, malformed request, server error)
    // is terminal -- keeping to poll would loop for the full maxWait (10min) and hide the
    // real error from the operator.
    test.each([
        [400, 'Bad Request'],
        [401, 'Unauthorized'],
        [403, 'Forbidden'],
        [500, 'Internal Server Error'],
    ])('throws fast on non-404 HTTP %i without retrying', (status, msg) => {
        mockRetryableCall.mockReturnValue({
            ok: false,
            error: status,
            getErrorMessage: () => msg,
        });

        expect(() => {
            indexingAPI.waitForRunEvent('run-err', 'evt-err');
        }).toThrow(/waitForRunEvent failed/);

        expect(mockRetryableCall).toHaveBeenCalledTimes(1);
    });
});

describe('pushByIndexName - failure', () => {
    test('returns failed result when retryableCall fails', () => {
        mockRetryableCall.mockReturnValue({
            ok: false,
            getErrorMessage: () => 'Service unavailable',
        });

        const payload = { action: 'addObject', records: [{ objectID: '1' }] };
        const result = indexingAPI.pushByIndexName(payload, 'my_index');

        expect(result.ok).toBe(false);
        expect(mockRetryableCall).toHaveBeenCalledWith(mockService, expect.objectContaining({
            method: 'POST',
            path: '/1/push/my_index',
            indexingAPI: 'ingestion-api',
        }));
    });

    test('returns failed result for fullCatalogReindex path', () => {
        mockRetryableCall.mockReturnValue({
            ok: false,
            getErrorMessage: () => 'Bad request',
        });

        const payload = { action: 'addObject', records: [{ objectID: '1' }] };
        const result = indexingAPI.pushByIndexName(payload, 'my_index.tmp', 'fullCatalogReindex');

        expect(result.ok).toBe(false);
        expect(mockRetryableCall).toHaveBeenCalledWith(mockService, expect.objectContaining({
            path: '/1/push/my_index.tmp?referenceIndexName=my_index',
        }));
    });
});
