// https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/index.html?target=class_dw_catalog_ProductVariationAttributeValue.html
class ProductVariationAttributeValue {
    constructor({ ID, value, displayValues = {} } = {}) {
        this.ID = ID;
        this.value = value;
        this.displayValues = displayValues;
    }

    get displayValue() {
        return this.displayValues[request.getLocale()] || this.displayValues['en'];
    }
}

module.exports = ProductVariationAttributeValue;
