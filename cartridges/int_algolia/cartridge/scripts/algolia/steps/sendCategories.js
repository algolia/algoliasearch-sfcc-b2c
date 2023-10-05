const catalogMgr = require('dw/catalog/CatalogMgr');
const logger = require('dw/system/Logger').getLogger('algolia', 'Algolia');
const Site = require('dw/system/Site');
const Status = require('dw/system/Status');

const AlgoliaLocalizedCategory = require('*/cartridge/scripts/algolia/model/algoliaLocalizedCategory');

var utils = require('../lib/utils');

/**
 * Converts a given dw.catalog.Category and its subcategories to objects ready to be indexed
 * @param {dw.catalog.Category} category - A category
 * @param {string} catalogId - ID of the site catalog
 * @param {string} locale - The locale to use to fetch the categories properties
 * @returns {Array} the category and all its subcategories converted to objects ready to be indexed
 */
function getSubCategoryModels(category, catalogId, locale) {
    var res = [];
    if (!category.custom || !category.custom.showInMenu
      || (!category.hasOnlineProducts() && !category.hasOnlineSubCategories())) {
        return res;
    }

    res.push(new AlgoliaLocalizedCategory(category, catalogId, locale));

    var subCategories = category.getOnlineSubCategories();
    utils.forEach(subCategories, function (subcategory) {
        res = res.concat(getSubCategoryModels(subcategory, catalogId, locale));
    });
    return res;
}

/**
 * Job that fetches all categories of the site catalog and converts them into AlgoliaOperations
 * and send them for indexing.
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution job step execution
 * @returns {dw.system.Status} - status
 */
function runCategoryExport(parameters, stepExecution) {
    const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    const jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    const reindexHelper = require('*/cartridge/scripts/algolia/helper/reindexHelper');
    const algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');
    const AlgoliaJobLog = require('*/cartridge/scripts/algolia/helper/AlgoliaJobLog');

    var currentSite = Site.getCurrent();
    var siteLocales = currentSite.getAllowedLocales();
    var siteCatalog = catalogMgr.getSiteCatalog();
    var siteCatalogID = siteCatalog.getID();
    var siteRootCategory = siteCatalog.getRoot();
    var topLevelCategories = siteRootCategory.hasOnlineSubCategories()
        ? siteRootCategory.getOnlineSubCategories().iterator() : null;

    var jobLog = new AlgoliaJobLog(stepExecution.getJobExecution().getJobID(), 'category');

    logger.info('Site: ' + currentSite.getName() +'. Enabled locales: ' + siteLocales.toArray());
    logger.info('CatalogID: ' + siteCatalogID);

    algoliaIndexingAPI.setJobInfo({
        jobID: stepExecution.getJobExecution().getJobID(),
        stepID: stepExecution.getStepID()
    });

    try {
        logger.info('Deleting existing temporary indices...');
        var deletionTasks = reindexHelper.deleteTemporaryIndices('categories', siteLocales.toArray());
        reindexHelper.waitForTasks(deletionTasks);
        logger.info('Temporary indices deleted. Starting indexing...');
    } catch (e) {
        return new Status(Status.ERROR, '', 'Failed to delete temporaries: ' + e.message);
    }

    var status;
    var lastIndexingTasks = {};
    while (topLevelCategories.hasNext()) {
        var batch = [];
        var category = topLevelCategories.next();
        for (let l = 0; l < siteLocales.size(); ++l) {
            var locale = siteLocales[l];
            var tmpIndexName = algoliaData.calculateIndexName('categories', locale) + '.tmp';
            var localizedCategories = getSubCategoryModels(category, siteCatalogID, locale);

            for (let i = 0; i < localizedCategories.length; ++i) {
                batch.push(new jobHelper.AlgoliaOperation('addObject', localizedCategories[i], tmpIndexName));
            }
        }

        jobLog.processedRecordsToUpdate += batch.length;

        if (batch.length === 0) {
            logger.info('No records generated for category: ' + category.getID() + ', continuing...');
            continue;
        }

        jobLog.processedDate = new Date();

        logger.info('Sending a batch of ' + batch.length + ' records for top-level category id: ' + category.getID());

        status = algoliaIndexingAPI.sendMultiIndicesBatch(batch);
        if (status.error) {
            jobLog.failedRecords += batch.length;
            jobLog.failedChunks++;
            jobLog.sendError = true;
        }
        else {
            jobLog.sentRecords += batch.length;
            jobLog.sentChunks++;

            // Store Algolia indexing task IDs
            var taskIDs = status.object.body.taskID;
            Object.keys(taskIDs).forEach(function (taskIndexName) {
                lastIndexingTasks[taskIndexName] = taskIDs[taskIndexName];
            });
        }
    }

    reindexHelper.finishAtomicReindex('categories', siteLocales.toArray(), lastIndexingTasks);

    jobLog.processedRecords = jobLog.processedRecordsToUpdate / siteLocales.size(); // number of categories for each locale
    jobLog.sendDate = new Date();
    jobLog.writeToCustomObject();
}

module.exports.runCategoryExport = runCategoryExport;

// for testing
module.exports.getSubCategoryModels = getSubCategoryModels;
