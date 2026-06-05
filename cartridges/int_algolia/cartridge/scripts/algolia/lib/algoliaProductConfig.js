'use strict';

// @deprecated: pertains to v1 jobs, to be removed
var defaultAttributes = ['id', 'primary_category_id', 'in_stock', 'price', 'categories'];

// These attributes will be always be sent regardless of what is configured in `Algolia_AdditionalAttributes`
var defaultAttributes_v2 = ['name', 'categoryPageId', '__primary_category', 'in_stock', 'price', 'image_groups', 'url'];

// Configurations for master-level indexing mode
var defaultMasterAttributes_v2 = ['variants', 'defaultVariantID', 'colorVariations'];
var defaultVariantAttributes_v2 = ['in_stock', 'price', 'color', 'size', 'url'];

// @deprecated: pertains to v1 jobs, to be removed
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

// Attribute configuration objects
// Possible properties: attribute, localized, variantAttribute, computedFromBaseProduct -- see "https://www.algolia.com/doc/integration/salesforce-commerce-cloud-b2c/indexing/product-indexing/indexing-attributes#configurable-attributes" for more

// For attributes not defined here, the default config becomes (see jobHelper.js > getDefaultAttributeConfig()):
// {
//     attribute: attributeName,
//     localized: false,
//     variantAttribute: true
// }
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
    // The following objects have no `attribute` property declared because `algoliaLocalizedProduct.js` > `aggregatedValueHandlers()` has special value handlers defined for them
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
    storeAvailability: {
        localized: false,
        variantAttribute: true,
    },
    variants: {
        localized: true,
        variantAttribute: false,
    },

    // dw.catalog.ProductActiveData (48 properties).
    // Each entry maps a bare ID (e.g. `ordersWeek`) to the platform-aggregated master-level
    // value at `product.activeData.<id>`. With `variantAttribute: false`, the value is placed
    // at the record root in the master-level and attribute-sliced models, and at the variant
    // root in the variant-level model. To index per-variant values nested in `variants[]`,
    // use the dotted form (`activeData.<id>`) in `Algolia_AdditionalAttributes` instead - that
    // path resolves through the default fallback and ends up at `variants[i].activeData.<id>`.
    //
    // Attribute-sliced record model: each slice record (one per variation value, e.g. per
    // color) is built from the master, not from a per-slice subset of variants - see
    // `jobHelper.generateAttributeSlicedRecords()`. Bare-name Active Data on the slice's root
    // is therefore the master's platform-aggregated value, identical across all slices of the
    // same master and computed over ALL variants (including those not in this slice). To get
    // a per-slice value, compute it in `productAttributesConfig.js` from the variants in the
    // slice; the dotted form (`activeData.<id>`) places each variant's own value inside its
    // `variants[i]` entry.
    ordersDay:           { attribute: 'activeData.ordersDay',           localized: false, variantAttribute: false },
    ordersWeek:          { attribute: 'activeData.ordersWeek',          localized: false, variantAttribute: false },
    ordersMonth:         { attribute: 'activeData.ordersMonth',         localized: false, variantAttribute: false },
    ordersYear:          { attribute: 'activeData.ordersYear',          localized: false, variantAttribute: false },

    revenueDay:          { attribute: 'activeData.revenueDay',          localized: false, variantAttribute: false },
    revenueWeek:         { attribute: 'activeData.revenueWeek',         localized: false, variantAttribute: false },
    revenueMonth:        { attribute: 'activeData.revenueMonth',        localized: false, variantAttribute: false },
    revenueYear:         { attribute: 'activeData.revenueYear',         localized: false, variantAttribute: false },

    conversionDay:       { attribute: 'activeData.conversionDay',       localized: false, variantAttribute: false },
    conversionWeek:      { attribute: 'activeData.conversionWeek',      localized: false, variantAttribute: false },
    conversionMonth:     { attribute: 'activeData.conversionMonth',     localized: false, variantAttribute: false },
    conversionYear:      { attribute: 'activeData.conversionYear',      localized: false, variantAttribute: false },

    salesVelocityDay:    { attribute: 'activeData.salesVelocityDay',    localized: false, variantAttribute: false },
    salesVelocityWeek:   { attribute: 'activeData.salesVelocityWeek',   localized: false, variantAttribute: false },
    salesVelocityMonth:  { attribute: 'activeData.salesVelocityMonth',  localized: false, variantAttribute: false },
    salesVelocityYear:   { attribute: 'activeData.salesVelocityYear',   localized: false, variantAttribute: false },

    viewsDay:            { attribute: 'activeData.viewsDay',            localized: false, variantAttribute: false },
    viewsWeek:           { attribute: 'activeData.viewsWeek',           localized: false, variantAttribute: false },
    viewsMonth:          { attribute: 'activeData.viewsMonth',          localized: false, variantAttribute: false },
    viewsYear:           { attribute: 'activeData.viewsYear',           localized: false, variantAttribute: false },

    impressionsDay:      { attribute: 'activeData.impressionsDay',      localized: false, variantAttribute: false },
    impressionsWeek:     { attribute: 'activeData.impressionsWeek',     localized: false, variantAttribute: false },
    impressionsMonth:    { attribute: 'activeData.impressionsMonth',    localized: false, variantAttribute: false },
    impressionsYear:     { attribute: 'activeData.impressionsYear',     localized: false, variantAttribute: false },

    unitsDay:            { attribute: 'activeData.unitsDay',            localized: false, variantAttribute: false },
    unitsWeek:           { attribute: 'activeData.unitsWeek',           localized: false, variantAttribute: false },
    unitsMonth:          { attribute: 'activeData.unitsMonth',          localized: false, variantAttribute: false },
    unitsYear:           { attribute: 'activeData.unitsYear',           localized: false, variantAttribute: false },

    lookToBookRatioDay:    { attribute: 'activeData.lookToBookRatioDay',    localized: false, variantAttribute: false },
    lookToBookRatioWeek:   { attribute: 'activeData.lookToBookRatioWeek',   localized: false, variantAttribute: false },
    lookToBookRatioMonth:  { attribute: 'activeData.lookToBookRatioMonth',  localized: false, variantAttribute: false },
    lookToBookRatioYear:   { attribute: 'activeData.lookToBookRatioYear',   localized: false, variantAttribute: false },

    avgSalesPriceDay:           { attribute: 'activeData.avgSalesPriceDay',           localized: false, variantAttribute: false },
    avgSalesPriceWeek:          { attribute: 'activeData.avgSalesPriceWeek',          localized: false, variantAttribute: false },
    avgSalesPriceMonth:         { attribute: 'activeData.avgSalesPriceMonth',         localized: false, variantAttribute: false },
    avgSalesPriceYear:          { attribute: 'activeData.avgSalesPriceYear',          localized: false, variantAttribute: false },

    avgGrossMarginPercentDay:   { attribute: 'activeData.avgGrossMarginPercentDay',   localized: false, variantAttribute: false },
    avgGrossMarginPercentWeek:  { attribute: 'activeData.avgGrossMarginPercentWeek',  localized: false, variantAttribute: false },
    avgGrossMarginPercentMonth: { attribute: 'activeData.avgGrossMarginPercentMonth', localized: false, variantAttribute: false },
    avgGrossMarginPercentYear:  { attribute: 'activeData.avgGrossMarginPercentYear',  localized: false, variantAttribute: false },

    avgGrossMarginValueDay:     { attribute: 'activeData.avgGrossMarginValueDay',     localized: false, variantAttribute: false },
    avgGrossMarginValueWeek:    { attribute: 'activeData.avgGrossMarginValueWeek',    localized: false, variantAttribute: false },
    avgGrossMarginValueMonth:   { attribute: 'activeData.avgGrossMarginValueMonth',   localized: false, variantAttribute: false },
    avgGrossMarginValueYear:    { attribute: 'activeData.avgGrossMarginValueYear',    localized: false, variantAttribute: false },

    costPrice:                  { attribute: 'activeData.costPrice',                  localized: false, variantAttribute: false },
    returnRate:                 { attribute: 'activeData.returnRate',                 localized: false, variantAttribute: false },

    availableDate:       { attribute: 'activeData.availableDate',       localized: false, variantAttribute: false },
    daysAvailable:       { attribute: 'activeData.daysAvailable',       localized: false, variantAttribute: false },
};

module.exports = {
    defaultAttributes: defaultAttributes,
    defaultAttributes_v2: defaultAttributes_v2,
    defaultVariantAttributes_v2: defaultVariantAttributes_v2,
    defaultMasterAttributes_v2: defaultMasterAttributes_v2,
    attributeConfig: attributeConfig,
    attributeConfig_v2: attributeConfig_v2,
};
