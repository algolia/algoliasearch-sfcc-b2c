'use strict';

var Status = require('dw/system/Status');
var Logger = require('dw/system/Logger');

var logger = Logger.getLogger('TestJob', 'TestJob');
var itemsToProcess = 10;
var currentItem = 0;

/**
 * @function beforeStep
 * @description Function called before the execution of the job step
 * @param {Object} parameters - The parameters passed to the job step
 * @param {dw.job.JobStepExecution} stepExecution - The step execution instance
 */
exports.beforeStep = function(parameters, stepExecution) {
    logger.info('Before Step: Job "{0}" - Step "{1}" starting execution.', stepExecution.getJobExecution().getJobID(), stepExecution.getStepID());
    currentItem = 0;
};

/**
 * @function getTotalCount
 * @description Returns the total number of items to be processed
 * @returns {number} The total count of items
 */
exports.getTotalCount = function() {
    return itemsToProcess;
};

/**
 * @function read
 * @description Reads and returns the next item to be processed
 * @returns {Object|null} The next item to process or null if all items have been processed
 */
exports.read = function() {
    if (currentItem < itemsToProcess) {
        currentItem++;
        return {
            id: currentItem,
            name: 'Test Item ' + currentItem
        };
    }
    return null; // Return null when all items have been processed
};

/**
 * @function process
 * @description Processes a single item
 * @param {Object} item - The item to process
 * @returns {Object} The processed item
 */
exports.process = function(item) {
    logger.info('Processing item: ' + JSON.stringify(item));

    var PromotionMgr = require('dw/campaign/PromotionMgr');

    var exampleProductCampaign = PromotionMgr.getCampaign('exampleProduct');

    var today = new Date();
    var fiveYearsLater = new Date();
    fiveYearsLater.setFullYear(today.getFullYear() + 5);
    
    var activeCustomerPromotions = PromotionMgr.getActiveCustomerPromotions();
    var exampleCampaignBasedProductPromotion = PromotionMgr.getActiveCustomerPromotionsForCampaign(exampleProductCampaign, today, fiveYearsLater);

    var activePromotionsforCampaign = PromotionMgr.getActivePromotionsForCampaign(exampleProductCampaign, today, fiveYearsLater);

    var promotionPlan = PromotionMgr.getActivePromotions();
    var promotions = promotionPlan.getPromotions().toArray();

    var product = require('dw/catalog/ProductMgr').getProduct('008884304009M');

    for (var i = 0; i < promotions.length; i++) {
        var promotion = promotions[i];
        logger.info('Promotion: ' + promotion.getID());
        logger.error('Promotional Price: ' + promotion.getPromotionalPrice(product));
    }

    item.processed = true;
    return item;
};

/**
 * @function write
 * @description Writes the processed items
 * @param {Array} items - The array of processed items
 */
exports.write = function(items) {
    logger.info('Writing ' + items.length + ' items');
    // Add logic to write or save the processed items
};

/**
 * @function afterStep
 * @description Function called after the execution of the job step
 * @param {boolean} success - Indicates if the step was successful
 * @param {Object} parameters - The parameters passed to the job step
 * @param {dw.job.JobStepExecution} stepExecution - The step execution instance
 */
exports.afterStep = function(success, parameters, stepExecution) {
    if (success) {
        logger.info('After Step: Job "{0}" - Step "{1}" finished successfully.', stepExecution.getJobExecution().getJobID(), stepExecution.getStepID());
    } else {
        logger.error('After Step: Job "{0}" - Step "{1}" finished with errors.', stepExecution.getJobExecution().getJobID(), stepExecution.getStepID());
    }
};