'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

var GlobalMock = require('../../../../../mocks/global');
var ProductMock = require('../../../../../mocks/dw/catalog/Variant');
var algoliaProductConfig = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaProductConfig');
var algoliaUtils = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/utils');

global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

var AlgoliaProduct = proxyquire('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaProduct', {
    'dw/system/Site': {
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
    },
    'dw/util/Currency': {
        getCurrency: function (currency) { return currency; }
    },
    'dw/util/StringUtils': {
        trim: function (str) { return str; }
    },
    'dw/web/URLUtils': {

        url: function(endpoint, param, id) {
            var relURL = '/on/demandware.store/Sites-Algolia_SFRA-Site/';
            return relURL + request.getLocale() + '/' + endpoint + '?' + param + '=' + id;
        }
    },
    '*/cartridge/scripts/algolia/lib/algoliaData': {
        getSetOfArray: function (id) {
            return id === 'CustomFields'
                ? ['url', 'UPC', 'searchable', 'variant', 'color', 'refinementColor', 'size', 'refinementSize', 'brand', 'online', 'pageDescription', 'pageKeywords',
                    'pageTitle', 'short_description', 'name', 'long_description', 'image_groups']
                : null;
        },
        getPreference: function (id) {
            return id === 'InStockThreshold' ? 1 : null;
        }
    },
    '*/cartridge/scripts/algolia/lib/utils': algoliaUtils,
    '*/cartridge/scripts/algolia/lib/algoliaProductConfig': algoliaProductConfig,
    '*/cartridge/scripts/algolia/customization/productModelCustomizer': {
        customizeProductModel: function (productModel) { return productModel; }
    }
});

describe('algoliaProduct module - Test Algolia Product model', function () {
    it('Check if the Algolia Product model is valid', function () {
        let product = new ProductMock({ variationAttributes: { color: 'JJB52A0', size: '004' } });
        let algoliaProductModel = {
            id: '701644031206M',
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
                        name: {
                            default: 'Womens',
                            fr: 'Femmes',
                            en: 'Womens'
                        }
                    }
                ],
                [
                    {
                        id: 'womens-clothing-bottoms',
                        name: {
                            default: 'Bottoms',
                            fr: 'Bas',
                            en: 'Bottoms'
                        }
                    },
                    {
                        id: 'womens-clothing',
                        name: {
                            default: 'Clothing',
                            fr: 'Vêtements',
                            en: 'Clothing'
                        },
                    },
                    {
                        id: 'womens',
                        name: {
                            default: 'Womens',
                            fr: 'Femmes',
                            en: 'Womens'
                        }
                    }
                ]
            ],
            brand: {
                default: null,
                fr: null,
                en: null
            },
            image_groups: [
                {
                    _type: 'image_group',
                    images: [
                        {
                            _type: 'image',
                            alt: {
                                default: 'Floral Dress, Hot Pink Combo, large',
                                fr: 'Robe florale, Combo rose vif, large',
                                en: 'Floral Dress, Hot Pink Combo, large'
                            },
                            dis_base_link: {
                                default: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg',
                                fr: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg',
                                en: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg'
                            },
                            title: {
                                default: 'Floral Dress, Hot Pink Combo',
                                fr: 'Robe florale, Combo rose vif',
                                en: 'Floral Dress, Hot Pink Combo'
                            }
                        },
                        {
                            _type: 'image',
                            alt: {
                                default: 'Floral Dress, Hot Pink Combo, large',
                                fr: 'Robe florale, Combo rose vif, large',
                                en: 'Floral Dress, Hot Pink Combo, large'
                            },
                            dis_base_link: {
                                default: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg',
                                fr: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg',
                                en: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg'
                            },
                            title: {
                                default: 'Floral Dress, Hot Pink Combo',
                                fr: 'Robe florale, Combo rose vif',
                                en: 'Floral Dress, Hot Pink Combo'
                            }
                        }
                    ],
                    view_type: 'large'
                },
                {
                    _type: 'image_group',
                    images: [
                        {
                            _type: 'image',
                            alt: {
                                default: 'Floral Dress, Hot Pink Combo, small',
                                fr: 'Robe florale, Combo rose vif, small',
                                en: 'Floral Dress, Hot Pink Combo, small'
                            },
                            dis_base_link: {
                                default: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg',
                                fr: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg',
                                en: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg'
                            },
                            title: {
                                default: 'Floral Dress, Hot Pink Combo',
                                fr: 'Robe florale, Combo rose vif',
                                en: 'Floral Dress, Hot Pink Combo'
                            }
                        },
                        {
                            _type: 'image',
                            alt: {
                                default: 'Floral Dress, Hot Pink Combo, small',
                                fr: 'Robe florale, Combo rose vif, small',
                                en: 'Floral Dress, Hot Pink Combo, small'
                            },
                            dis_base_link: {
                                default: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg',
                                fr: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg',
                                en: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg'
                            },
                            title: {
                                default: 'Floral Dress, Hot Pink Combo',
                                fr: 'Robe florale, Combo rose vif',
                                en: 'Floral Dress, Hot Pink Combo'
                            }
                        }
                    ],
                    view_type: 'small'
                }
            ],
            long_description: {
                default: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
                fr: 'Sentez la brise chaude dans cette robe portefeuille à imprimé floral polyvalent. Complétez ce look avec une superbe paire de sandales à lanières pour une soirée en ville.',
                en: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'
            },
            name: {
                default: 'Floral Dress',
                fr: 'Robe florale',
                en: 'Floral Dress'
            },
            online: true,
            pageDescription: {
                default: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
                fr: 'Sentez la brise chaude dans cette robe portefeuille à imprimé floral polyvalent. Complétez ce look avec une superbe paire de sandales à lanières pour une soirée en ville.',
                en: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'
            },
            pageKeywords: {
                default: null,
                fr: null,
                en: null
            },
            pageTitle: {
                default: 'Floral Dress',
                fr: 'Robe florale',
                en: 'Floral Dress'
            },
            searchable: true,
            short_description: {
                default: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
                fr: 'Sentez la brise chaude dans cette robe portefeuille à imprimé floral polyvalent. Complétez ce look avec une superbe paire de sandales à lanières pour une soirée en ville.',
                en: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'
            },
            url: {
                default: '/on/demandware.store/Sites-Algolia_SFRA-Site/default/Product-Show?pid=701644031206M',
                fr: '/on/demandware.store/Sites-Algolia_SFRA-Site/fr/Product-Show?pid=701644031206M',
                en: '/on/demandware.store/Sites-Algolia_SFRA-Site/en/Product-Show?pid=701644031206M'
            },
            UPC: '701644031206',
            variant: true,
            color: {
                default: 'Hot Pink Combo',
                fr: 'Combo rose vif',
                en: 'Hot Pink Combo'
            },
            refinementColor: {
                default: 'Pink',
                fr: 'Rose',
                en: 'Pink'
            },
            size: {
                default: '4',
                fr: '4',
                en: '4'
            },
            refinementSize: {
                default: '4',
                fr: '4',
                en: '4',
            },
        };
        assert.deepEqual(new AlgoliaProduct(product), algoliaProductModel);
    });
});
