// Initialize some default mocks for all tests.

// System classes
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
},
{virtual: true});
jest.mock('dw/system/Status', () => {}, {virtual: true});
jest.mock('dw/system/Transaction', () => {}, {virtual: true});
jest.mock('dw/system/System', () => {}, {virtual: true});
jest.mock('dw/web/Resource', () => {
    return {
        msg: function() {}
    }
}, {virtual: true});

// The following are not mocks, it points SFCC relative requires to the actual files
// https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/usingjavascriptmodules.html#path-lookup-behavior-of-the-require-method
jest.mock('*/cartridge/scripts/algolia/customization/productModelCustomizer', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/customization/productModelCustomizer');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/filters/productFilter', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/filters/productFilter');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/helper/jobHelper', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/helper/jobHelper');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/helper/sendHelper', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/helper/sendHelper');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/lib/algoliaProductConfig', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaProductConfig');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/lib/utils', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/lib/utils');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/lib/algoliaConstants', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaConstants');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct', () => {
    return jest.requireActual('./cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
}, {virtual: true});
