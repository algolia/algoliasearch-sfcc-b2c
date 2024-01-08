const Product = require('./MasterProduct');
const ProductVariationModel = require("./ProductVariationModel");

// https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_catalog_Variant.html
class Variant extends Product {
    constructor({ ID, variationAttributes, masterProduct } = {}) {
        super({ ID });
        this.master = false;
        this.variant = true;
        this.masterProduct = masterProduct;
        this.variationAttributes = variationAttributes;
    }

    getVariationModel() {
        return new ProductVariationModel({
            productID: this.ID,
            images: this.images,
            selectedAttributeValue: this.variationAttributes,
        });
    }
}

module.exports = Variant;
