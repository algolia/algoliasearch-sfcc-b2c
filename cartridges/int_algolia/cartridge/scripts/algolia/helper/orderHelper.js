'use strict';

let Site = require('dw/system/Site');
let jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
let AlgoliaLocalizedProduct = require('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
let algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

/**
 * Determines the locales to index for the current site by intersecting the site's allowed locales
 * with the locales configured in Algolia under the `Algolia_LocalesForIndexing` site preference.
 * @returns {string[]} Array of locales that are both allowed by the site and configured for indexing.
 */
function getActualLocalesForIndexing() {
    let siteLocales = Site.getCurrent().getAllowedLocales().toArray();
    let prefLocalesForIndexing = algoliaData.getSetOfArray('LocalesForIndexing');
    let actualLocalesForIndexing = [];

    if (empty(prefLocalesForIndexing)) {
        actualLocalesForIndexing = siteLocales;
    } else {
        for (let i = 0; i < prefLocalesForIndexing.length; i++) {
            let locale = prefLocalesForIndexing[i];
            if (siteLocales.indexOf(locale) >= 0) {
                actualLocalesForIndexing.push(locale);
            }
        }
    }

    return actualLocalesForIndexing;
}

/**
 * Generates an array of AlgoliaOperation objects to partially update product records in Algolia.
 * The function loops through allowed locales of the current site and creates a partialUpdateObject
 * operation for each locale.
 * @param {Object} productConfig - configuration for the product model.
 * @returns {Array} An array of AlgoliaOperation objects ready for indexing.
 */
function generateAlgoliaOperations(productConfig) {
    let algoliaOperations = [];
    let actualLocalesToIndex = getActualLocalesForIndexing();

    for (let i = 0; i < actualLocalesToIndex.length; i++) {
        let locale = actualLocalesToIndex[i];
        let indexName = algoliaData.calculateIndexName('products', locale);

        // Create localizedProductConfig - start with required properties
        let localizedProductConfig = productConfig;
        localizedProductConfig.locale = locale;
        let localizedProduct = new AlgoliaLocalizedProduct(localizedProductConfig);
        algoliaOperations.push(new jobHelper.AlgoliaOperation(
            'partialUpdateObject',
            localizedProduct,
            indexName
        ));
    };

    return algoliaOperations;
}

module.exports = {
    generateAlgoliaOperations: generateAlgoliaOperations,
};
