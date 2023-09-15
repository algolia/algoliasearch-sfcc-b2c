var Product = function () {
};

Product.prototype = {
    get brand() {
        var result = null;
        switch (request.getLocale()) {
            case 'default': result = null; break;
            case 'fr': result = null; break;
            case 'en': result = null; break;
            default: break;
        }
        return result;
    },
    get name() {
        var result = null;
        switch (request.getLocale()) {
            case 'default': result = 'Floral Dress'; break;
            case 'fr': result = 'Robe florale'; break;
            case 'en': result = 'Floral Dress'; break;
            default: break;
        }
        return result;
    },
    get pageDescription() {
        var result = null;
        switch (request.getLocale()) {
            case 'default': result = 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'; break;
            case 'fr': result = 'Sentez la brise chaude dans cette robe portefeuille à imprimé floral polyvalent. Complétez ce look avec une superbe paire de sandales à lanières pour une soirée en ville.'; break;
            case 'en': result = 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'; break;
            default: break;
        }
        return result;
    },
    get pageKeywords() {
        var result = null;
        switch (request.getLocale()) {
            case 'default': result = null; break;
            case 'fr': result = null; break;
            case 'en': result = null; break;
            default: break;
        }
        return result;
    },
    get pageTitle() {
        var result = null;
        switch (request.getLocale()) {
            case 'default': result = 'Floral Dress'; break;
            case 'fr': result = 'Robe florale'; break;
            case 'en': result = 'Floral Dress'; break;
            default: break;
        }
        return result;
    },
    get longDescription() {
        var result = { source: null };
        switch (request.getLocale()) {
            case 'default': result.source = 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'; break;
            case 'fr': result.source = 'Sentez la brise chaude dans cette robe portefeuille à imprimé floral polyvalent. Complétez ce look avec une superbe paire de sandales à lanières pour une soirée en ville.'; break;
            case 'en': result.source = 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'; break;
            default: break;
        }
        return result;
    },
    get shortDescription() {
        var result = { source: null };
        switch (request.getLocale()) {
            case 'default': result.source = 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'; break;
            case 'fr': result.source = 'Sentez la brise chaude dans cette robe portefeuille à imprimé floral polyvalent. Complétez ce look avec une superbe paire de sandales à lanières pour une soirée en ville.'; break;
            case 'en': result.source = 'Feel the warm breeze in this versatile printed floral wrap dress. Polish off this look with a great pair of strappy sandals for a night on the town.'; break;
            default: break;
        }
        return result;
    },
    get priceModel() {
        var result = null;
        var currency = request.getSession().getCurrency();
        switch (currency.currencyCode) {
            case 'USD':
                result = {
                    price: {
                        available: true,
                        currencyCode: 'USD',
                        value: 129
                    }
                };
                break;
            case 'EUR':
                result = {
                    price: {
                        available: true,
                        currencyCode: 'EUR',
                        value: 92.88
                    }
                };
                break;
            default: break;
        }
        return result;
    }
};
Product.prototype.ID = '701644031206M';
Product.prototype.online = true;
Product.prototype.searchable = true;
Product.prototype.UPC = '701644031206';
Product.prototype.unit = 1;
Product.prototype.EAN = null;
Product.prototype.searchable = true;
Product.prototype.variant = true;
Product.prototype.getAvailabilityModel = function() {
    return {
        getInventoryRecord: function() {
            return {
                getATS: function() {
                    return {
                        getValue: function() {
                            return 6;
                        }
                    }
                }
            }
        }
    }
};
Product.prototype.isVariant = function () { return false; };
Product.prototype.custom = {
    refinementColor: {
        get displayValue() {
            switch (request.getLocale()) {
                case 'default': return 'Pink';
                case 'fr': return 'Rose';
                case 'en': return 'Pink';
                default: return 'Pink';
            }
        }
    },
    refinementSize: '4',
};
var primaryCategory = {
    ID: 'womens-clothing-bottoms',
    get displayName() {
        var name = null;
        switch (request.getLocale()) {
            case 'default': name = 'Bottoms'; break;
            case 'fr': name = 'Bas'; break;
            case 'en': name = 'Bottoms'; break;
            default: break;
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
                case 'default': name = 'Clothing'; break;
                case 'fr': name = 'Vêtements'; break;
                case 'en': name = 'Clothing'; break;
                default: break;
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
                    case 'default': name = 'Womens'; break;
                    case 'fr': name = 'Femmes'; break;
                    case 'en': name = 'Womens'; break;
                    default: break;
                }
                return name;
            },
            online: true,
            root: true,
            parent: {
                ID: 'root',
                displayName: 'Storefront Catalog - EN'
            }
        }
    }
}
Product.prototype.primaryCategory = primaryCategory;
Product.prototype.getPrimaryCategory = function() {
    return primaryCategory;
};
Product.prototype.getOnlineCategories = function () {
    var result = [
        {
            ID: 'newarrivals-womens',
            get displayName() {
                var name = null;
                switch (request.getLocale()) {
                    case 'default': name = 'Womens'; break;
                    case 'fr': name = 'Femmes'; break;
                    case 'en': name = 'Womens'; break;
                    default: break;
                }
                return name;
            },
            root: false,
            parent: {
                ID: 'newarrivals',
                get displayName() {
                    var name = null;
                    switch (request.getLocale()) {
                        case 'default': name = 'New Arrivals'; break;
                        case 'fr': name = 'Nouveaux arrivages'; break;
                        case 'en': name = 'New Arrivals'; break;
                        default: break;
                    }
                    return name;
                },
                root: true,
                parent: {
                    ID: 'root',
                    displayName: 'Storefront Catalog - EN'
                }
            }
        },
        primaryCategory,
    ];
    result.toArray = function () { return result; };
    return result;
};

