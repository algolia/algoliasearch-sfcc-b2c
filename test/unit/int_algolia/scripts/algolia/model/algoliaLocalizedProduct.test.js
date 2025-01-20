'use strict';

var GlobalMock = require('../../../../../mocks/global');
var ProductMock = require('../../../../../mocks/dw/catalog/Variant');

global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

jest.mock('dw/system/Site', () => {
    return {
        getCurrent: function () {
            return {
                getAllowedLocales: function () {
                    var arr = ['default', 'fr', 'en'];
                    arr.size = function () {
                        return arr.length;
                    };
                    return arr;
                },
                getAllowedCurrencies: function () {
                    var arr = ['USD', 'EUR'];
                    arr.size = function () {
                        return arr.length;
                    };
                    return arr;
                }
            };
        }
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
        }
    }
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    return {
        getSetOfArray: function (id) {
            return id === 'AdditionalAttributes'
                ? ['url', 'UPC', 'searchable', 'variant', 'color', 'refinementColor', 'size', 'refinementSize', 'brand', 'online', 'pageDescription', 'pageKeywords',
                    'pageTitle', 'short_description', 'name', 'long_description', 'image_groups']
                : [];
        },
        getPreference: function (id) {
            switch (id) {
                case 'IndexOutofStock':
                    return true;
                case 'InStockThreshold':
                    return 1;
                default:
                    return [];
            }
        }
    }
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/lib/utils', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/utils');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/lib/algoliaProductConfig', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaProductConfig');
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/customization/productModelCustomizer', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/customization/productModelCustomizer');
}, {virtual: true});

const AlgoliaLocalizedProduct = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
const algoliaProductConfig = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaProductConfig')
const attributes = algoliaProductConfig.defaultAttributes_v2.concat(['url', 'UPC', 'searchable', 'variant', 'color', 'refinementColor', 'size', 'refinementSize', 'brand', 'online', 'pageDescription', 'pageKeywords',
    'pageTitle', 'short_description', 'name', 'long_description', 'image_groups', 'custom.algoliaTest', 'categoryPageId', 'primary_category_id', 'categories', '_tags']);

function setupMockConfig(customAttributes) {
    jest.resetModules();

    jest.doMock('*/cartridge/scripts/algolia/lib/algoliaProductConfig', () => {
        const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaProductConfig');
        const modifiedAttributeConfig_v2 = { ...originalModule.attributeConfig_v2 };

        Object.assign(modifiedAttributeConfig_v2, customAttributes);

        return {
            ...originalModule,
            attributeConfig_v2: modifiedAttributeConfig_v2
        };
    });
}

