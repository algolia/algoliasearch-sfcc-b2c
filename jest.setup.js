// Initialize some default mocks for all tests.

const GlobalMock = require('./test/mocks/global');
global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();
global.customPreferences = {
    Algolia_IndexPrefix: 'test_index_',
    Algolia_RecordModel: 'variant-level',
}
global.session = {
    privacy: {
        algoliaAnchorProducts: null,
    }
};

// System classes, alphabetical order
jest.mock('dw/catalog/ProductMgr', () => {
    return {
        queryAllSiteProducts: jest.fn().mockReturnValue({
            close: jest.fn(),
            count: 4658,
        }),
        getProduct: jest.fn((id) => {
            const VariantMock = require('./test/mocks/dw/catalog/Variant');
            const variant = new VariantMock({ variationAttributes: { color: 'JJB52A0', size: '004' } });
            if (id === '25592581M') {
                const collectionHelper = require("./test/mocks/helpers/collectionHelper");
                const MasterProductMock = require('./test/mocks/dw/catalog/MasterProduct');
                const masterProduct = new MasterProductMock({
                    variationAttributes: { color: 'JJB52A0', size: '004' }
                });
                masterProduct.variants = collectionHelper.createCollection([
                    variant,
                ]);
                return masterProduct;
            }
            return variant;
        }),
    }
}, {virtual: true});
jest.mock('dw/catalog/PriceBookMgr', () => {
    return {
        getSitePriceBooks: jest.fn(() => {
            const collectionHelper = require("./test/mocks/helpers/collectionHelper");
            return collectionHelper.createCollection([
                {
                    ID: 'list-prices-usd',
                    currencyCode: 'USD',
                },
                {
                    ID: 'sale-prices-usd',
                    currencyCode: 'USD',
                },
                {
                    ID: 'list-prices-eur',
                    currencyCode: 'EUR',
                },
                {
                    ID: 'sale-prices-eur',
                    currencyCode: 'EUR',
                },
            ]);
        }),
    }
}, { virtual: true });
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
        getFullPath() {
            return '/path/to/mocked/file';
        }
    }
    return MockedFile;
}, {virtual: true});
jest.mock('dw/object/CustomObjectMgr', () => ({
    createCustomObject: jest.fn(() => {
        return {
            custom: {},
        }
    }),
    getCustomObject: jest.fn(),
    getAllCustomObjects: jest.fn(),
    queryCustomObjects: jest.fn(),
}), {virtual: true});
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
                    arr.get = function (i) {
                        return arr[i];
                    };
                    arr.size = function () {
                        return arr.length;
                    };
                    arr.toArray = function () {
                        return arr.slice();
                    };
                    return arr;
                },
                getAllowedCurrencies: function () {
                    var arr = ['USD', 'EUR'];
                    arr.size = function () {
                        return arr.length;
                    };
                    return arr;
                },
                getCustomPreferenceValue: function(id) {
                    const value = global.customPreferences[id];
                    return value ? value : null;
                },
                getTimezone: function() {
                    return 'Europe/Paris';
                },
            };
        }
    }
}, {virtual: true});
jest.mock('dw/system/Status', () => {}, {virtual: true});
jest.mock('dw/system/System', () => {
    return {
        getCalendar: function() {
            return {
                getTime: function() {
                    return new Date();
                }
            }
        },
        getInstanceTimeZone: function() {
            return 'Europe/Paris';
        },
    }
}, {virtual: true});
jest.mock('dw/system/Transaction', () => {
    return {
        wrap: function(callback) { return callback(); },
    }
}, {virtual: true});
jest.mock('dw/util/Calendar', () => {
    return class CalendarMock {
        constructor() {
            this.time = new Date();
            this.timeZone = 'Europe/Paris';
        }
        getTime() {
            return this.time;
        }
        setTime(date) {
            this.time = date;
        }
        setTimeZone(timeZone) {
            this.timeZone = timeZone;
        }
        getTimeZone() {
            return this.timeZone;
        }
    }
}, {virtual: true});
jest.mock('dw/util/Currency', () => {
    const currencies = {
        USD: { currencyCode: 'USD' },
        EUR: { currencyCode: 'EUR' },
    }
    return {
        getCurrency: function (currency) { return currencies[currency]; }
    }
}, {virtual: true});

