const collectionHelper = require('../../helpers/collectionHelper');
const ProductVariationAttributeValue = require('./ProductVariationAttributeValue');
const mockImages = require('../../../mocks/data/images');

// https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_ProductVariationModel.html
class ProductVariationModel {
    constructor({ productID, master, images, variationAttributes = {}, variants } = {}) {
        this.productID = productID;
        this.master = master;
        this.images = images;
        // Map of variationAttributeID => variationAttributeValueID, e.g. { color: 'JJB52A0', size: '004' }
        this.variationAttributes = variationAttributes;
        this.variants = variants;
    }

    getProductVariationAttribute(id) {
        if (this.variants) {
            // Base product. Check if the attribute exists in at least one variant
            const variantWithAttribute = this.variants.find((variant) => {
                return variant.variationAttributes && id in variant.variationAttributes;
            });
            if (!variantWithAttribute) {
                return null;
            }
        }

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
        return this.mockedProductVariationAttributeValuesById[this.variationAttributes[attribute.ID]];
    }
    setSelectedAttributeValue(variationAttributeID, variationAttributeValueID) {
        this.variationAttributes[variationAttributeID] = variationAttributeValueID;
    }
    getSelectedVariants() {
        return collectionHelper.createCollection(this.variants.filter(variant => {
            for (const attributeID in this.variationAttributes) {
                if (this.variationAttributes[attributeID] !== variant.variationAttributes[attributeID]) {
                    return false;
                }
            }
            return true;
        }));
    }
    getAllValues(variationAttribute) {
        if (!this.variants) {
            return collectionHelper.createCollection([])
        }
        const uniqueValues = new Set();
        const values = this.variants.reduce((acc, variant) => {
            const attrValueID = variant.variationAttributes[variationAttribute.ID];
            if (!uniqueValues.has(attrValueID)) {
                uniqueValues.add(attrValueID);
                acc.push(this.mockedProductVariationAttributeValuesById[attrValueID]);
            }
            return acc;
        }, []);
        return collectionHelper.createCollection(values);
    }
    getDefaultVariant() {
        return this.variants[0];
    }
    // eslint-disable-next-line no-unused-vars
    hasOrderableVariants(variationAttribute, variationAttributeValue) {
        return true;
    }
    getImages(viewtype) {
        let locale = request.getLocale() || 'en';
        const images = mockImages[this.variationAttributes['color']] || this.images;
        const res = images[viewtype][locale] || images[viewtype]['en'];
        return collectionHelper.createCollection(res);
    }

    getHtmlName(variationAttribute) {
        switch (variationAttribute.ID) {
            case 'color':
                return 'dwvar_' + this.productID + '_color';
        }
    }

    // Mocks of all the ProductVariationAttributeValue used in the tests
    mockedProductVariationAttributeValuesById = {
        'JJB52A0': new ProductVariationAttributeValue({
            ID: 'JJB52A0',
            value: 'JJB52A0',
            displayValues: {
                en: 'Hot Pink Combo',
                fr: 'Combo rose vif'
            }
        }),
        'JJC05A0': new ProductVariationAttributeValue({
            ID: 'JJC05A0',
            value: 'JJC05A0',
            displayValues: {
                en: 'Navy',
                fr: 'Marine'
            }
        }),
        '004': new ProductVariationAttributeValue({
            ID: '004',
            value: '4',
            displayValues: {
                en: '4',
                fr: '4'
            }
        }),
        '006': new ProductVariationAttributeValue({
            ID: '006',
            value: '6',
            displayValues: {
                en: '6',
                fr: '6'
            }
        }),
    };
}

module.exports = ProductVariationModel;