describe('algoliaLocalizedProduct', function () {
    test('default locale', function () {
        const product = new ProductMock({ variationAttributes: { color: 'JJB52A0', size: '004' }});
        const algoliaProductModel = {
            objectID: '701644031206M',
            in_stock: true,
            primary_category_id: 'womens-clothing-bottoms',
            price: {
                USD: 129,
                EUR: 92.88
            },
            categories: [
                [
                    {
                        id: 'newarrivals-womens',
                        name: 'Womens',
                    },
                    {
                        id: 'newarrivals',
                        name: 'New Arrivals',
                    }
                ],
                [
                    {
                        id: 'womens-clothing-bottoms',
                        name: 'Bottoms',
                    },
                    {
                        id: 'womens-clothing',
                        name: 'Clothing',
                    },
                    {
                        id: 'womens',
                        name: 'Womens',
                    }
                ]
            ],
            categoryPageId: [
                "newarrivals",
                "newarrivals-womens",
                "womens",
                "womens-clothing",
                "womens-clothing-bottoms",
            ],
            __primary_category: {
                0: 'Womens',
                1: 'Womens > Clothing',
                2: 'Womens > Clothing > Bottoms',
            },
            brand: null,
            image_groups: [
                {
                    _type: 'image_group',
                    images: [
                        {
                            _type: 'image',
                            alt: 'Floral Dress, Hot Pink Combo, large',
                            dis_base_link: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg',
                            title: 'Floral Dress, Hot Pink Combo',
                        },
                        {
                            _type: 'image',
                            alt: 'Floral Dress, Hot Pink Combo, large',
                            dis_base_link: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg',
                            title: 'Floral Dress, Hot Pink Combo',
                        }
                    ],
                    view_type: 'large'
                },
                {
                    _type: 'image_group',
                    images: [
                        {
                            _type: 'image',
                            alt: 'Floral Dress, Hot Pink Combo, small',
                            dis_base_link: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg',
                            title: 'Floral Dress, Hot Pink Combo',
                        },
                        {
                            _type: 'image',
                            alt: 'Floral Dress, Hot Pink Combo, small',
                            dis_base_link: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg',
                            title: 'Floral Dress, Hot Pink Combo',
                        }
                    ],
                    view_type: 'small'
                }
            ],
            long_description: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
            name: 'Floral Dress',
            online: true,
            pageDescription: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
            pageKeywords: null,
            pageTitle: 'Floral Dress',
            searchable: true,
            short_description: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
            url: '/on/demandware.store/Sites-Algolia_SFRA-Site/default/Product-Show?pid=701644031206M',
            UPC: '701644031206',
            variant: true,
            color: 'Hot Pink Combo',
            refinementColor: 'Pink',
            size: '4',
            refinementSize: '4',
            custom: {
                algoliaTest: 'default locale'
            },
            '_tags': ['id:701644031206M']
        };
        expect(
            new AlgoliaLocalizedProduct({
                product: product,
                locale: 'default',
                attributeList: attributes,
            })
        ).toEqual(algoliaProductModel);
    });

    test('fr locale', function () {
        const product = new ProductMock({ variationAttributes: { color: 'JJB52A0', size: '004' }});
        const algoliaProductModel = {
            objectID: '701644031206M',
            in_stock: true,
            primary_category_id: 'womens-clothing-bottoms',
            price: {
                USD: 129,
                EUR: 92.88
            },
            categories: [
                [
                    {
                        id: 'newarrivals-womens',
                        name: 'Femmes',
                    },
                    {
                        id: 'newarrivals',
                        name: 'Nouveaux arrivages',
                    }
                ],
                [
                    {
                        id: 'womens-clothing-bottoms',
                        name: 'Bas',
                    },
                    {
                        id: 'womens-clothing',
                        name: 'Vêtements',
                    },
                    {
                        id: 'womens',
                        name: 'Femmes',
                    }
                ]
            ],
            categoryPageId: [
                "newarrivals",
                "newarrivals-womens",
                "womens",
                "womens-clothing",
                "womens-clothing-bottoms",
            ],
            __primary_category: {
                0: 'Femmes',
                1: 'Femmes > Vêtements',
                2: 'Femmes > Vêtements > Bas',
            },
            brand: null,
            image_groups: [
                {
                    _type: 'image_group',
                    images: [
                        {
                            _type: 'image',
                            alt: 'Robe florale, Combo rose vif, large',
                            dis_base_link: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg',
                            title: 'Robe florale, Combo rose vif',
                        },
                        {
                            _type: 'image',
                            alt: 'Robe florale, Combo rose vif, large',
                            dis_base_link: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg',
                            title: 'Robe florale, Combo rose vif',
                        }
                    ],
                    view_type: 'large'
                },
                {
                    _type: 'image_group',
                    images: [
                        {
                            _type: 'image',
                            alt: 'Robe florale, Combo rose vif, small',
                            dis_base_link: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg',
                            title: 'Robe florale, Combo rose vif',
                        },
                        {
                            _type: 'image',
                            alt: 'Robe florale, Combo rose vif, small',
                            dis_base_link: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg',
                            title: 'Robe florale, Combo rose vif',
                        }
                    ],
                    view_type: 'small'
                }
            ],
            long_description: 'Sentez la brise chaude dans cette robe portefeuille à imprimé floral polyvalent. Complétez ce look avec une superbe paire de sandales à lanières pour une soirée en ville.',
            name: 'Robe florale',
            online: true,
            pageDescription: 'Sentez la brise chaude dans cette robe portefeuille à imprimé floral polyvalent. Complétez ce look avec une superbe paire de sandales à lanières pour une soirée en ville.',
            pageKeywords: null,
            pageTitle: 'Robe florale',
            searchable: true,
            short_description: 'Sentez la brise chaude dans cette robe portefeuille à imprimé floral polyvalent. Complétez ce look avec une superbe paire de sandales à lanières pour une soirée en ville.',
            url: '/on/demandware.store/Sites-Algolia_SFRA-Site/fr/Product-Show?pid=701644031206M',
            UPC: '701644031206',
            variant: true,
            color: 'Combo rose vif',
            refinementColor: 'Rose',
            size: '4',
            refinementSize: '4',
            custom: {
                algoliaTest: 'fr locale'
            },
            '_tags': ['id:701644031206M']
        };
        expect(
            new AlgoliaLocalizedProduct({
                product: product,
                locale: 'fr',
                attributeList: attributes,
            })
        ).toEqual(algoliaProductModel);
    });

    test('attributeListOverride', function () {
        const product = new ProductMock();
        const algoliaProductModel = {
            objectID: '701644031206M',
            price: {
                USD: 129,
                EUR: 92.88
            },
        };
        expect(new AlgoliaLocalizedProduct({ product: product, locale: undefined, attributeList: ['price'] })).toEqual(algoliaProductModel);
    });

    test('baseModel', function () {
        const product = new ProductMock();
        const baseModel = {
            UPC: 'Test UPC',
            price: {
                USD: 1,
                EUR: 0.93
            },
            name: 'Test name',
        }
        const expectedProductModel = {
            objectID: '701644031206M',
            UPC: 'Test UPC',
            price: {
                USD: 1,
                EUR: 0.93
            },
            name: 'Test name',
        };
        expect(new AlgoliaLocalizedProduct({ product: product, locale: 'default', attributeList: ['price', 'UPC', 'name'], baseModel: baseModel })).toEqual(expectedProductModel);
    });

    test('pricebooks', function () {
        const product = new ProductMock();
        const expected = {
            objectID: '701644031206M',
            pricebooks: {
                USD: [{
                    price: 132,
                    pricebookID: 'list-prices-usd',
                    onlineFrom: undefined,
                    onlineTo: undefined,
                }, {
                    price: 129,
                    pricebookID: 'sale-prices-usd',
                    onlineFrom: undefined,
                    onlineTo: undefined,
                }],
                EUR: [{
                    price: 94,
                    pricebookID: 'list-prices-eur',
                    onlineFrom: undefined,
                    onlineTo: undefined,
                }, {
                    price: 92.88,
                    pricebookID: 'sale-prices-eur',
                    onlineFrom: 1704067200000,
                    onlineTo: undefined,
                }],
            },
        };
        expect(new AlgoliaLocalizedProduct({ product: product, attributeList: ['pricebooks'] })).toEqual(expected);
    });
});


