'use strict';

// https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_Product.html
// Base Product mock for standard products (neither master nor variant)
class Product {
    constructor(props = {}) {
        // Set defaults first (excluding properties that have getters)
        const {priceModel, custom, ...otherProps} = props;
        Object.assign(this, {
            ID: 'simple-product-001',
            assignedToSiteCatalog: true,
            brand: null,
            images: [],
            online: true,
            searchable: true,
            master: false,
            variant: false,
            variationGroup: false,
            bundled: false,
            pageKeywords: null,
            UPC: '123456789'
        }, otherProps);

        // Set up custom attributes
        this.custom = {
            algoliaTest: 'test value',
            ...custom
        };

        // Set up internal priceModel for the getter to use
        this._priceModel = priceModel || null;
    }

    get name() {
        return this.getName();
    }

    getName() {
        switch (request.getLocale()) {
            case 'fr':
                return 'Produit Simple';
            case 'default':
            case 'en':
            default:
                return 'Simple Product';
        }
    }

    get pageDescription() {
        return this.getPageDescription();
    }

    getPageDescription() {
        switch (request.getLocale()) {
            case 'fr':
                return 'Description du produit simple';
            case 'default':
            case 'en':
            default:
                return 'Simple product description';
        }
    }

    get pageTitle() {
        return this.getPageTitle();
    }

    getPageTitle() {
        return this.getName();
    }

    get longDescription() {
        return this.getLongDescription();
    }

    get shortDescription() {
        return this.getShortDescription();
    }

    getShortDescription() {
        return this.getLongDescription();
    }

    getLongDescription() {
        switch (request.getLocale()) {
            case 'fr':
                return { source: 'Description longue du produit simple' };
            case 'default':
            case 'en':
            default:
                return { source: 'Long description of simple product' };
        }
    }

    get priceModel() {
        return this.getPriceModel();
    }

    getPriceModel() {
        if (this.bundled && !(this._priceModel && this._priceModel.price && this._priceModel.price.available)) {
            return null;
        }
        return this._priceModel || {
            price: {
                available: true,
                currencyCode: request.getSession().getCurrency().currencyCode,
                value: 99.99
            }
        };
    }

    isAssignedToSiteCatalog() {
        return this.assignedToSiteCatalog;
    }

    isMaster() {
        return this.master;
    }

    isVariant() {
        return this.variant;
    }

    isVariationGroup() {
        return this.variationGroup;
    }

    get availabilityModel() {
        return this.getAvailabilityModel();
    }

    getAvailabilityModel() {
        return {
            getInventoryRecord: () => {
                return {
                    getATS: () => {
                        return {
                            getValue: () => 5
                        };
                    }
                };
            }
        };
    }

    getOnlineCategories() {
        // Standard products have categories
        return [
            {
                ID: 'standard-category',
                displayName: 'Standard Category',
                online: true,
                root: false
            }
        ];
    }

    getMasterProduct() {
        // Standard products don't have master products
        return null;
    }

    getVariants() {
        // Standard products don't have variants
        return {
            size: () => 0,
            iterator: () => ({
                hasNext: () => false,
                next: () => null
            })
        };
    }
}

module.exports = Product;