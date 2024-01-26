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
    }

    getOnlineCategories() {
        return []; // Categories are assigned on the master
    }

    getPriceModel() {
        const currency = request.getSession().getCurrency();
        switch (currency.currencyCode) {
            case 'USD':
                return {
                    price: {
                        available: true,
                        currencyCode: 'USD',
                        value: 129,
                    },
                };
            case 'EUR':
                return {
                    price: {
                        available: true,
                        currencyCode: 'EUR',
                        value: 92.88,
                    },
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
