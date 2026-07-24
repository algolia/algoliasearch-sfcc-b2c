'use strict';

/**
 * Tracks which delta export archives have already been consumed, per consuming job
 * and per site.
 *
 * The delta consumer leaves the archives in the outbox instead of moving them to a
 * "_completed" folder, so a single delta export definition can be shared by multiple
 * consumers: each job skips only the archives its own custom objects list. Consumption
 * is recorded per job within the site's custom object scope, so both other sites' jobs
 * and same-site jobs that split the work (e.g. by locale) consume the same archive
 * independently.
 * The archives themselves are deleted by the platform's /Impex file retention after
 * 30 days, and the custom objects expire via retention-days on the type, so no
 * cleanup step is needed.
 */

const CUSTOM_OBJECT_TYPE = 'AlgoliaConsumedDeltaArchive';

/**
 * Builds the custom object key for one archive. The storage scope of the custom object
 * type is "site", so the key only needs to be unique within a site. The consuming job's
 * ID is prepended so that the rest of the key mirrors the archive's path in the outbox
 * (consumer/deltaExportJobName/archiveName).
 * @param {string} jobID The ID of the consuming job
 * @param {string} consumer The consumer name of the delta export
 * @param {string} deltaExportJobName The name of the delta export
 * @param {string} archiveName The archive file name (e.g. "000042.zip")
 * @returns {string} The custom object key
 */
function getArchiveKey(jobID, consumer, deltaExportJobName, archiveName) {
    return jobID + '__' + consumer + '__' + deltaExportJobName + '__' + archiveName;
}

/**
 * Returns whether the given archive has already been consumed by the given job on the current site.
 * @param {string} jobID The ID of the consuming job
 * @param {string} consumer The consumer name of the delta export
 * @param {string} deltaExportJobName The name of the delta export
 * @param {string} archiveName The archive file name (e.g. "000042.zip")
 * @returns {boolean} true if the archive is recorded as consumed for the given job on the current site
 */
function isConsumed(jobID, consumer, deltaExportJobName, archiveName) {
    const CustomObjectMgr = require('dw/object/CustomObjectMgr');
    const consumedArchiveCO = CustomObjectMgr.getCustomObject(CUSTOM_OBJECT_TYPE, getArchiveKey(jobID, consumer, deltaExportJobName, archiveName));
    return !empty(consumedArchiveCO);
}

/**
 * Records the given archives as consumed by the given job on the current site.
 * An archive that is already recorded (e.g. by a rerun racing an earlier record) is skipped.
 * @param {string} jobID The ID of the consuming job
 * @param {string} consumer The consumer name of the delta export
 * @param {string} deltaExportJobName The name of the delta export
 * @param {string[]} archiveNames The archive file names to record
 * @returns {boolean} true if all archives were recorded successfully
 */
function markConsumed(jobID, consumer, deltaExportJobName, archiveNames) {
    const CustomObjectMgr = require('dw/object/CustomObjectMgr');
    const Transaction = require('dw/system/Transaction');
    const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();

    let success = true;

    archiveNames.forEach(function(archiveName) {
        const archiveKey = getArchiveKey(jobID, consumer, deltaExportJobName, archiveName);
        try {
            Transaction.wrap(function() {
                if (!empty(CustomObjectMgr.getCustomObject(CUSTOM_OBJECT_TYPE, archiveKey))) {
                    return; // already recorded
                }
                const consumedArchiveCO = CustomObjectMgr.createCustomObject(CUSTOM_OBJECT_TYPE, archiveKey);
                consumedArchiveCO.custom.consumer = consumer;
                consumedArchiveCO.custom.deltaExportJobName = deltaExportJobName;
                consumedArchiveCO.custom.archiveName = archiveName;
                consumedArchiveCO.custom.jobID = jobID;
            });
        } catch (e) {
            logger.error('Failed to record consumed delta archive "' + archiveKey + '": ' + e.message);
            success = false;
        }
    });

    return success;
}

module.exports = {
    isConsumed: isConsumed,
    markConsumed: markConsumed,
};
