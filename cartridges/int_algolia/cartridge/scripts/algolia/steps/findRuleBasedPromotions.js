'use strict';

var ArrayList = require('dw/util/ArrayList');
var Site = require('dw/system/Site');
var ProductMgr = require('dw/catalog/ProductMgr');
var PromotionMgr = require('dw/campaign/PromotionMgr');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var HashMap = require('dw/util/HashMap');
var StringUtils = require('dw/util/StringUtils');
var System = require('dw/system/System');
var Transaction = require('dw/system/Transaction');

var algoliaLogger = require('dw/system/Logger').getLogger('algolia');
var products = null;
var campaigns = [];
var RuleBasedPromos = new HashMap();
var customObject;
var isJobEnabled = false;


/**
 * before-step-function (steptypes.json)
 * Any returns from this function result in skipping to the afterStep() function (omitting read-process-writealtogether)
 * with the "success" parameter passed to it set to false.
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.beforeStep = function(parameters, stepExecution) {
    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

    const additionalAttributes = algoliaData.getSetOfArray('AdditionalAttributes');
    additionalAttributes.map(function(attribute) {
        if (attribute === 'promotions') {
            isJobEnabled = true;
        }
    });

    if (!isJobEnabled) {
        return;
    }

    algoliaLogger.info('beforeStep: Starting execution');
    campaigns = PromotionMgr.getCampaigns().toArray();
    algoliaLogger.info('beforeStep: Found {0} campaigns', campaigns.length);
    /* --- getting all products assigned to the site --- */
    products = ProductMgr.queryAllSiteProducts();
    var customObjectID = 'promos__' + StringUtils.formatCalendar(System.getCalendar(), 'yyMMdd-HHmmss');
    var customObjects = CustomObjectMgr.getAllCustomObjects('RuleBasedPromos');
    var i = 0;
    Transaction.wrap(function() {
        while (customObjects.hasNext()) {
            i++;
            var existingCustomObject = customObjects.next();
            if (existingCustomObject.custom.ruleBasedPromosId.indexOf('archived_') === -1) {
                existingCustomObject.custom.ruleBasedPromosId = i + '_archived_' + existingCustomObject.custom.ruleBasedPromosId;
            }
        }
        customObject = CustomObjectMgr.createCustomObject('RuleBasedPromos', customObjectID);
    });
}

/**
 * total-count-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {number} total number of products
 */
exports.getTotalCount = function(parameters, stepExecution) {
    var count = products ? products.count : 0;
    algoliaLogger.info('getTotalCount: Total number of products: {0}', count);
    return count;
}

/**
 * read-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {dw.catalog.Product} B2C Product object
 */
exports.read = function(parameters, stepExecution) {
    if (products && products.hasNext()) {
        return products.next();
    }
}

/**
 * process-function (steptypes.json)
 * @param {dw.catalog.Product} product one single product
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {Array} an array that contains one AlgoliaOperation per locale:
 *                  [ "action": "addObject", "indexName": "sfcc_products_en_US", body: { "id": "008884303989M", "name": "Fitted Shirt" },
 *                    "action": "addObject", "indexName": "sfcc_products_fr_FR", body: { "id": "008884303989M", "name": "Chemise ajustée" } ]
 */
exports.process = function(product, parameters, stepExecution) {
    var now = new Date();
    var oneMonthLater = new Date(now.getTime());
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    var productID = product.ID;

    for (var i = 0; i < campaigns.length; i++) {
        var campaign = campaigns[i];
        var campaignPromos = PromotionMgr.getActivePromotionsForCampaign(campaign, now, oneMonthLater);
        var qualifiedPromos = campaignPromos.getProductPromotionsForQualifyingProduct(product);
        var qualifiedPromosArr = qualifiedPromos.toArray();

        for (var j = 0; j < qualifiedPromosArr.length; j++) {
            var promo = qualifiedPromosArr[j];
            var promoID = promo.ID;
            RuleBasedPromos.put(promoID, 1);
        }
    }

    return null;
}

/**
 * write-function (steptypes.json)
 * Any returns from this function result in the "success" parameter of "afterStep()" to become false.
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.send = function(parameters, stepExecution) {
    algoliaLogger.info('send: RuleBasedPromos count: {0}', RuleBasedPromos.size());
    algoliaLogger.info('send: RuleBasedPromos: {0}', JSON.stringify(RuleBasedPromos.values().toArray()));
    //stringify the RuleBasedPromos
    var x =  RuleBasedPromos.keySet();
    var y = x.toArray();
    algoliaLogger.info('send: set: {0}', JSON.stringify(y));
    var promos = JSON.stringify(RuleBasedPromos.values().toArray());
    // Write the RuleBasedPromos to the custom Object
    customObject.custom.promotions = JSON.stringify(y);
}

/**
 * after-step-function (steptypes.json)
 * @param {boolean} success any prior return statements and errors will result in this parameter becoming false
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.afterStep = function(success, parameters, stepExecution) {

    if (products && products.close) {
        products.close();
    }

}