describe('algoliaLocalizedProduct default custom attribute logic', function () {
    test('Base Product default custom attribute logic', function () {
        const product = new ProductMock();
        const expected = {
            objectID: '701644031206M',
            custom: {
                algoliaTest: 'default locale',
                displaySize: '14cm',
                deeply: { nested: 'nestedValue' },
            }
        };
        expect(new AlgoliaLocalizedProduct({
            product: product,
            locale: 'default',
            attributeList: ['custom.algoliaTest', 'custom.displaySize', 'custom.deeply.nested']
        })).toEqual(expected);
    });

    test('default attribute configuration logic with baseModel', function () {
        const product = new ProductMock();
        const baseModel = {
            custom: {
                algoliaTest: 'value from base model',
                deeply: {
                    nested: 'value from base model',
                }
            }
        }
        const expected = {
            objectID: '701644031206M',
            custom: {
                algoliaTest: 'value from base model',
                deeply: { nested: 'value from base model' },
            }
        };
        expect(new AlgoliaLocalizedProduct({
            product: product,
            baseModel: baseModel,
            attributeList: ['custom.algoliaTest', 'custom.deeply.nested'],
        })).toEqual(expected);
    });

    test('algoliaLocalizedProduct default custom attribute logic for fr locale', function () {
        const product = new ProductMock();
        const baseModel = {
            objectID: '701644031206M',
            custom: {
                algoliaTest: 'default locale',
                displaySize: '14cm'
            }
        }

        const expected = {
            objectID: '701644031206M',
            name: 'Robe florale',
            custom: {
                algoliaTest: 'default locale',
                displaySize: '14cm'
            }
        }

        // Because default config is localized:false, we are expecting to have the default locale in the record
        expect(new AlgoliaLocalizedProduct({ product: product, locale: 'fr', attributeList: ['custom.algoliaTest', 'custom.displaySize', 'name'], baseModel: baseModel})).toEqual(expected);
    });
});


