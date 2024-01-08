const collectionHelper = require('../../helpers/collectionHelper');

// https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_ProductVariationModel.html
class ProductVariationModel {
    constructor({ productID, images, selectedAttributeValue } = {}) {
        this.productID = productID;
        this.images = images;
        this.selectedAttributeValue = {};
    }

    getProductVariationAttribute(id) {
        const productVariationAttributes = {
            color: {
                default: { attributeID: 'color', displayName: 'Color' },
                en: { attributeID: 'color', displayName: 'Color' },
                fr: { attributeID: 'color', displayName: 'Coloris' },
            },
            size: {
                default: { attributeID: 'size', displayName: 'Size' },
                en: { attributeID: 'size', displayName: 'Size' },
                fr: { attributeID: 'size', displayName: 'Taille' },
            },
        };
        return productVariationAttributes[id][request.getLocale()];
    }
    setSelectedAttributeValue(variationAttributeID, variationAttributeValueID) {
        this.selectedAttributeValue[variationAttributeID] = variationAttributeValueID;
    }
    getAllValues(variationAttribute) {
        switch (variationAttribute.attributeID) {
            case 'color':
                switch (request.getLocale()) {
                    case 'default':
                    case 'en':
                        return collectionHelper.createCollection([
                            {
                                ID: 'JJB52A0',
                                value: 'JJB52A0',
                                displayValue: 'Hot Pink Combo',
                            },
                        ]);
                    case 'fr':
                        return collectionHelper.createCollection([
                            {
                                ID: 'JJB52A0',
                                value: 'JJB52A0',
                                displayValue: 'Mix rose vif',
                            },
                        ]);
                }
        }
    }
    hasOrderableVariants(variationAttribute, variationAttributeValue) {
        return true;
    }
    getImages(viewtype) {
        return collectionHelper.createCollection(
            this.images[viewtype][request.getLocale()] || this.images[viewtype]['en']
        );
    }

    getHtmlName(variationAttribute) {
        switch (variationAttribute.attributeID) {
            case 'color':
                return 'dwvar_' + this.productID + '_color';
        }
    }
}

module.exports = ProductVariationModel;
