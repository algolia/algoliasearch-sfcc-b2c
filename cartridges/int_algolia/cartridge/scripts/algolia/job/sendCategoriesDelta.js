'use strict';

module.exports.execute = function (parameters) {
    var sendDelta = require('*/cartridge/scripts/algolia/helper/sendDelta');
    var deltaIterator = require('*/cartridge/scripts/algolia/helper/deltaIterator');
    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

    var deltaList = deltaIterator.create(algoliaConstants.UPDATE_CATEGORIES_FILE_NAME, 'category');
    return sendDelta(deltaList, 'LastCategorySyncLog', parameters);
};