describe('algoliaLocalizedProduct overriding custom attributes', function () {
    afterEach(() => {
        jest.resetModules();
    });

    test('algoliaLocalizedProduct overrided custom attribute logic for fr locale (Nested attributes)', function () {
        setupMockConfig({
            'custom.algoliaTest': {
                attribute: 'custom.algoliaTest',
                localized: true,
                variantAttribute: false
            }
        });
        const AlgoliaLocalizedProductModel = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedProduct');

        const product = new ProductMock();
        const baseModel =  new AlgoliaLocalizedProductModel({ product: product, locale: 'default', attributeList: ['custom.displaySize'] });
        const expectedProductModel = {
            objectID: '701644031206M',
            custom: {
                algoliaTest: 'fr locale',
                displaySize: '14cm'
            }
        };

        expect(new AlgoliaLocalizedProductModel({ product: product, locale: 'fr', attributeList: ['custom.algoliaTest', 'custom.displaySize'], baseModel: baseModel})).toEqual(expectedProductModel);
    });

    test('algoliaLocalizedProduct overrided custom attribute logic for fr locale (Non-nested attributes)', function () {
        setupMockConfig({
            'algoliaTest': {
                attribute: 'custom.algoliaTest',
                localized: true,
                variantAttribute: true
            }
        });
        const AlgoliaLocalizedProductModel = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedProduct');

        const product = new ProductMock();
        const baseModel =  new AlgoliaLocalizedProductModel({ product: product, locale: 'default', attributeList: ['custom.displaySize'] });
        const expectedProductModel = {
            objectID: '701644031206M',
            custom: {
                displaySize: '14cm'
            },
            algoliaTest: 'fr locale',
        };

        expect(new AlgoliaLocalizedProductModel({ product: product, locale: 'fr', attributeList: ['algoliaTest', 'custom.displaySize'], baseModel: baseModel})).toEqual(expectedProductModel);
    });
});

describe('IndexOutofStock logic tests', function () {
    var ProductMockObj;

    beforeEach(() => {
        jest.resetModules();
        ProductMockObj = require('../../../../../mocks/dw/catalog/Variant');
    });

    test('should skip out-of-stock variants if IndexOutofStock = false', function () {
        jest.doMock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
            return {
                getSetOfArray: function () {
                    return []; 
                },
                getPreference: function (id) {
                    if (id === 'InStockThreshold') return 1;
                    if (id === 'IndexOutofStock') return false;
                    return null;
                }
            };
        }, { virtual: true });


        const product = new ProductMockObj({
            inventory: { atsValue: 0 }
        });

        const localizedProduct = new AlgoliaLocalizedProduct({ product, attributeList: ['objectID'] });

        expect(localizedProduct.objectID).toBeNull();
    });

    test('should index out-of-stock variants if IndexOutofStock = true', function () {
        jest.doMock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
            return {
                getSetOfArray: function () {
                    return []; 
                },
                getPreference: function (id) {
                    if (id === 'InStockThreshold') return 1;
                    if (id === 'IndexOutofStock') return true; 
                    return null;
                }
            };
        }, { virtual: true });

        const product = new ProductMockObj({
            inventory: { atsValue: 0 }
        });

        const localizedProduct = new AlgoliaLocalizedProduct({ product, attributeList: ['objectID'] });

        expect(localizedProduct).not.toBeNull();
    });
});
