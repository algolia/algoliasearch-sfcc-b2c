const mockService = jest.fn();
const mockRetryableCall = jest.fn(() => {
    return {
        ok: true
    }
});

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

test('sendBatch', () => {
    const indexName = 'testIndex';
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

    indexingAPI.sendBatch(indexName, algoliaRequests);

    expect(mockRetryableCall).toHaveBeenCalledWith(mockService, {
        method: 'POST',
        path: '/1/indexes/' + indexName + '/batch',
        body: {
            requests: algoliaRequests
        }
    });
});
