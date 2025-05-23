'use strict';

let Site = require('dw/system/Site');
let jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
let AlgoliaLocalizedProduct = require('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
let algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

/**
 * Generates an array of AlgoliaOperation objects to partially update product records in Algolia.
 * The function loops through allowed locales of the current site and creates a partialUpdateObject
 * operation for each locale.
 * @param {Object} productConfig - configuration for the product model.
 * @returns {Array} An array of AlgoliaOperation objects ready for indexing.
 */
function generateAlgoliaOperations(productConfig) {
    let algoliaOperations = [];
    let siteLocales = Site.getCurrent().getAllowedLocales();
    
    for (let i = 0; i < siteLocales.size(); i++) {
        let locale = siteLocales[i];
        let indexName = algoliaData.calculateIndexName('products', locale);

        // Create localizedProductConfig - start with required properties
        let localizedProductConfig = productConfig;
        localizedProductConfig.locale = locale;
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
