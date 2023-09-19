const GlobalMock = require('../../../../../mocks/global');
const ProductMock = require('../../../../../mocks/dw/catalog/Product');

global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

jest.mock('dw/system/Site', () => {
    return {
        getCurrent: function () {
            return {
                getID: function() {
                    return 'Test-Site'
                },
                getName: function() {
                    return 'Name of the Test-Site'
                },
                getAllowedLocales: function () {
                    var arr = ['default', 'fr', 'en'];
                    arr.size = function () {
                        return arr.length;
                    };
                    arr.toArray = function () {
                        return arr;
                    };
                    return arr;
                },
                getAllowedCurrencies: function () {
                    var arr = [
                        { currencyCode: 'USD' },
                        { currencyCode: 'EUR' }
                    ];
                    arr.size = function () {
                        return arr.length;
                    };
                    return arr;
                },
                getCustomPreferenceValue: function(id) {
                    switch(id) {
                        case 'Algolia_IndexPrefix':
                            return 'test_index_';
                        default:
                            return null;
                    }
                }
            };
        }
    }
}, {virtual: true});
jest.mock('dw/util/Currency', () => {
    return {
        getCurrency: function (currency) { return currency; }
    }
}, {virtual: true});
jest.mock('dw/util/StringUtils', () => {
    return {
        trim: function (str) { return str; }
    }
}, {virtual: true});
jest.mock('dw/web/URLUtils', () => {
    return {
        url: function(endpoint, param, id) {
            var relURL = '/on/demandware.store/Sites-Algolia_SFRA-Site/';
            return relURL + global.request.getLocale() + '/' + endpoint + '?' + param + '=' + id;
        },
        staticURL: function(url) {
            return url;
        }
    }
}, {virtual: true});
jest.mock('dw/catalog/ProductMgr', () => {
    return {
        queryAllSiteProducts: function() {}
    }
}, {virtual: true});

jest.mock('*/cartridge/scripts/algolia/helper/logHelper', () => {}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaData');
    return {
        ...originalModule,
        getSetOfArray: function (id) {
            return id === 'CustomFields'
                ? ['url', 'UPC', 'searchable', 'variant', 'color', 'refinementColor', 'size', 'refinementSize', 'brand', 'online', 'pageDescription', 'pageKeywords',
                    'pageTitle', 'short_description', 'name', 'long_description', 'image_groups']
                : null;
        },
    }
}, {virtual: true});
jest.mock('*/cartridge/scripts/services/algoliaIndexingService', () => {}, {virtual: true});
const mockSendMultiIndicesBatch = jest.fn().mockReturnValue({ ok: true });
jest.mock('*/cartridge/scripts/algoliaIndexingAPI', () => {
    return {
        sendMultiIndicesBatch: mockSendMultiIndicesBatch,
    }
}, {virtual: true});

const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/steps/sendChunkOrientedProductUpdates');

test('process', () => {
    job.beforeStep({ resourceType: 'test' });
    var algoliaOperations = job.process(new ProductMock());
    expect(algoliaOperations).toMatchSnapshot();
});

test('send', () => {
    job.beforeStep({ resourceType: 'test' });

    const algoliaOperationsChunk = [];
    for (let i = 0; i < 3; ++i) {
        const algoliaOperations = [
            { action: 'addObject', indexName: 'test_en', body: { id: `${i}` } },
            { action: 'addObject', indexName: 'test_fr', body: { id: `${i}` } },
        ];
        algoliaOperations.toArray = function () {
            return algoliaOperations;
        };
        algoliaOperationsChunk.push(algoliaOperations);
    }
    algoliaOperationsChunk.toArray = function () {
        return algoliaOperationsChunk;
    };

    job.send(algoliaOperationsChunk);

    expect(mockSendMultiIndicesBatch).toHaveBeenCalledWith(algoliaOperationsChunk.flat());
});
