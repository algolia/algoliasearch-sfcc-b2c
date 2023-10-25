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
