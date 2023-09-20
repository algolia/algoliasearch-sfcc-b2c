/**
 * Operation class that represents an Algolia operation
 * @param {string} action - Operation to perform: addObject, updateObject, deleteObject
 * @param {Object} algoliaObject - Algolia object to index
 * @constructor
 */
function AlgoliaOperation(action, algoliaObject) {
    this.action = action;
    this.body = {};

    var keys = Object.keys(algoliaObject);
    for (var i = 0; i < keys.length; i += 1) {
        if (keys[i] !== 'id') {
            this.body[keys[i]] = algoliaObject[keys[i]];
        } else {
            this.body.objectID = algoliaObject.id;
        }
    }
}

/**
 * The function returns the filtered next product from SeekableIterator
 * and converted to the Algolia Localized Product Model
 * @param {dw.util.SeekableIterator} productsIterator - Product SeekableIterator
 * @param {string} locale - The locale for which we want to retrieve the products properties
 * @returns {Object} -  Algolia Localized Product Model
 */
function getNextProductModel(productsIterator, locale) {
    var AlgoliaLocalizedProduct = require('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
    if (productsIterator.hasNext()) {
        var product = productsIterator.next();
        return new AlgoliaLocalizedProduct(product, locale);
    }
}

/**
 * Job to reindex all products using the Algolia Ingestion API
 * @param {Object} parameters - job parameters
 * @returns {dw.system.Status} - successful Job run
 */
function runProductExport(parameters) {
    var Status = require('dw/system/Status');
    var ProductMgr = require('dw/catalog/ProductMgr');

    var logger = require('dw/system/Logger').getLogger('algolia');

    var counterProductsTotal = 0;
    var productsIterator = ProductMgr.queryAllSiteProductsSorted();
    var start = Date.now();

    var operations = [];
    var nextProduct = getNextProductModel(productsIterator, 'locale');
    while (nextProduct) {
        ++counterProductsTotal;

        var productUpdate = new AlgoliaOperation('addObject', nextProduct);

        operations.push(productUpdate);
        if (operations.length === 1000) {
            logger.info('Fake batch of 1000... (total: ' + counterProductsTotal + ')');
            operations = [];
        }

        nextProduct = getNextProductModel(productsIterator);
    }
    logger.info('Processed ' + counterProductsTotal + ' records  in ' + (Date.now() - start) + 'ms');
    productsIterator.close();

    return new Status(Status.OK);
}

module.exports.execute = runProductExport;