Product.prototype.getVariationModel = function () {
    return {
        getProductVariationAttribute: function (key) {
            var result = null;
            switch (key) {
                case 'color':
                    switch (request.getLocale()) {
                        case 'default': result = { displayValue: 'Hot Pink Combo' }; break;
                        case 'fr': result = { displayValue: 'Combo rose vif' }; break;
                        case 'en': result = { displayValue: 'Hot Pink Combo' }; break;
                        default: break;
                    }
                    break;
                case 'size':
                    switch (request.getLocale()) {
                        case 'default': result = { displayValue: '4' }; break;
                        case 'fr': result = { displayValue: '4' }; break;
                        case 'en': result = { displayValue: '4' }; break;
                        default: break;
                    }
                    break;
                default:
                    break;
            }
            return result;
        },
        getSelectedValue: function (attribute) {
            return attribute;
        }
    };
};

Product.prototype.getImages = function (viewtype) {
    var arrDefaultLarge = [
        {
            alt: 'Floral Dress, Hot Pink Combo, large',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg',
            title: 'Floral Dress, Hot Pink Combo'
        },
        {
            alt: 'Floral Dress, Hot Pink Combo, large',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg',
            title: 'Floral Dress, Hot Pink Combo'
        }
    ];
    var arrFrLarge = [
        {
            alt: 'Robe florale, Combo rose vif, large',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg',
            title: 'Robe florale, Combo rose vif'
        },
        {
            alt: 'Robe florale, Combo rose vif, large',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg',
            title: 'Robe florale, Combo rose vif'
        }
    ];
    var arrEnLarge = [
        {
            alt: 'Floral Dress, Hot Pink Combo, large',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dwcc434d54/images/large/PG.10237222.JJB52A0.PZ.jpg',
            title: 'Floral Dress, Hot Pink Combo'
        },
        {
            alt: 'Floral Dress, Hot Pink Combo, large',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw58a034a4/images/large/PG.10237222.JJB52A0.BZ.jpg',
            title: 'Floral Dress, Hot Pink Combo'
        }
    ];

    var arrDefaultSmall = [
        {
            alt: 'Floral Dress, Hot Pink Combo, small',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg',
            title: 'Floral Dress, Hot Pink Combo'
        },
        {
            alt: 'Floral Dress, Hot Pink Combo, small',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg',
            title: 'Floral Dress, Hot Pink Combo'
        }
    ];
    var arrFrSmall = [
        {
            alt: 'Robe florale, Combo rose vif, small',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg',
            title: 'Robe florale, Combo rose vif'
        },
        {
            alt: 'Robe florale, Combo rose vif, small',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg',
            title: 'Robe florale, Combo rose vif'
        }
    ];
    var arrEnSmall = [
        {
            alt: 'Floral Dress, Hot Pink Combo, small',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw4e4ce4f6/images/small/PG.10237222.JJB52A0.PZ.jpg',
            title: 'Floral Dress, Hot Pink Combo'
        },
        {
            alt: 'Floral Dress, Hot Pink Combo, small',
            absURL: 'https://zzrk-018.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.static/-/Sites-apparel-m-catalog/default/dw2612fb5e/images/small/PG.10237222.JJB52A0.BZ.jpg',
            title: 'Floral Dress, Hot Pink Combo'
        }
    ];

    var result = null;
    if (viewtype === 'large') {
        switch (request.getLocale()) {
            case 'default': result = arrDefaultLarge; break;
            case 'fr': result = arrFrLarge; break;
            case 'en': result = arrEnLarge; break;
            default: break;
        }
    } else {
        switch (request.getLocale()) {
            case 'default': result = arrDefaultSmall; break;
            case 'fr': result = arrFrSmall; break;
            case 'en': result = arrEnSmall; break;
            default: break;
        }
    }

    result.size = function () {
        return result.length;
    };
    return result;
};

module.exports = Product;
