const ProductVariationModel = require('./ProductVariationModel');
const collectionHelper = require('../../helpers/collectionHelper');

// https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_Product.html
// The instantiated product is a master product.
class Product {
    constructor({ ID } = {}) {
        this.ID = ID || '25592581M';
        this.assignedToSiteCatalog = true;
        this.brand = null;
        this.images = PRODUCT_IMAGES;
        this.online = true;
        this.searchable = true;
        this.master = true;
        this.pageKeywords = null;
        this.variant = false;
        this.defaultVariant = null;
        this.variants = collectionHelper.createCollection([]);
    }

    get name() {
        return this.getName();
    }
    getName() {
        switch (request.getLocale()) {
            case 'fr':
                return 'Robe florale';
            case 'default':
            case 'en':
            default:
                return 'Floral Dress';
        }
    }

    get pageDescription() {
        return this.getPageDescription();
    }
    getPageDescription() {
        switch (request.getLocale()) {
            case 'fr':
                return 'Sentez la brise chaude dans cette robe portefeuille à imprimé floral polyvalent. Complétez ce look avec une superbe paire de sandales à lanières pour une soirée en ville.';
            case 'default':
            case 'en':
            default:
                return 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.';
        }
    }

    get pageTitle() {
        return this.getPageTitle();
    }
    getPageTitle() {
        switch (request.getLocale()) {
            case 'fr':
                return 'Robe florale';
            case 'default':
            case 'en':
            default:
                return 'Floral Dress';
        }
    }

    get longDescription() {
        return this.getLongDescription();
    }
    get shortDescription() {
        return this.getLongDescription();
    }
    getShortDescription() {
        return this.getLongDescription();
    }
    getLongDescription() {
        switch (request.getLocale()) {
            case 'fr':
                return {
                    source: 'Sentez la brise chaude dans cette robe portefeuille à imprimé floral polyvalent. Complétez ce look avec une superbe paire de sandales à lanières pour une soirée en ville.',
                };
            case 'default':
            case 'en':
            default:
                return {
                    source: 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.',
                };
        }
    }

    get priceModel() {
        return this.getPriceModel();
    }
    getPriceModel() {
        const prices = this.variants.map(variant => {
            return variant.getPriceModel().price.value;
        });
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        if (this.master) {
            return {
                price: {
                    available: false,
                    currencyCode: 'N/A',
                    value: 0,
                },
                minPrice: {
                    available: true,
                    currencyCode: request.getSession().getCurrency().currencyCode,
                    value: minPrice,
                },
                maxPrice: {
                    available: true,
                    currencyCode: request.getSession().getCurrency().currencyCode,
                    value: maxPrice,
                }
            };
        }
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

    get availabilityModel() {
        return this.getAvailabilityModel();
    }
    getAvailabilityModel() {
        if (this.isMaster()) {
            return {
                getInventoryRecord: function () {
                    return null;
                },
            };
        }
        return {
            getInventoryRecord: function () {
                return {
                    getATS: function () {
                        return {
                            getValue: function () {
                                return 6;
                            },
                        };
                    },
                };
            },
        };
    }

    get custom() {
        return this.customAttributes;
    }
    set custom(customAttributes) {
        this.customAttributes = customAttributes;
    }

    get primaryCategory() {
        return this.getPrimaryCategory();
    }
    getPrimaryCategory() {
        return {
            ID: 'womens-clothing-bottoms',
            get displayName() {
                switch (request.getLocale()) {
                    case 'fr':
                        return 'Bas';
                    case 'en':
                    case 'default':
                        return 'Bottoms';
                    default:
                        return null;
                }
            },
            online: true,
            root: false,
            parent: {
                ID: 'womens-clothing',
                get displayName() {
                    switch (request.getLocale()) {
                        case 'fr':
                            return 'Vêtements';
                        case 'default':
                        case 'en':
                            return 'Clothing';
                        default:
                            return null;
                    }
                },
                online: true,
                root: false,
                parent: {
                    ID: 'womens',
                    get displayName() {
                        switch (request.getLocale()) {
                            case 'fr':
                                return 'Femmes';
                            case 'default':
                            case 'en':
                                return 'Womens';
                            default:
                                return null;
                        }
                    },
                    online: true,
                    root: true,
                    parent: {
                        ID: 'root',
                        displayName: 'Storefront Catalog - EN',
                    },
                },
            },
        };
    }

    get onlineCategories() {
        return this.getOnlineCategories();
    }
    getOnlineCategories() {
        const result = [
            {
                ID: 'newarrivals-womens',
                get displayName() {
                    switch (request.getLocale()) {
                        case 'fr':
                            return 'Femmes';
                        case 'default':
                        case 'en':
                            return 'Womens';
                        default:
                            return null;
                    }
                },
                root: false,
                parent: {
                    ID: 'newarrivals',
                    get displayName() {
                        switch (request.getLocale()) {
                            case 'fr':
                                return 'Nouveaux arrivages';
                            case 'default':
                            case 'en':
                                return 'New Arrivals';
                            default:
                                return null;
                        }
                    },
                    root: true,
                    parent: {
                        ID: 'root',
                        displayName: 'Storefront Catalog - EN',
                    },
                },
            },
            this.primaryCategory,
        ];
        result.toArray = function () {
            return result;
        };
        return result;
    }

    get variationModel() {
        return this.getVariationModel();
    }
    getVariationModel() {
        return new ProductVariationModel({
            productID: this.ID,
            images: this.images,
            variants: this.variants,
        });
    }

    getImages(viewtype) {
        const images = this.images[viewtype];
        const locale = request.getLocale();
        return collectionHelper.createCollection(images[locale] || images['en']);
    }

    getVariants() {
        return this.variants;
    }
}

const PRODUCT_IMAGES = {
    large: {
        en: [
            {
                alt: 'Floral Dress, Hot Pink Combo, large',
                absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg',
                title: 'Floral Dress, Hot Pink Combo',
            },
            {
                alt: 'Floral Dress, Hot Pink Combo, large',
                absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg',
                title: 'Floral Dress, Hot Pink Combo',
            },
        ],
        fr: [
            {
                alt: 'Robe florale, Combo rose vif, large',
                absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg',
                title: 'Robe florale, Combo rose vif',
            },
            {
                alt: 'Robe florale, Combo rose vif, large',
                absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg',
                title: 'Robe florale, Combo rose vif',
            },
        ],
    },
    small: {
        en: [
            {
                alt: 'Floral Dress, Hot Pink Combo, small',
                absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg',
                title: 'Floral Dress, Hot Pink Combo',
            },
            {
                alt: 'Floral Dress, Hot Pink Combo, small',
                absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg',
                title: 'Floral Dress, Hot Pink Combo',
            },
        ],
        fr: [
            {
                alt: 'Robe florale, Combo rose vif, small',
                absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg',
                title: 'Robe florale, Combo rose vif',
            },
            {
                alt: 'Robe florale, Combo rose vif, small',
                absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg',
                title: 'Robe florale, Combo rose vif',
            },
        ],
    },
    swatch: {
        en: [
            {
                alt: 'Floral Dress, Hot Pink Combo, swatch',
                absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw506aa734/images/swatch/PG.10237222.JJB52A0.CP.jpg',
                title: 'Floral Dress, Hot Pink Combo',
            },
        ],
        fr: [
            {
                alt: 'Robe fleurie, Mix rose vif, swatch',
                absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw506aa734/images/swatch/PG.10237222.JJB52A0.CP.jpg',
                title: 'Robe fleurie, Mix rose vif',
            },
        ],
    },
};

module.exports = Product;
