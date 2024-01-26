const collectionHelper = require('../../helpers/collectionHelper');

// https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_ProductVariationModel.html
class ProductVariationModel {
    constructor({ productID, images, variationAttributes = {}, variants } = {}) {
        this.productID = productID;
        this.images = images;
        this.variationAttributes = variationAttributes;
        this.variants = variants;
    }

    getProductVariationAttribute(id) {
        const productVariationAttributes = {
            color: {
                default: { ID: 'color', displayName: 'Color' },
                en: { ID: 'color', displayName: 'Color' },
                fr: { ID: 'color', displayName: 'Coloris' },
            },
            size: {
                default: { ID: 'size', displayName: 'Size' },
                en: { ID: 'size', displayName: 'Size' },
                fr: { ID: 'size', displayName: 'Taille' },
            },
        };
        return productVariationAttributes[id][request.getLocale()];
    }
    getSelectedValue(attribute) {
        const values = this.getAllValues(attribute);
        return values.find(val => val.ID === this.variationAttributes[attribute.ID]);
    }
    setSelectedAttributeValue(variationAttributeID, variationAttributeValueID) {
        this.variationAttributes[variationAttributeID] = variationAttributeValueID;
    }
    getAllValues(variationAttribute) {
        switch (variationAttribute.ID) {
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
                                displayValue: 'Combo rose vif',
                            },
                        ]);
                    default:
                        return null;
                }
            case 'size':
                return collectionHelper.createCollection([
                    {
                        ID: '004',
                        value: '4',
                        displayValue: '4',
                    },
                ]);
        }
    }
    getDefaultVariant() {
        return this.variants[0];
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
        switch (variationAttribute.ID) {
            case 'color':
                return 'dwvar_' + this.productID + '_color';
        }
    }
}

module.exports = ProductVariationModel;
