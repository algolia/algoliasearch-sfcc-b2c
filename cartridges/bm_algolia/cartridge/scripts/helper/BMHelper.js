'use strict';

/**
 * @description Get the latest log entry for each job ID
 * @returns {Array} Array of AlgoliaJobLog objects
 */
function getLatestCOLogs() {
    const CustomObjectMgr = require('dw/object/CustomObjectMgr');
    const AlgoliaJobLog = require('*/cartridge/scripts/algolia/helper/AlgoliaJobLog');

    const allJobLogs = CustomObjectMgr.getAllCustomObjects('AlgoliaJobLog').asList().toArray();

    // create a list of unique job IDs
    const uniqueJobIDs = [];
    for (var i = 0; i < allJobLogs.length; i++) {
        var jobID = allJobLogs[i].custom.jobID;
        if (uniqueJobIDs.indexOf(jobID) === -1) {
            uniqueJobIDs.push(jobID);
        }
    }
    uniqueJobIDs.sort();

    // for each unique job ID, get the last log entry
    const lastJobs = [];
    for (var i = 0; i < uniqueJobIDs.length; i++) {
        var jobID = uniqueJobIDs[i];
        var lastJobLog = CustomObjectMgr.queryCustomObjects('AlgoliaJobLog', 'custom.jobID = {0} ', 'creationDate desc', jobID).first();
        lastJobs.push(new AlgoliaJobLog().formatCustomObject(lastJobLog));
    }

    return lastJobs;
}

module.exports = {
    getLatestCOLogs: getLatestCOLogs,
};
