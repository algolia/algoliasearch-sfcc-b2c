'use strict';

/**
 * Tracks which delta export archives have already been consumed by the current site.
 *
 * The delta consumer leaves the archives in the outbox instead of moving them to a
 * "_completed" folder, so a single delta export definition can be shared by multiple
 * sites: each site's job skips only the archives its own custom objects list.
 * The archives themselves are deleted by the platform's /Impex file retention after
 * 30 days, and the custom objects expire via retention-days on the type, so no
 * cleanup step is needed.
 */

const CUSTOM_OBJECT_TYPE = 'AlgoliaConsumedDeltaArchive';

/**
 * Builds the custom object key for one archive. The storage scope of the custom object
 * type is "site", so the key only needs to be unique within a site.
 * @param {string} consumer The consumer name of the delta export
 * @param {string} deltaExportJobName The name of the delta export
 * @param {string} archiveName The archive file name (e.g. "000042.zip")
 * @returns {string} The custom object key
 */
function getArchiveKey(consumer, deltaExportJobName, archiveName) {
    return consumer + '__' + deltaExportJobName + '__' + archiveName;
}

/**
 * Returns whether the given archive has already been consumed by the current site.
 * @param {string} consumer The consumer name of the delta export
 * @param {string} deltaExportJobName The name of the delta export
 * @param {string} archiveName The archive file name (e.g. "000042.zip")
 * @returns {boolean} true if the archive is recorded as consumed for the current site
 */
function isConsumed(consumer, deltaExportJobName, archiveName) {
    const CustomObjectMgr = require('dw/object/CustomObjectMgr');
    const consumedArchiveCO = CustomObjectMgr.getCustomObject(CUSTOM_OBJECT_TYPE, getArchiveKey(consumer, deltaExportJobName, archiveName));
    return !empty(consumedArchiveCO);
}

/**
 * Records the given archives as consumed by the current site.
 * An archive that is already recorded (e.g. by a rerun racing an earlier record) is skipped.
 * @param {string} consumer The consumer name of the delta export
 * @param {string} deltaExportJobName The name of the delta export
 * @param {string[]} archiveNames The archive file names to record
 * @param {string} jobID The ID of the job run that consumed the archives
 * @returns {boolean} true if all archives were recorded successfully
 */
function markConsumed(consumer, deltaExportJobName, archiveNames, jobID) {
    const CustomObjectMgr = require('dw/object/CustomObjectMgr');
    const Transaction = require('dw/system/Transaction');
    const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();

    let success = true;

    archiveNames.forEach(function(archiveName) {
        const archiveKey = getArchiveKey(consumer, deltaExportJobName, archiveName);
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
