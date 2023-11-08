'use strict';

const URLUtils = require('dw/web/URLUtils');
const URLParameter = require('dw/web/URLParameter');
const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData').clientSideData;

/**
 * Transforms the category search hits retrieved from Algolia
 * into their final form ready for server-side rendering.
 * This function is the back-end equivalent of the front-end script
 * instantsearch-config.js > instantsearch.widgets.infiniteHits() > transformItems()
 * @param {Object} items - Algolia search result hits - array of hit objects
 * @returns {Object} - transformed Algolia search result hits
 */
function transformItems(items) {
    return items.map(function (item) {

        // assign image
        if (item.image_groups) {
            var imageGroup = item.image_groups.find(function (i) {
                i.view_type === 'large'
            }) || item.image_groups[0];
            if (imageGroup) {
                var firstImageInGroup = imageGroup.images[0];
                item.image = firstImageInGroup
            }
        } else {
            item.image = {
                dis_base_link: algoliaData.noImages.large,
                alt: item.name + ', large',
            }
        }

        // adjusted price in user currency
        if (item.promotionalPrice && item.promotionalPrice[algoliaData.currencyCode] !== null) {
            item.promotionalPrice = item.promotionalPrice[algoliaData.currencyCode]
        }

        // price in user currency
        if (item.price && item.price[algoliaData.currencyCode] !== null) {
            item.price = item.price[algoliaData.currencyCode]
        }

        // currency symbol
        item.currencySymbol = algoliaData.currencySymbol;

        item.quickShowUrl = algoliaData.quickViewUrlBase + '?pid=' + item.id;

        // originating index
        item.__indexName = algoliaData.productsIndex;

        return item;
    });

    return items;
}

/**
 * Creates a quasi-query using SFRA's standard breadcrumb-generator method which outputs an array of objects containing details for each breadcrumb.
 * The htmlValue property from each breadcrumb object needs to be extracted, their order reversed, then joined by " > ".
 * Example (unencoded) facetFilters query parameter value: '["__primary_category.2:Mens > Clothing > Suits"]'
 * @param {string} cgid the categoryID to get the breadcrumbs for
 * @returns {string} the facetFilters query parameter value generated from the breadcrumbs
 */
function facetFiltersParamValueFromBreadcrumbs(cgid) {
    var breadcrumbs = require('*/cartridge/scripts/helpers/productHelpers').getAllBreadcrumbs(cgid, null, []);
    var breadcrumbArray = breadcrumbs.map((breadcrumb) => breadcrumb.htmlValue);

    // example: ["__primary_category.2:Mens > Clothing > Suits"]
    var facetFiltersParamValue = '["__primary_category.' + (breadcrumbArray.length - 1) + ':' + breadcrumbArray.reverse().join(' > ') + '"]'
    return facetFiltersParamValue;
}

module.exports = {
    transformItems: transformItems,
    facetFiltersParamValueFromBreadcrumbs: facetFiltersParamValueFromBreadcrumbs,
};
