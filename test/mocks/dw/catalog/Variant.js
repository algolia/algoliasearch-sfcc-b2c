const MasterProduct = require('./MasterProduct');
const ProductVariationModel = require("./ProductVariationModel");

// https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_Variant.html
class Variant extends MasterProduct {
    constructor({ ID, variationAttributes, masterProduct, ats = 6, online = true, searchable = true } = {}) {
        super({ ID: ID || '701644031206M' });
        this.master = false;
        this.variant = true;
        this.masterProduct = masterProduct || new MasterProduct();
        this.variationAttributes = variationAttributes;
        this.UPC = '701644031206';
        this.online = online;
        this.searchable = searchable;
        this._ats = ats;

        this.custom = {
            refinementColor: {
                get displayValue() {
                    switch (request.getLocale()) {
                        case 'fr':
                            return 'Rose';
                        case 'default':
                        case 'en':
                        default:
                            return 'Pink';
                    }
                }
            },
            size: null,
            color: null,
            displaySize: '14cm',
            refinementSize: '4',
            get algoliaTest() {
                switch (request.getLocale()) {
                    case 'fr':
                        return 'fr locale';
                    case 'default':
                        return 'default locale';
                    case 'en':
                    default:
                        return '';
                }
            },
            deeply: {
                nested: 'nestedValue',
            },
        };

        this.prices = {
            'sale-prices-usd': {
                available: true,
                currencyCode: 'USD',
                value: 129,
            },
            'list-prices-usd': {
                available: true,
                currencyCode: 'USD',
                value: 132,
            },
            'sale-prices-eur': {
                available: true,
                currencyCode: 'EUR',
                value: 92.88,
            },
            'list-prices-eur': {
                available: true,
                currencyCode: 'EUR',
                value: 94,
            }
        }
    }

    getOnlineCategories() {
        return []; // Categories are assigned on the master
    }

    getAvailabilityModel() {
        return {
            getInventoryRecord: () => {
                return {
                    getATS: () => {
                        return {
                            getValue: () => {
                                return this._ats;
                            }
                        };
                    }
                };
            }
        };
    }

    getMasterProduct() {
        return this.masterProduct;
    }

    getPriceModel() {
        const currency = request.getSession().getCurrency();
        let price;
        switch (currency.currencyCode) {
            case 'USD':
                price = this.prices['sale-prices-usd'];
                break;
            case 'EUR':
                price = this.prices['sale-prices-eur'];
                break;
            default:
                return null;
        }
        return {
            price,
            getPriceBookPriceInfo: (priceBookID) => {
                const priceInfo = {
                    price: this.prices[priceBookID],
                }
                if (priceBookID === 'sale-prices-eur') {
                    priceInfo.onlineFrom = {
                        getTime: () => 1704067200000,
                    }
                }
                return priceInfo;
            }
        }
    }

    getVariationModel() {
        return new ProductVariationModel({
            productID: this.ID,
            master: this.masterProduct,
            images: this.images,
            variationAttributes: this.variationAttributes,
        });
    }
}

module.exports = Variant;
