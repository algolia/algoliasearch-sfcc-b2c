const ArrayList = require('dw/util/ArrayList');
const catalogMgr = require('dw/catalog/CatalogMgr');
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
 * Job that fetches all categories of the site catalog,
 * converts them into AlgoliaOperations and sends them for indexing.
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution job step execution
 * @returns {dw.system.Status} - status
 */
function runCategoryExport(parameters, stepExecution) {
    const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    const jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    const reindexHelper = require('*/cartridge/scripts/algolia/helper/reindexHelper');
    const algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');
    const AlgoliaJobReport = require('*/cartridge/scripts/algolia/helper/AlgoliaJobReport');
    const logger = jobHelper.getAlgoliaLogger();

    var currentSite = Site.getCurrent();
    var siteLocales = currentSite.getAllowedLocales();
    var siteCatalog = catalogMgr.getSiteCatalog();
    var siteCatalogID = siteCatalog.getID();
    var siteRootCategory = siteCatalog.getRoot();

    var jobReport = new AlgoliaJobReport(stepExecution.getJobExecution().getJobID(), 'category');
    jobReport.startTime = new Date();

    const paramLocalesForIndexing = algoliaData.csvStringToArray(parameters.localesForIndexing);
    logger.info('localesForIndexing parameter: ' + paramLocalesForIndexing);
    const localesForIndexing = paramLocalesForIndexing.length > 0 ?
        paramLocalesForIndexing :
        algoliaData.getSetOfArray('LocalesForIndexing');
    localesForIndexing.forEach(function(locale) {
        if (siteLocales.indexOf(locale) < 0) {
            jobReport.endTime = new Date();
            jobReport.error = true;
            jobReport.errorMessage = 'Locale "' + locale + '" is not enabled on ' + currentSite.getName();
            jobReport.writeToCustomObject();
            throw new Error(jobReport.errorMessage);
        }
    })
    if (localesForIndexing.length > 0) {
        siteLocales = new ArrayList(localesForIndexing);
    }

    logger.info('Will index ' + siteLocales.size() + ' locales for ' + currentSite.getName() + ': ' + siteLocales.toArray());
    jobReport.siteLocales = siteLocales.size();
    logger.info('CatalogID: ' + siteCatalogID);

    algoliaIndexingAPI.setJobInfo({
        jobID: stepExecution.getJobExecution().getJobID(),
        stepID: stepExecution.getStepID()
    });

    try {
        logger.info('Deleting existing temporary indices...');
        var deletionTasks = reindexHelper.deleteTemporaryIndices('categories', siteLocales.toArray());
        reindexHelper.waitForTasks(deletionTasks);
        logger.info('Temporary indices deleted. Copying index settings from production and starting indexing...');
        reindexHelper.copySettingsFromProdIndices('categories', siteLocales.toArray());
    } catch (e) {
        jobReport.endTime = new Date();
        jobReport.error = true;
        jobReport.errorMessage = 'Failed to delete temporary indices: ' + e.message;
        jobReport.writeToCustomObject();
        return new Status(Status.ERROR, '', 'Failed to delete temporary indices: ' + e.message);
    }

    var lastIndexingTasks = {};
    for (let l = 0; l < siteLocales.size(); ++l) {
        var locale = siteLocales.get(l);
        var topLevelCategories = siteRootCategory.getOnlineSubCategories().iterator();
        var tmpIndexName = algoliaData.calculateIndexName('categories', locale) + '.tmp';
        var batch = [];

        while (topLevelCategories.hasNext()) {
            var category = topLevelCategories.next();
            var localizedCategories = getSubCategoryModels(category, siteCatalogID, locale);

            for (let i = 0; i < localizedCategories.length; ++i) {
                batch.push(new jobHelper.AlgoliaOperation('addObject', localizedCategories[i], tmpIndexName));
            }
        }

        // We only count the number of items processed for the first locale
        if (l === 0) {
            jobReport.processedItemsToSend += batch.length; // number of categories for the first locale
            jobReport.processedItems = jobReport.processedItemsToSend; // same value, there's no filtering for categories
        }
        jobReport.recordsToSend += batch.length;

        logger.info('Sending a batch of ' + batch.length + ' records for locale ' + locale);

        var result;
        try {
            var retryableBatchRes = reindexHelper.sendRetryableBatch(batch);
            result = retryableBatchRes.result;
            jobReport.recordsFailed += retryableBatchRes.failedRecords;
        } catch (e) {
            logger.error('Error while sending batch to Algolia: ' + e);
        }

        if (result && result.ok) {
            jobReport.recordsSent += batch.length;
            jobReport.chunksSent++;

            // Store Algolia indexing task IDs
            var taskIDs = result.object.body.taskID;
            Object.keys(taskIDs).forEach(function (taskIndexName) {
                lastIndexingTasks[taskIndexName] = taskIDs[taskIndexName];
            });
        } else {
            let errorMessage = 'Failed to send categories: ' + result.errorMessage + ', stopping job.';

            jobReport.recordsFailed += batch.length;
            jobReport.chunksFailed++;
            jobReport.error = true;
            jobReport.errorMessage = errorMessage;

            jobReport.endTime = new Date();
            jobReport.writeToCustomObject();

            // return ERROR if at least one batch failed, don't proceed with the atomic reindexing
            logger.error(errorMessage);
            return new Status(Status.ERROR, '', errorMessage);
        }
    }

    if (jobReport.recordsFailed === 0) {
        reindexHelper.finishAtomicReindex('categories', siteLocales.toArray(), lastIndexingTasks);
    } else {
        jobReport.error = true;
        jobReport.errorMessage = 'Some records failed to be indexed (check the logs for details). Not moving temporary indices to production.';
    }

    jobReport.endTime = new Date();
    jobReport.writeToCustomObject();

    if (!jobReport.error) {
        logger.info('Indexing completed successfully.');
    } else {
        // Showing the job in ERROR in the history
        throw new Error(jobReport.errorMessage);
    }
}

module.exports.runCategoryExport = runCategoryExport;

// for testing
module.exports.getSubCategoryModels = getSubCategoryModels;
