var ProductMgr = require('dw/catalog/ProductMgr');

var algoliaData;
var AlgoliaLocalizedProduct;

var logger;
var products;

/**
 * Operation class that represents an Algolia batch operation: https://www.algolia.com/doc/rest-api/search/#batch-write-operations
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
 * before-step-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.beforeStep = function(parameters, stepExecution) {
    algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    AlgoliaLocalizedProduct = require('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
    logger = require('dw/system/Logger').getLogger('algolia', 'Algolia');

    products = ProductMgr.queryAllSiteProducts();
}

/**
 * total-count-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {number} total number of products
 */
exports.getTotalCount = function(parameters, stepExecution) {
    return products.count;
}

/**
 * read-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {dw.catalog.Product} B2C Product object
 */
exports.read = function(parameters, stepExecution) {
    if (products.hasNext()) {
        logger.info('[READ] Getting next product...');
        var product = products.next();
        logger.info('[READ] Got product ' + product.ID);
        return product;
    }
}

/**
 * process-function (steptypes.json)
 * @param {dw.catalog.Product} product a product
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {Object} and object that contains one localized Product per locale:
 *                   { "en_US": { "id": "008884303989M", "name": "Fitted Shirt" },
 *                     "fr_FR": { "id": "008884303989M", "name": "Chemise ajustée" } }
 */
exports.process = function(product, parameters, stepExecution) {
    logger.info('[PROCESS] Processing product ' + product.ID + '...');
    var localizedProduct = new AlgoliaLocalizedProduct(product);
    var algoliaOperation = new AlgoliaOperation('addObject', localizedProduct)
    logger.info('[PROCESS] Done processing product ' + product.ID);
    return algoliaOperation;
}

/**
 * write-function (steptypes.json)
 * Any returns from this function result in the "success" parameter of "afterStep()" to become false.
 * @param {dw.util.List} algoliaLocalizedProducts a List containing ${chunkSize} of objects referencing one localized Product per locale
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.send = function(algoliaLocalizedProducts, parameters, stepExecution) {
    logger.info('[SEND] Fake batch of 1000...');
}

/**
 * after-step-function (steptypes.json)
 * @param {boolean} success any prior return statements and errors will result in this parameter becoming false
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.afterStep = function(success, parameters, stepExecution) {
    products.close();
}
