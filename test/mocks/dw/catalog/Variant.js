const MasterProduct = require('./MasterProduct');
const ProductVariationModel = require("./ProductVariationModel");
const { createMoney } = require('../../helpers/moneyHelper');

// https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_Variant.html
class Variant extends MasterProduct {
    constructor({ ID, variationAttributes, masterProduct, ats = 6, online = true, searchable = true, activeData } = {}) {
        super({ ID: ID || '701644031206M', activeData });
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
            'sale-prices-usd': createMoney(129, 'USD', true),
            'list-prices-usd': createMoney(132, 'USD', true),
            'sale-prices-eur': createMoney(92.88, 'EUR', true),
            'list-prices-eur': createMoney(94, 'EUR', true),
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
        const prices = this.prices;
        return {
            price,
            getPrice: () => price,
            getMinPrice: () => price,
            getPriceBookPriceInfo: (priceBookID) => {
                const priceBookPrice = prices[priceBookID];
                const onlineFrom = priceBookID === 'sale-prices-eur'
                    ? { getTime: () => 1704067200000 }
                    : undefined;
                return {
                    price: priceBookPrice,
                    onlineFrom: onlineFrom,
                    getPrice: () => priceBookPrice,
                    getOnlineFrom: () => onlineFrom,
                    getOnlineTo: () => undefined,
                };
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
