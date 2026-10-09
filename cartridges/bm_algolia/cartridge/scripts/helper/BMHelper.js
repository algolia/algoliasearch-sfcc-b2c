'use strict';

/**
 * Returns the latest AlgoliaJobReport custom objects for each job
 * @returns {Array} - an array of arrays of AlgoliaJobReport objects, each outer array representing a job
 */
function getLatestCOReportsByJob() {
    const CustomObjectMgr = require('dw/object/CustomObjectMgr');
    const AlgoliaJobReport = require('*/cartridge/scripts/algolia/helper/AlgoliaJobReport');

    const nrReportsPerJob = 3;
    var allJobReports;

    try {
        allJobReports = CustomObjectMgr.getAllCustomObjects('AlgoliaJobReport').asList().toArray();
    } catch (e) { // eslint-disable-line no-unused-vars
        return false; // false indicates that the custom object type does not exist
    }

    // create a list of unique job IDs
    const uniqueJobIDs = [];
    for (let i = 0; i < allJobReports.length; i++) {
        let jobID = allJobReports[i].custom.jobID;
        if (uniqueJobIDs.indexOf(jobID) === -1) {
            uniqueJobIDs.push(jobID);
        }
    }
    uniqueJobIDs.sort();

    let reportsByJob = [];
    for (let i = 0; i < uniqueJobIDs.length; i++) {
        let jobID = uniqueJobIDs[i];

        // Precompute the deep link once per job so the template never calls a platform
        // API (URLUtils/CSRFProtection) during rendering. An empty string means the link
        // could not be built and the template renders the job ID as plain text.
        let jobBMLink = getJobBMLink(jobID);

        let reports = CustomObjectMgr.queryCustomObjects('AlgoliaJobReport', 'custom.jobID = {0} ', 'creationDate desc', jobID).asList().toArray();
        let formattedReports = reports.map(function(report) {
            let formattedReport = new AlgoliaJobReport().formatCustomObject(report);
            formattedReport.bmLink = jobBMLink;
            return formattedReport;
        });
        reportsByJob.push(formattedReports.slice(0, nrReportsPerJob)); // last three reports only
    }

    return reportsByJob;
}

/**
 * Returns the Business Manager link for a job, or an empty string if the link cannot be built
 * @param {string} jobID - the ID of the job
 * @returns {string} - the Business Manager link for the job
 */
function getJobBMLink(jobID) {
    const URLUtils = require('dw/web/URLUtils');
    const CSRFProtection = require('dw/web/CSRFProtection');

    try {
        let csrfToken = CSRFProtection.generateToken();
        let jobURL = URLUtils.https('ViewApplication-BM', 'csrf_token', csrfToken).toString() +
            '#/?job#editor!id!' + jobID +
            '!config!' + jobID + '!domain!Sites!tab!schedule-and-history';

        return jobURL;
    } catch (e) { // eslint-disable-line no-unused-vars
        // Building the deep link relies on CSRF token generation and URL resolution, both of
        // which depend on the request context. If either fails, return an empty string so the
        // caller can render the job ID as plain text instead of aborting the page.
        return '';
    }
}

/**
 * Parses the submitted Algolia_InStockThreshold value.
 * An empty value maps to the attribute definition's default (1). The indexing steps and the inventory
 * hook read the preference as `getPreference('InStockThreshold') || 1`, so 0 and NaN must never be stored:
 * they would be displayed on the dashboard but silently applied as 1.
 * @param {string|null} rawValue - the submitted value (null if the parameter is missing)
 * @returns {number|null} the threshold to store, or null if the value is invalid
 */
function parseInStockThreshold(rawValue) {
    var trimmedValue = (rawValue || '').trim();
    if (!trimmedValue) {
        return 1;
    }

    var threshold = Number(trimmedValue);
    if (!isFinite(threshold) || threshold < 1 || threshold % 1 !== 0) {
        return null;
    }

    return threshold;
}

module.exports = {
    getLatestCOReportsByJob: getLatestCOReportsByJob,
    getJobBMLink: getJobBMLink,
    parseInStockThreshold: parseInStockThreshold,
};