jest.mock('dw/web/CSRFProtection', () => {
    return {
        generateToken: function() {
            return 'csrfToken';
        }
    }
}, {virtual: true});
jest.mock('dw/util/ArrayList', () => {
    return jest.requireActual('./test/mocks/dw/util/ArrayList');
}, {virtual: true});
jest.mock('dw/util/StringUtils', () => {
    return {
        trim: function (str) { return str; },
        formatCalendar: function(str1, str2) { return str1; },
    }
}, {virtual: true});
jest.mock('dw/web/Resource', () => {
    return {
        msg: function() {}
    }
}, {virtual: true});
jest.mock('dw/web/URLUtils', () => {
    return {
        https: function(endpoint, param, id) {
            var absURL = 'https://test.commercecloud.salesforce.com/on/demandware.store/Sites-Algolia_SFRA-Site/';
            return absURL + global.request.getLocale() + '/' + endpoint + '?' + param + '=' + id;
        },
        http: function(endpoint, param, id) {
            var absURL = 'http://test.commercecloud.salesforce.com/on/demandware.store/Sites-Algolia_SFRA-Site/';
            return absURL + global.request.getLocale() + '/' + endpoint + '?' + param + '=' + id;
        },
        httpsStatic: function(url) {
            return 'https://test.commercecloud.salesforce.com/on/demandware.static/-/Library-Sites-test/default/testversion/' + url;
        },
        url: function(endpoint, param, id) {
            var relURL = '/on/demandware.store/Sites-Algolia_SFRA-Site/';
            relURL += global.request.getLocale() + '/' + endpoint + '?' + param + '=' + id;
            if (arguments[3] && arguments[4]) {
                relURL += '&' + arguments[3] + '=' + arguments[4];
            }
            return relURL;
        },
        staticURL: function(url) {
            return url;
        }
    }
}, {virtual: true});

// Mocked libraries, to be rewritten with `requireActual()`
jest.mock('*/cartridge/scripts/algolia/helper/logHelper', () => {
    return {
        getLogData: function() {
            return {};
        },
        setLogData: function() {}
    }
}, {virtual: true});
jest.mock('*/cartridge/scripts/services/algoliaIndexingService', () => {}, {virtual: true});

// The following are not mocks, it points SFCC relative requires to the actual files
// https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/usingjavascriptmodules.html#path-lookup-behavior-of-the-require-method
jest.mock('*/algoliaconfig', () => {
    return jest.requireActual('./cartridges/int_algolia/algoliaconfig');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/customization/productModelCustomizer', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/customization/productModelCustomizer');
}, {virtual: true});

jest.mock('*/cartridge/scripts/algolia/filters/productFilter', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');
}, {virtual: true});

jest.mock('*/cartridge/scripts/algolia/helper/AlgoliaJobReport', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/helper/AlgoliaJobReport');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/helper/CPObjectIterator', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/helper/CPObjectIterator');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/helper/fileHelper', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/helper/fileHelper');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/helper/jobHelper', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/helper/jobHelper');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/helper/modelHelper', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/helper/modelHelper');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/helper/objectHelper', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/helper/objectHelper');
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
            return id === 'AdditionalAttributes'
                ? ['url', 'UPC', 'searchable', 'variant', 'color', 'refinementColor', 'size', 'refinementSize', 'brand', 'online', 'pageDescription', 'pageKeywords',
                    'pageTitle', 'short_description', 'name', 'long_description', 'image_groups']
                : [];
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

jest.mock('*/cartridge/scripts/algolia/lib/contentUtil', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/lib/contentUtil');
}, {virtual: true});

jest.mock('dw/experience/PageMgr', () => {
    class PageMock {
        constructor() {
            this.id = 'mockPage';
            this.typeID = 'storePage';
            this.regions = {
                mockRegion: {
                    visibleComponents: [
                        {
                            id: 'richText',
                            testAttribute: 'testValue',
                        },
                        { id: 'mockComponent2' },
                    ],
                },
            };
        }

        getRegion() {
            return this.regions['mockRegion'];
        }

        getAttribute(id) {
            switch(id) {
                case 'richText':
                    return 'testValue';
                default:
                    return 'default'
            }
        }

        getPage() {
            return this;
        }
    }

    return {
        getPage: jest.fn().mockImplementation((id) => {
            return new PageMock()
        }),
    };
}, {virtual: true});

jest.mock('dw/campaign/PromotionMgr', () => {
    return {
        getPromotion: jest.fn(),
        getActivePromotions: jest.fn(),
    }
}, {virtual: true});
