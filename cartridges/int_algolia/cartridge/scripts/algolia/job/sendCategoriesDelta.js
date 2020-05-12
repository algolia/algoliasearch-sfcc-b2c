'use strict';

module.exports.execute = function (parameters) {
    var File = require('dw/io/File');
    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    var sendDelta = require('*/cartridge/scripts/algolia/helper/sendDelta');
    var deltaIterator = require('*/cartridge/scripts/algolia/helper/deltaIterator');
    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');
    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

    var deltaList = deltaIterator.create(algoliaConstants.UPDATE_CATEGORIES_FILE_NAME, 'category');
    var status = sendDelta(deltaList, 'LastCategorySyncLog', parameters);
    var newSnapshotFile = new File(algoliaConstants.TMP_SNAPSHOT_CATEGORIES_FILE_NAME);
    if (status.error) {
        try {
            if (newSnapshotFile.exists()) {
                newSnapshotFile.remove();
            }
        } catch (error) {
            jobHelper.logFileError(newSnapshotFile.fullPath, 'Error remove file', error);
        }
    } else {
        algoliaData.setPreference('LastCategorySyncDate', new Date());
        var snapshotFile = new File(algoliaConstants.SNAPSHOT_CATEGORIES_FILE_NAME);
        try {
            if (newSnapshotFile.exists()) {
                if (snapshotFile.exists()) {
                    snapshotFile.remove();
                }
                newSnapshotFile.renameTo(snapshotFile);
            }
        } catch (error) {
            jobHelper.logFileError(snapshotFile.fullPath, 'Error rewrite file', error);
        }
    }
    return status;
};
