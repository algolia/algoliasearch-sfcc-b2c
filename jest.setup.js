// Initialize some default mocks for all tests.

// System classes, alphabetical order
jest.mock('dw/catalog/ProductMgr', () => {
    return {
        queryAllSiteProducts: function() {},
        getProduct: jest.fn(() => {
            const ProductMock = require('./test/mocks/dw/catalog/Product');
            return new ProductMock();
        }),
    }
}, {virtual: true});
jest.mock('dw/io/File', () => {
    class MockedFile {
        constructor() {
            this.IMPEX = 'IMPEX'
        }
        exists() {
            return true;
        }
        list() {
            return [];
        }
    }
    return MockedFile;
}, {virtual: true});
jest.mock('dw/system/Logger', () => {
    return {
        info: jest.fn(),
        error: jest.fn(),
        getLogger: jest.fn(() => {
            return {
                info: jest.fn(),
                error: jest.fn(),
            }
        }),
    }
}, {virtual: true});
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
jest.mock('dw/system/Status', () => {}, {virtual: true});
jest.mock('dw/system/System', () => {}, {virtual: true});
jest.mock('dw/system/Transaction', () => {}, {virtual: true});
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
jest.mock('dw/web/Resource', () => {
    return {
        msg: function() {}
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

// Mocked libraries, to be rewritten with `requireActual()`
jest.mock('*/cartridge/scripts/algolia/helper/logHelper', () => {
    return {
        getLogData: function() {}
    }
}, {virtual: true});
jest.mock('*/cartridge/scripts/services/algoliaIndexingService', () => {}, {virtual: true});

// The following are not mocks, it points SFCC relative requires to the actual files
// https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/usingjavascriptmodules.html#path-lookup-behavior-of-the-require-method
jest.mock('*/cartridge/scripts/algolia/customization/productModelCustomizer', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/customization/productModelCustomizer');
}, {virtual: true});

jest.mock('*/cartridge/scripts/algolia/filters/productFilter', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');
}, {virtual: true});

jest.mock('*/cartridge/scripts/algolia/helper/fileHelper', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/helper/fileHelper');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/helper/jobHelper', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/helper/jobHelper');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/helper/sendHelper', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/helper/sendHelper');
}, {virtual: true});

jest.mock('*/cartridge/scripts/algolia/lib/algoliaConstants', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaConstants');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    const originalModule = jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaData');
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
jest.mock('*/cartridge/scripts/algolia/lib/algoliaProductConfig', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaProductConfig');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/lib/utils', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/lib/utils');
}, {virtual: true});

jest.mock('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
}, {virtual: true});
