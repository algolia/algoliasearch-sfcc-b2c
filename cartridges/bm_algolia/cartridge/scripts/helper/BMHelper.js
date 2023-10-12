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
    } catch (e) {
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
        let reports = CustomObjectMgr.queryCustomObjects('AlgoliaJobReport', 'custom.jobID = {0} ', 'creationDate desc', jobID).asList().toArray();
        let formattedReports = reports.map(function(report) {
            return new AlgoliaJobReport().formatCustomObject(report);
        });
        reportsByJob.push(formattedReports.slice(0, nrReportsPerJob)); // last three reports only
    }

    return reportsByJob;
}

/**
 * Returns the Business Manager link for a job
 * @param {string} jobID - the ID of the job
 * @returns {string} - the Business Manager link for the job
 */
function getJobBMLink(jobID) {
    const URLUtils = require('dw/web/URLUtils');
    const CSRFProtection = require('dw/web/CSRFProtection');

    let csrfToken = CSRFProtection.generateToken();
    let jobURL = URLUtils.https('ViewApplication-BM', 'csrf_token', csrfToken).toString() +
        '#/?job#editor!id!' + jobID +
        '!config!' + jobID + '!domain!Sites!tab!schedule-and-history';

    return jobURL;
}

module.exports = {
    getLatestCOReportsByJob: getLatestCOReportsByJob,
    getJobBMLink: getJobBMLink,
};
