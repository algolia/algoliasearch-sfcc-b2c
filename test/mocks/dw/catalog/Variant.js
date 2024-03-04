const MasterProduct = require('./MasterProduct');
const ProductVariationModel = require("./ProductVariationModel");

// https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_Variant.html
class Variant extends MasterProduct {
    constructor({ ID, variationAttributes, masterProduct } = {}) {
        super({ ID: ID || '701644031206M' });
        this.master = false;
        this.variant = true;
        this.masterProduct = masterProduct || new MasterProduct();
        this.variationAttributes = variationAttributes;
        this.UPC = '701644031206';

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
            refinementSize: '4',
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

    getPriceModel() {
        const currency = request.getSession().getCurrency();
        switch (currency.currencyCode) {
            case 'USD':
                return {
                    price: this.prices['sale-prices-usd'],
                    getPriceBookPriceInfo: (priceBookID) => {
                        return {
                            price: this.prices[priceBookID],
                        }
                    }
                };
            case 'EUR':
                return {
                    price: this.prices['sale-prices-eur'],
                    getPriceBookPriceInfo: (priceBookID) => {
                        return {
                            price: this.prices[priceBookID],
                        }
                    }
                };
            default:
                return null;
        }
    }

    getVariationModel() {
        return new ProductVariationModel({
            productID: this.ID,
            images: this.images,
            variationAttributes: this.variationAttributes,
        });
    }
}

module.exports = Variant;
