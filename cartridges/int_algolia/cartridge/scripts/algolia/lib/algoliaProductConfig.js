'use strict';

var defaultAttributes = ['id', 'primary_category_id', 'in_stock', 'price', 'categories'];
var defaultAttributes_v2 = ['name', 'categoryPageId', '__primary_category', 'in_stock', 'price', 'image_groups', 'url'];
// Configurations for master-level indexing mode
var defaultMasterAttributes_v2 = ['variants', 'defaultVariantID', 'colorVariations'];
var defaultVariantAttributes_v2 = ['in_stock', 'price', 'color', 'size', 'url'];

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
    refinementColor: {
        localized: true
    },
    size: {
        localized: true
    },
    refinementSize: {
        localized: true
    },
    categories: {
        localized: false
    }
};

var attributeConfig_v2 = {
    brand: {
        attribute: 'brand',
        localized: true
    },
    EAN: {
        attribute: 'EAN',
        localized: false
    },
    id: {
        attribute: 'ID',
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
    primary_category_id: {
        attribute: 'primaryCategory.ID',
        localized: false
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
    // The following have no 'attribute' declared because the model has special values handlers
    categories: {
        localized: true
    },
    categoryPageId: {
        localized: false,
    },
    __primary_category: {
        localized: true,
    },
    color: {
        localized: true,
        variantAttribute: true,
    },
    colorVariations: {
        localized: true,
        computedFromBaseProduct: true,
    },
    image_groups: {
        localized: true
    },
    lsImage: {
        localized: false
    },
    in_stock: {
        localized: false,
        variantAttribute: true,
    },
    masterID: {
        localized: false,
    },
    price: {
        localized: false,
        variantAttribute: true,
    },
    promotionalPrice: {
        localized: false,
        variantAttribute: true,
    },
    promotions: {
        localized: false,
        variantAttribute: true,
    },
    pricebooks: {
        localized: false,
        variantAttribute: true,
    },
    refinementColor: {
        localized: true,
        variantAttribute: true,
    },
    refinementSize: {
        localized: true,
        variantAttribute: true,
    },
    size: {
        localized: true,
        variantAttribute: true,
    },
    url: {
        localized: true,
        variantAttribute: true,
    },
};

module.exports = {
    defaultAttributes: defaultAttributes,
    defaultAttributes_v2: defaultAttributes_v2,
    defaultVariantAttributes_v2: defaultVariantAttributes_v2,
    defaultMasterAttributes_v2: defaultMasterAttributes_v2,
    attributeConfig: attributeConfig,
    attributeConfig_v2: attributeConfig_v2,
};
