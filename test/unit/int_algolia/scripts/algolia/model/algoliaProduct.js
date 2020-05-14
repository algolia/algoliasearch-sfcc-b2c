'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

var GlobalMock = require('../../../../../mocks/global');
var ProductMock = require('../../../../../mocks/dw/catalog/Product');
var StringUtils = require('../../../../../mocks/dw/util/StringUtils');

global.empty = GlobalMock.empty;
global.request = GlobalMock.request;

/*
var GlobalMock = require('../../../../../mocks/global');
var PaymentInstrumentMock = require('../../../../../mocks/dw/order/PaymentInstrument');
var CustomerMock = require('../../../../../mocks/dw/customer/Customer');
var TransactionMock = require('../../../../../mocks/dw/system/Transaction');
var LoggerMock = require('../../../../../mocks/dw/system/Logger');
var BasketMgrMock = require('../../../../../mocks/dw/order/BasketMgr');

global.session = GlobalMock.session;
global.request = GlobalMock.request;
*/

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
                }
            };
        }
    },
    'dw/util/Currency': {},
    'dw/util/StringUtils': StringUtils,
    'dw/web/URLUtils': {},
    '*/cartridge/scripts/algolia/lib/algoliaData': {
        getSetOfArray: function (id) {
            var result = null;
            switch (id) {
                case 'CustomFields':
                    result = ['UPC', 'searchable', 'variant', 'color', 'size', 'brand'];
                    break;
                default:
                    break;
            }
            return result;
        },
        getPreference: function (id) {
            var result = null;
            switch (id) {
                case 'InStockThreshold':
                    result = 1;
                    break;
                default:
                    break;
            }
            return result;
        }
    },
    '*/cartridge/scripts/algolia/model/algoliaProductConfig': {
        defaultAttributes: ['id', 'primary_category_id', 'in_stock'],
        attributeConfig: {
            brand: {
                attribute: 'brand',
                localized: true
            },
            id: {
                attribute: 'ID',
                localized: false
            },
            primary_category_id: {
                attribute: 'primaryCategory.ID',
                localized: false
            },
            in_stock: {
                attribute: 'availabilityModel.inStock',
                localized: false
            },
            UPC: {
                attribute: 'UPC',
                localized: false
            },
            variant: {
                attribute: 'variant',
                localized: false
            },
            searchable: {
                attribute: 'searchable',
                localized: false
            },
            color: {
                localized: true
            },
            size: {
                localized: true
            }
        }
    }
});

describe('algiliaProduct module - Test Algolia Product model', function () {
    it('Checking Algolia Product model is valid', function () {
        console.log(request.getLocale());
        let product = new ProductMock();
        let algiliaProductModel = {
            id: '701644031206M',
            in_stock: true,
            primary_category_id: 'womens',
            price: {
                USD: 129,
                EUR: 92.88
            },
            сategories: [
                [
                    {
                        id: 'newarrivals-womens',
                        name: {
                            default: 'Womens',
                            fr: 'Womens',
                            en: 'Womens'
                        }
                    },
                    {
                        id: 'newarrivals',
                        name: {
                            default: 'New Arrivals',
                            fr: 'New Arrivals',
                            en: 'New Arrivals'
                        }
                    }
                ],
                [
                    {
                        id: 'womens-clothing-bottoms',
                        name: {
                            default: 'Bottoms',
                            fr: 'Bottoms',
                            en: 'Bottoms'
                        }
                    },
                    {
                        id: 'womens-clothing',
                        name: {
                            default: 'Clothing',
                            fr: 'Clothing',
                            en: 'Clothing'
                        }
                    },
                    {
                        id: 'womens',
                        name: {
                            default: 'Womens',
                            fr: 'Womens',
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
                                fr: 'Floral Dress, Hot Pink Combo, large',
                                en: 'Floral Dress, Hot Pink Combo, large'
                            },
                            dis_base_link: {
                                default: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg',
                                fr: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg',
                                en: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg'
                            },
                            title: {
                                default: 'Floral Dress, Hot Pink Combo',
                                fr: 'Floral Dress, Hot Pink Combo',
                                en: 'Floral Dress, Hot Pink Combo'
                            }
                        },
                        {
                            _type: 'image',
                            alt: {
                                default: 'Floral Dress, Hot Pink Combo, large',
                                fr: 'Floral Dress, Hot Pink Combo, large',
                                en: 'Floral Dress, Hot Pink Combo, large'
                            },
                            dis_base_link: {
                                default: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg',
                                fr: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg',
                                en: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg'
                            },
                            title: {
                                default: 'Floral Dress, Hot Pink Combo',
                                fr: 'Floral Dress, Hot Pink Combo',
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
                                fr: 'Floral Dress, Hot Pink Combo, small',
                                en: 'Floral Dress, Hot Pink Combo, small'
                            },
                            dis_base_link: {
                                default: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg',
                                fr: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg',
                                en: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg'
                            },
                            title: {
                                default: 'Floral Dress, Hot Pink Combo',
                                fr: 'Floral Dress, Hot Pink Combo',
                                en: 'Floral Dress, Hot Pink Combo'
                            }
                        },
                        {
                            _type: 'image',
                            alt: {
                                default: 'Floral Dress, Hot Pink Combo, small',
                                fr: 'Floral Dress, Hot Pink Combo, small',
                                en: 'Floral Dress, Hot Pink Combo, small'
                            },
                            dis_base_link: {
                                default: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg',
                                fr: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg',
                                en: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg'
                            },
                            title: {
                                default: 'Floral Dress, Hot Pink Combo',
                                fr: 'Floral Dress, Hot Pink Combo',
                                en: 'Floral Dress, Hot Pink Combo'
                            }
                        }
                    ],
                    view_type: 'small'
                }
            ],
            long_description: {
                default: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
                fr: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
                en: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'
            },
            name: {
                default: 'Floral Dress',
                fr: 'Floral Dress',
                en: 'Floral Dress'
            },
            online: true,
            pageDescription: {
                default: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
                fr: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
                en: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'
            },
            pageKeywords: {
                default: null,
                fr: null,
                en: null
            },
            pageTitle: {
                default: 'Floral Dress',
                fr: 'Floral Dress',
                en: 'Floral Dress'
            },
            searchable: true,
            short_description: {
                default: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
                fr: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
                en: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'
            },
            url: {
                default: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.store/Sites-Algolia_SFRA-Site/default/Product-Show?pid=701644031206M',
                fr: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.store/Sites-Algolia_SFRA-Site/fr/Product-Show?pid=701644031206M',
                en: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.store/Sites-Algolia_SFRA-Site/en/Product-Show?pid=701644031206M'
            },
            UPC: '701644031206',
            variant: true,
            color: {
                default: 'Hot Pink Combo',
                fr: 'Hot Pink Combo',
                en: 'Hot Pink Combo'
            },
            size: {
                default: '4',
                fr: '4',
                en: '4'
            }
        };
        assert.deepEqual(new AlgoliaProduct(product), algiliaProductModel);
    });
});
