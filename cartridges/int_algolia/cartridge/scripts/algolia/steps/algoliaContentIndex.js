'use strict';

var Site = require('dw/system/Site');
var ContentSearchModel = require('dw/content/ContentSearchModel');
var logger;

// job step parameters
var paramAttributeList, paramFailureThresholdPercentage, includedContent;

// Algolia requires
var algoliaData, AlgoliaLocalizedContent, jobHelper, reindexHelper, algoliaIndexingAPI, contentFilter, AlgoliaJobReport, algoliaSplitter, algoliaContentConfig;
var indexingOperation;

// logging-related variables
var jobReport;

var contents = [], siteLocales, nonLocalizedAttributes = [], attributesToSend, count;
var lastIndexingTasks = {};


/**
 * before-step-function (steptypes.json)
 * Any returns from this function result in skipping to the afterStep() function (omitting read-process-writealtogether)
 * with the "success" parameter passed to it set to false.
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.beforeStep = function(parameters, stepExecution) {
    algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    AlgoliaLocalizedContent = require('*/cartridge/scripts/algolia/model/algoliaLocalizedContent');
    jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    reindexHelper = require('*/cartridge/scripts/algolia/helper/reindexHelper');
    algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');
    logger = jobHelper.getAlgoliaLogger();
    algoliaContentConfig = require('*/cartridge/scripts/algolia/lib/algoliaContentConfig');
    AlgoliaJobReport = require('*/cartridge/scripts/algolia/helper/AlgoliaJobReport');
    algoliaSplitter = require('*/cartridge/scripts/algolia/lib/algoliaSplitter');

    /* --- initializing custom object logging --- */
    jobReport = new AlgoliaJobReport(stepExecution.getJobExecution().getJobID(), 'content');
    jobReport.startTime = new Date();


    /* --- parameters --- */
    paramAttributeList = algoliaData.csvStringToArray(parameters.attributeList);
    paramFailureThresholdPercentage = parameters.failureThresholdPercentage || 0;
    includedContent = parameters.includedContent || 'allContents';


    attributesToSend = algoliaContentConfig.defaultAttributes;
    paramAttributeList.map(function(attribute) {
        if (attributesToSend.indexOf(attribute) < 0) {
            attributesToSend.push(attribute);
        }
    });

    logger.info('attributeList parameter: ' + paramAttributeList);
    logger.info('Actual attributes to be sent: ' + JSON.stringify(attributesToSend));

    indexingOperation = 'addObject';

    /* --- non-localized attributes --- */
    Object.keys(algoliaContentConfig.attributeConfig).forEach(function(attributeName) {
        if (!algoliaContentConfig.attributeConfig[attributeName].localized &&
          attributesToSend.indexOf(attributeName) >= 0) {
            nonLocalizedAttributes.push(attributeName);
        }
    });
    logger.info('Non-localized attributes: ' + JSON.stringify(nonLocalizedAttributes));


    /* --- site locales --- */
    siteLocales = Site.getCurrent().getAllowedLocales();
    logger.info('Enabled locales for ' + Site.getCurrent().getName() + ': ' + siteLocales.toArray());
    jobReport.siteLocales = siteLocales.size();

    algoliaIndexingAPI.setJobInfo({
        jobID: stepExecution.getJobExecution().getJobID(),
        stepID: stepExecution.getStepID(),
    });

    try {
        logger.info('Deleting existing temporary indices...');
        var deletionTasks = reindexHelper.deleteTemporaryIndices('contents', siteLocales.toArray());
        reindexHelper.waitForTasks(deletionTasks);
        logger.info('Temporary indices deleted. Copying index settings from production and starting indexing...');
        reindexHelper.copySettingsFromProdIndices('contents', siteLocales.toArray());
    } catch (e) {
        jobReport.endTime = new Date();
        jobReport.error = true;
        jobReport.errorMessage = 'Failed to delete temporary indices: ' + e.message;
        jobReport.writeToCustomObject();
        throw e;
    }


    /* --- getting all contents assigned to the site --- */
    var apiContentSearchModel = new ContentSearchModel();
    apiContentSearchModel.setRecursiveFolderSearch(true);
    apiContentSearchModel.setFilteredByFolder(false);
    apiContentSearchModel.setFolderID('root');
    apiContentSearchModel.search();
    contents = apiContentSearchModel.getContent();
    count = apiContentSearchModel.getCount();
    logger.info('failureThresholdPercentage parameter: ' + paramFailureThresholdPercentage);
    logger.info('Starting indexing...')
}

/**
 * total-count-function (steptypes.json)å
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {number} total number of contents
 */
exports.getTotalCount = function(parameters, stepExecution) {
    return count;

}

/**
 * read-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {dw.content.Content} B2C Content object
 */
exports.read = function(parameters, stepExecution) {
    if (contents.hasNext()) {
        return contents.next();
    }
}

/**
 * process-function (steptypes.json)
 * @param {dw.content.Content} content one single content
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {Array} an array that contains one AlgoliaOperation per locale:
 *                  [ "action": "addObject", "indexName": "sfcc_contents_en_US", body: { "id": "terms_1", "name": "Terms" },
 *                    "action": "addObject", "indexName": "sfcc_contents_fr_FR", body: { "id": "new_sales", "name": "New Sales" } ]
 */
