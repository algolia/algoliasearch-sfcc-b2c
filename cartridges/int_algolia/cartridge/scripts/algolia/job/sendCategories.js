var catalogMgr = require('dw/catalog/CatalogMgr');
var Site = require('dw/system/Site');
var logger = require('dw/system/Logger').getLogger('algolia', 'Algolia');

var AlgoliaLocalizedCategory = require('*/cartridge/scripts/algolia/model/algoliaLocalizedCategory');
var utils = require('../lib/utils');

/**
 * Converts a given dw.catalog.Category and its sub categories to objects ready to be indexed
 * @param {dw.catalog.Category} category - A category
 * @param {string} catalogId - ID of the site catalog
 * @param {string} locale - The locale to use to fetch the categories properties
 * @returns {Array} the category and all its subcategories converted to objects ready to be indexed
 */
function getSubCategoriesModels(category, catalogId, locale) {
    var res = [];
    if (!category.custom || !category.custom.showInMenu
      || (!category.hasOnlineProducts() && !category.hasOnlineSubCategories())) {
        return res;
    }

    res.push(new AlgoliaLocalizedCategory(category, catalogId, locale));

    var subCategories = category.getOnlineSubCategories();
    utils.forEach(subCategories, function (subcategory) {
        res = res.concat(getSubCategoriesModels(subcategory, catalogId, locale));
    });
    return res;
}

/**
 * Job that fetch all categories of the site catalog, convert them into AlgoliaOperations
 * and send them for indexing.
 * @param {dw.util.HashMap} parameters job step parameters
 */
function runCategoryExport(parameters) {
    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    var reindexHelper = require('*/cartridge/scripts/algolia/helper/reindexHelper');
    var algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');

    var currentSite = Site.getCurrent();
    var siteLocales = currentSite.getAllowedLocales();
    var siteCatalog = catalogMgr.getSiteCatalog();
    var siteCatalogId = siteCatalog.getID();
    var siteRootCategory = siteCatalog.getRoot();
    var topLevelCategories = siteRootCategory.hasOnlineSubCategories()
        ? siteRootCategory.getOnlineSubCategories().iterator() : null;

    var updateLogType = 'LastCategorySyncLog';

    var categoryLogData = algoliaData.getLogData(updateLogType);
    categoryLogData.processedDate = algoliaData.getLocalDateTime(new Date());
    categoryLogData.processedError = false;
    categoryLogData.processedErrorMessage = '';
    categoryLogData.processedRecords = 0;
    categoryLogData.processedToUpdateRecords = 0;

    categoryLogData.sendError = false;
    categoryLogData.sendErrorMessage = '';
    categoryLogData.sentChunks = 0;
    categoryLogData.sentRecords = 0;
    categoryLogData.failedChunks = 0;
    categoryLogData.failedRecords = 0;

    logger.info('Site: ' + currentSite.getName() +'. Enabled locales: ' + siteLocales.toArray())
    logger.info('CatalogID: ' + siteCatalogId)

    logger.info('Deleting existing temporary indices...');
    var deletionTasks = reindexHelper.deleteTemporariesIndices('categories', siteLocales.toArray());
    reindexHelper.waitForTasks(deletionTasks);
    logger.info('Temporary indices deleted. Starting indexing...');

    var status;
    var lastIndexingTasks = {};
    while (topLevelCategories.hasNext()) {
        var batch = [];
        var category = topLevelCategories.next();
        for (let l = 0; l < siteLocales.size(); ++l) {
            var locale = siteLocales[l];
            var tmpIndexName = algoliaData.calculateIndexName('categories', locale) + '.tmp';
            var localizedCategories = getSubCategoriesModels(category, siteCatalogId, locale);

            for (let i = 0; i < localizedCategories.length; ++i) {
                batch.push(new jobHelper.AlgoliaOperation('addObject', localizedCategories[i], tmpIndexName));
            }
        }

        categoryLogData.processedRecords += batch.length;
        categoryLogData.processedToUpdateRecords += batch.length;

        if (batch.length === 0) {
            logger.info('No records generated for category: ' + category.getID() + ', continuing...');
            continue;
        }

        logger.info('Sending a batch of ' + batch.length + ' records for top-level category id: ' + category.getID());
        status = algoliaIndexingAPI.sendMultiIndicesBatch(batch);
        if (status.error) {
            categoryLogData.failedRecords += batch.length;
            categoryLogData.failedChunks++;
            categoryLogData.sendError = true;
        }
        else {
            categoryLogData.sentRecords += batch.length;
            categoryLogData.sentChunks++;

            var taskIDs = status.object.body.taskID;
            Object.keys(taskIDs).forEach(function (taskIndexName) {
                lastIndexingTasks[taskIndexName] = taskIDs[taskIndexName];
            });
        }
    }

    categoryLogData.sendDate = algoliaData.getLocalDateTime(new Date());

    reindexHelper.finishAtomicReindex('categories', siteLocales.toArray(), lastIndexingTasks);

    algoliaData.setLogData(updateLogType, categoryLogData);
}

module.exports.execute = runCategoryExport;

// for testing
module.exports.getSubCategoriesModels = getSubCategoriesModels;
