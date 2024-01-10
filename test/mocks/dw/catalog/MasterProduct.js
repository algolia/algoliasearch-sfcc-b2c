const ProductVariationModel = require('./ProductVariationModel');
const collectionHelper = require('../../helpers/collectionHelper');

// https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_Product.html
// The instantiated product is a master product.
class Product {
    constructor({ ID } = {}) {
        this.ID = ID || '25592581M';
        this.assignedToSiteCatalog = true;
        this.images = PRODUCT_IMAGES;
        this.online = true;
        this.searchable = true;
        this.master = true;
        this.variant = false;
        this.variants = collectionHelper.createCollection([]);
    }

    get name() {
        return this.getName();
    }
    getName() {
        var result = null;
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
        if (this.master) {
            return {
                price: {
                    available: false,
                    currencyCode: 'N/A',
                    value: 0,
                },
            };
        }
        var currency = request.getSession().getCurrency();
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
        return this.getCustom();
    }
    getCustom() {
        return {
            refinementColor: null,
            refinementSize: null,
        };
    }

    get primaryCategory() {
        return this.getPrimaryCategory();
    }
    getPrimaryCategory() {
        return {
            ID: 'womens-clothing-bottoms',
            get displayName() {
                var name = null;
                switch (request.getLocale()) {
                    case 'default':
                        name = 'Bottoms';
                        break;
                    case 'fr':
                        name = 'Bas';
                        break;
                    case 'en':
                        name = 'Bottoms';
                        break;
                    default:
                        break;
                }
                return name;
            },
            online: true,
            root: false,
            parent: {
                ID: 'womens-clothing',
                get displayName() {
                    var name = null;
                    switch (request.getLocale()) {
                        case 'default':
                            name = 'Clothing';
                            break;
                        case 'fr':
                            name = 'Vêtements';
                            break;
                        case 'en':
                            name = 'Clothing';
                            break;
                        default:
                            break;
                    }
                    return name;
                },
                online: true,
                root: false,
                parent: {
                    ID: 'womens',
                    get displayName() {
                        var name = null;
                        switch (request.getLocale()) {
                            case 'default':
                                name = 'Womens';
                                break;
                            case 'fr':
                                name = 'Femmes';
                                break;
                            case 'en':
                                name = 'Womens';
                                break;
                            default:
                                break;
                        }
                        return name;
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
                absURL: 'https://zzgk-008.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwb93d490a/images/large/PG.10237222.JJB52A0.PZ.jpg',
                title: 'Floral Dress, Hot Pink Combo',
            },
            {
                alt: 'Floral Dress, Hot Pink Combo, large',
                absURL: 'https://zzgk-008.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw9a32be45/images/large/PG.10237222.JJB52A0.BZ.jpg',
                title: 'Floral Dress, Hot Pink Combo',
            },
        ],
        fr: [
            {
                alt: 'Robe fleurie, Mix rose vif, large',
                absURL: 'https://zzgk-008.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwb93d490a/images/large/PG.10237222.JJB52A0.PZ.jpg',
                title: 'Robe fleurie, Mix rose vif',
            },
            {
                alt: 'Robe fleurie, Mix rose vif, large',
                absURL: 'https://zzgk-008.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw9a32be45/images/large/PG.10237222.JJB52A0.BZ.jpg',
                title: 'Robe fleurie, Mix rose vif',
            },
        ],
    },
    small: {
        en: [
            {
                alt: 'Floral Dress, Hot Pink Combo, large',
                absURL: 'https://zzgk-008.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwb93d490a/images/large/PG.10237222.JJB52A0.PZ.jpg',
                title: 'Floral Dress, Hot Pink Combo',
            },
            {
                alt: 'Floral Dress, Hot Pink Combo, large',
                absURL: 'https://zzgk-008.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw9a32be45/images/large/PG.10237222.JJB52A0.BZ.jpg',
                title: 'Floral Dress, Hot Pink Combo',
            },
        ],
        fr: [
            {
                alt: 'Robe fleurie, Mix rose vif, small',
                absURL: 'https://zzgk-008.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw08ea0a24/images/small/PG.10237222.JJB52A0.PZ.jpg',
                title: 'Robe fleurie, Mix rose vif',
            },
            {
                alt: 'Robe fleurie, Mix rose vif, small',
                absURL: 'https://zzgk-008.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwf89d4457/images/small/PG.10237222.JJB52A0.BZ.jpg',
                title: 'Robe fleurie, Mix rose vif',
            },
        ],
    },
    swatch: {
        en: [
            {
                alt: 'Floral Dress, Hot Pink Combo, swatch',
                absURL: 'https://zzgk-008.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw506aa734/images/swatch/PG.10237222.JJB52A0.CP.jpg',
                title: 'Floral Dress, Hot Pink Combo',
            },
        ],
        fr: [
            {
                alt: 'Robe fleurie, Mix rose vif, swatch',
                absURL: 'https://zzgk-008.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw506aa734/images/swatch/PG.10237222.JJB52A0.CP.jpg',
                title: 'Robe fleurie, Mix rose vif',
            },
        ],
    },
};

module.exports = Product;