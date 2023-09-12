'use strict';

var GlobalMock = require('../../../../../mocks/global');
var ProductMock = require('../../../../../mocks/dw/catalog/Product');

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
                    var arr = [
                        { currencyCode: 'USD' },
                        { currencyCode: 'EUR' }
                    ];
                    arr.size = function () {
                        return arr.length;
                    };
                    return arr;
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
        }
    }
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    return {
        getSetOfArray: function (id) {
            return id === 'CustomFields'
                ? ['url', 'UPC', 'searchable', 'variant', 'color', 'refinementColor', 'size', 'refinementSize', 'brand', 'online', 'pageDescription', 'pageKeywords',
                    'pageTitle', 'short_description', 'name', 'long_description', 'image_groups']
                : null;
        },
        getPreference: function (id) {
            return id === 'InStockThreshold' ? 1 : null;
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
    return {
        customizeProductModel: function (productModel) { return productModel; }
    }
}, {virtual: true});

const AlgoliaLocalizedProduct = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedProduct');

describe('algoliaLocalizedProduct', function () {
    test('default locale', function () {
        let product = new ProductMock();
        let algoliaProductModel = {
            id: '701644031206M',
            in_stock: true,
            primary_category_id: 'womens',
            price: {
                USD: 129,
                EUR: 92.88
            },
            categories: [
                [
                    {
                        id: 'newarrivals-womens',
                        name: 'Womens',
                    }
                ],
                [
                    {
                        id: 'womens-clothing-bottoms',
                        name: 'Bottoms',
                    }
                ]
            ],
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
        };
        expect(new AlgoliaLocalizedProduct(product)).toEqual(algoliaProductModel);
    });

    test('fr locale', function () {
        let product = new ProductMock();
        let algoliaProductModel = {
            id: '701644031206M',
            in_stock: true,
            primary_category_id: 'womens',
            price: {
                USD: 129,
                EUR: 92.88
            },
            categories: [
                [
                    {
                        id: 'newarrivals-womens',
                        name: 'Femmes',
                    }
                ],
                [
                    {
                        id: 'womens-clothing-bottoms',
                        name: 'Bas',
                    }
                ]
            ],
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
        };
        expect(new AlgoliaLocalizedProduct(product, 'fr')).toEqual(algoliaProductModel);
    });

    test('en locale + fieldListOverride', function () {
        let product = new ProductMock();
        let algoliaProductModel = {
            id: '701644031206M',
            price: {
                USD: 129,
                EUR: 92.88
            },
        };
        expect(new AlgoliaLocalizedProduct(product, 'fr', ['id', 'price'])).toEqual(algoliaProductModel);
    });
});
