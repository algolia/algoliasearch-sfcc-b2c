'use strict';

let Site = require('dw/system/Site');
let jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
let AlgoliaLocalizedProduct = require('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
let algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
let getAttributes = jobHelper.getAttributes;

/**
 * Generates an array of AlgoliaOperation objects to partially update product records in Algolia.
 * The function loops through allowed locales of the current site and creates a partialUpdateObject
 * operation for each locale.
 *
 * @param {dw.catalog.Product} product - Either a master product or a variant product.
 * @param {Array} attributes - Array of attribute names to be updated.
 * @returns {Array} An array of AlgoliaOperation objects ready for indexing.
 */
function generateAlgoliaOperations(product, attributes) {
    let algoliaOperations = [];
    let attributesConfig = {};

    if (product.master) {
        attributesConfig = getAttributes();
    } else {
        attributesConfig = attributes;
    }

    let baseModel;
    if (product.master) {
        baseModel = new AlgoliaLocalizedProduct({
            product: product,
            locale: 'default',
            attributeList: attributesConfig.nonLocalizedMasterAttributes
        });
    } else {
        baseModel = new AlgoliaLocalizedProduct({
            product: product,
            locale: 'default',
            attributeList: attributesConfig.variantAttributes
        });
    }

    let siteLocales = Site.getCurrent().getAllowedLocales();
    for (let i = 0; i < siteLocales.size(); i++) {
        let locale = siteLocales[i];
        let indexName = algoliaData.calculateIndexName('products', locale);

        let localizedProductConfig = {
            product: product,
            locale: locale,
            attributeList: attributes,
            baseModel: baseModel
        };

        if (product.master) {
            localizedProductConfig.variantAttributes = attributesConfig.variantAttributes;
            localizedProductConfig.attributeList = attributesConfig.masterAttributes;
        }

        let localizedProduct = new AlgoliaLocalizedProduct(localizedProductConfig);
        algoliaOperations.push(
            new jobHelper.AlgoliaOperation(
                'partialUpdateObject',
                localizedProduct,
                indexName
            )
        );
    }

    return algoliaOperations;
}

module.exports = {
    generateAlgoliaOperations: generateAlgoliaOperations
};