exports.process = function(content, parameters, stepExecution) {

    jobReport.processedItems++; // counts towards the total number of contents processed

    var algoliaOperations = [];
    // Pre-fetch a partial model containing all non-localized attributes, to avoid re-fetching them for each locale
    var baseModel = new AlgoliaLocalizedContent({ content: content, locale: 'default', attributeList: nonLocalizedAttributes, includedContent: includedContent });

    for (let l = 0; l < siteLocales.size(); ++l) {
        var locale = siteLocales[l];
        var indexName = algoliaData.calculateIndexName('contents', locale);
        indexName += '.tmp';
        let localizedContent = new AlgoliaLocalizedContent({ content: content, locale: locale, attributeList: attributesToSend, baseModel: baseModel, includedContent: includedContent });
        let splits = [];
        let splittingTag = parameters.splittingTag;
        if (attributesToSend.indexOf('body') >= 0 && localizedContent.body) {
            let maxRecordBytes = algoliaSplitter.getMaxBodySize(localizedContent);
            splits = algoliaSplitter.splitHtmlContent(localizedContent.body, maxRecordBytes, splittingTag);
            for (let i = 0; i < splits.length; i++) {
                var splittedContent = {};
                for (var key in localizedContent) {
                    if (localizedContent.hasOwnProperty(key)) {
                        splittedContent[key] = localizedContent[key];
                    }
                }
                splittedContent.objectID = localizedContent.objectID + '_' + i;
                splittedContent.id = localizedContent.id;
                splittedContent.algolia_chunk_order = i;
                splittedContent.body = splits[i];
                algoliaOperations.push(new jobHelper.AlgoliaOperation(indexingOperation, splittedContent, indexName));
            }
        } else {
            algoliaOperations.push(new jobHelper.AlgoliaOperation(indexingOperation, localizedContent, indexName));
        }
    }

    jobReport.processedItemsToSend++; // number of actual contents processed
    jobReport.recordsToSend += algoliaOperations.length; // number of records to be sent to Algolia (one per locale per content)

    return algoliaOperations;
}

/**
 * write-function (steptypes.json)
 * Any returns from this function result in the "success" parameter of "afterStep()" to become false.
 * @param {dw.util.List} algoliaOperations a List containing ${chunkSize} of Algolia operations Lists ready to be sent
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.send = function(algoliaOperations, parameters, stepExecution) {
    // algoliaOperations contains all the returned Algolia operations from process() as a List of arrays
    var algoliaOperationsArray = algoliaOperations.toArray();
    var contentCount = algoliaOperationsArray.length;

    var batch = [];
    for (let i = 0; i < contentCount; ++i) {
        var contentOperations = algoliaOperationsArray[i].toArray();
        batch = batch.concat(contentOperations);
    }

    var retryableBatchRes = reindexHelper.sendRetryableBatch(batch);
    var result = retryableBatchRes.result;
    jobReport.recordsFailed += retryableBatchRes.failedRecords;

    if (result.ok) {
        jobReport.recordsSent += batch.length;
        jobReport.chunksSent++;

        // Store Algolia indexing task IDs.
        // When performing a fullContentReindex, afterStep will wait for the last indexing tasks to complete.
        var taskIDs = result.object.body.taskID;
        Object.keys(taskIDs).forEach(function (taskIndexName) {
            lastIndexingTasks[taskIndexName] = taskIDs[taskIndexName];
        });
    } else {
        jobReport.recordsFailed += batch.length;
        jobReport.chunksFailed++;
    }
}

/**
 * after-step-function (steptypes.json)
 * @param {boolean} success any prior return statements and errors will result in this parameter becoming false
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.afterStep = function(success, parameters, stepExecution) {
    // An exit status cannot be defined for a chunk-oriented script module.
    // Chunk modules always finish with either OK or ERROR.
    // "success" conveys whether an error occurred in any previous chunks or not.
    // Any prior return statements will set success to false (even if it returns Status.OK).

    if (success) {
        jobReport.error = false;
        jobReport.errorMessage = '';
    } else {
        jobReport.error = true;
        jobReport.errorMessage = 'An error occurred during the job. Please see the error log for more details.';
    }

    logger.info('Total number of contents: {0}', jobReport.processedItems);
    logger.info('Number of contents marked for sending: {0}', jobReport.processedItemsToSend);
    logger.info('Number of locales configured for the site: {0}', jobReport.siteLocales);
    logger.info('Records sent: {0}; Records failed: {1}', jobReport.recordsSent, jobReport.recordsFailed);
    logger.info('Chunks sent: {0}; Chunks failed: {1}', jobReport.chunksSent, jobReport.chunksFailed);

    const failurePercentage = +((jobReport.recordsFailed / jobReport.recordsToSend * 100).toFixed(2)) || 0;

    if (failurePercentage <= paramFailureThresholdPercentage) {
        reindexHelper.finishAtomicReindex('contents', siteLocales.toArray(), lastIndexingTasks);
    } else {
        // don't proceed with the atomic reindexing
        jobReport.error = true;
        jobReport.errorMessage = 'The percentage of records that failed to be indexed (' + failurePercentage + '%) exceeds the failureThresholdPercentage (' +
             paramFailureThresholdPercentage + '%). Not moving temporary indices to production. Check the logs for details.';
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

// For testing
exports.__setLastIndexingTasks = function(indexingTasks) {
    lastIndexingTasks = indexingTasks;
};
exports.__getAttributesToSend = function() {
    return attributesToSend;
}
exports.__getJobReport = function() {
    return jobReport;
}
