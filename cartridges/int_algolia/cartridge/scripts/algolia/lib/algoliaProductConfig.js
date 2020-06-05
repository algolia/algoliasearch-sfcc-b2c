'use strict';

var defaultAttributes = ['id', 'primary_category_id', 'in_stock', 'price', 'categories'];

var attributeConfig = {
    id: {
        attribute: 'ID',
        localized: false
    },
    primary_category_id: {
        attribute: 'primaryCategory.ID',
        localized: false
    },
    in_stock: {
        attribute: 'availabilityModel.inStock',
        localized: false
    },
    brand: {
        attribute: 'brand',
        localized: true
    },
    EAN: {
        attribute: 'EAN',
        localized: false
    },
    long_description: {
        attribute: 'longDescription.source',
        localized: true
    },
    manufacturerName: {
        attribute: 'manufacturerName',
        localized: false
    },
    manufacturerSKU: {
        attribute: 'manufacturerSKU',
        localized: false
    },
    master: {
        attribute: 'master',
        localized: false
    },
    name: {
        attribute: 'name',
        localized: true
    },
    online: {
        attribute: 'online',
        localized: false
    },
    optionProduct: {
        attribute: 'optionProduct',
        localized: false
    },
    pageDescription: {
        attribute: 'pageDescription',
        localized: true
    },
    pageKeywords: {
        attribute: 'pageKeywords',
        localized: true
    },
    pageTitle: {
        attribute: 'pageTitle',
        localized: true
    },
    productSet: {
        attribute: 'productSet',
        localized: false
    },
    productSetProduct: {
        attribute: 'productSetProduct',
        localized: false
    },
    searchable: {
        attribute: 'searchable',
        localized: false
    },
    short_description: {
        attribute: 'shortDescription.source',
        localized: true
    },
    unit: {
        attribute: 'unit',
        localized: false
    },
    UPC: {
        attribute: 'UPC',
        localized: false
    },
    variant: {
        attribute: 'variant',
        localized: false
    },
    price: {
        localized: false
    },
    promotionalPrice: {
        localized: false
    },
    image_groups: {
        localized: false
    },
    url: {
        localized: true
    },
    color: {
        localized: true
    },
    size: {
        localized: true
    },
    categories: {
        localized: false
    }
};

module.exports = {
    defaultAttributes: defaultAttributes,
    attributeConfig: attributeConfig
};
