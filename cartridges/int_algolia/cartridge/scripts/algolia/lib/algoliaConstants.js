'use strict';

var currentSite = require('dw/system/Site').getCurrent();
var siteID = currentSite.getID();

var ALGOLIA_FILES_FOLDER = dw.io.File.IMPEX + '/src/Algolia/';

var SNAPSHOT_PRODUCTS_FILE_NAME = ALGOLIA_FILES_FOLDER + siteID + '_product.xml';
var TMP_SNAPSHOT_PRODUCTS_FILE_NAME = ALGOLIA_FILES_FOLDER + siteID + '_product_tmp.xml';
var UPDATE_PRODUCTS_FILE_NAME = ALGOLIA_FILES_FOLDER + siteID + '_product_update.xml';

var SNAPSHOT_CATEGORIES_FILE_NAME = ALGOLIA_FILES_FOLDER + siteID + '_categories.xml';
var TMP_SNAPSHOT_CATEGORIES_FILE_NAME = ALGOLIA_FILES_FOLDER + siteID + '_categories_tmp.xml';
var UPDATE_CATEGORIES_FILE_NAME = ALGOLIA_FILES_FOLDER + siteID + '_categories_update.xml';

var ALGOLIA_LOG_FILE_NAME = '_lastUpdateLog.xml';
var ALGOLIA_LOG_FILE = ALGOLIA_FILES_FOLDER + siteID + ALGOLIA_LOG_FILE_NAME;

module.exports = {
    ALGOLIA_FILES_FOLDER: ALGOLIA_FILES_FOLDER,

    SNAPSHOT_PRODUCTS_FILE_NAME: SNAPSHOT_PRODUCTS_FILE_NAME,
    TMP_SNAPSHOT_PRODUCTS_FILE_NAME: TMP_SNAPSHOT_PRODUCTS_FILE_NAME,
    UPDATE_PRODUCTS_FILE_NAME: UPDATE_PRODUCTS_FILE_NAME,

    SNAPSHOT_CATEGORIES_FILE_NAME: SNAPSHOT_CATEGORIES_FILE_NAME,
    TMP_SNAPSHOT_CATEGORIES_FILE_NAME: TMP_SNAPSHOT_CATEGORIES_FILE_NAME,
    UPDATE_CATEGORIES_FILE_NAME: UPDATE_CATEGORIES_FILE_NAME,

    ALGOLIA_LOG_FILE_NAME: ALGOLIA_LOG_FILE_NAME,
    ALGOLIA_LOG_FILE: ALGOLIA_LOG_FILE
};
