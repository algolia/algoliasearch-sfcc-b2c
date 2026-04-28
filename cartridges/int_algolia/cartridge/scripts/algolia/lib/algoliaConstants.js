'use strict';

var currentSiteID = require('dw/system/Site').getCurrent().getID();
var File = require('dw/io/File'); // eslint-disable-line no-redeclare

const ALGOLIA_FILES_FOLDER = File.IMPEX + '/src/Algolia/';

const SNAPSHOT_PRODUCTS_FILE_NAME = ALGOLIA_FILES_FOLDER + currentSiteID + '_product.xml';
const TMP_SNAPSHOT_PRODUCTS_FILE_NAME = ALGOLIA_FILES_FOLDER + currentSiteID + '_product_tmp.xml';
const UPDATE_PRODUCTS_FILE_NAME = ALGOLIA_FILES_FOLDER + currentSiteID + '_product_update.xml';

const SNAPSHOT_CATEGORIES_FILE_NAME = ALGOLIA_FILES_FOLDER + currentSiteID + '_categories.xml';
const TMP_SNAPSHOT_CATEGORIES_FILE_NAME = ALGOLIA_FILES_FOLDER + currentSiteID + '_categories_tmp.xml';
const UPDATE_CATEGORIES_FILE_NAME = ALGOLIA_FILES_FOLDER + currentSiteID + '_categories_update.xml';

const ALGOLIA_LOG_FILE_NAME = '_lastUpdateLog.xml';
const ALGOLIA_LOG_FILE = ALGOLIA_FILES_FOLDER + currentSiteID + ALGOLIA_LOG_FILE_NAME;

// delta export job
const ALGOLIA_DELTA_EXPORT_BASE_FOLDER = File.IMPEX + '/src/platform/outbox/';
const ALGOLIA_DELTA_EXPORT_UPDATE_FILE_NAME = currentSiteID + '_product_update.xml';

const INDEXING_APIS = {
    SEARCH_API: 'search-api',
    INGESTION_API: 'ingestion-api',
}

// ACL requirements per indexing API mode. Used by the BM module to validate the configured API key against the
// actual endpoints the cartridge calls at runtime, so customers don't need to grant a broader ACL than necessary.
// ACL reference: https://www.algolia.com/doc/guides/security/api-keys/
const REQUIRED_ACL_BY_INDEXING_API = {};
REQUIRED_ACL_BY_INDEXING_API[INDEXING_APIS.SEARCH_API] = ['addObject', 'deleteObject', 'deleteIndex', 'settings'];
REQUIRED_ACL_BY_INDEXING_API[INDEXING_APIS.INGESTION_API] = ['addObject', 'deleteObject', 'deleteIndex', 'settings', 'editSettings'];

const RECORD_MODEL_TYPES = {
    MASTER_LEVEL: 'master-level',
    VARIANT_LEVEL: 'variant-level',
    ATTRIBUTE_SLICED: 'attribute-sliced',
}

const ANALYTICS_REGIONS = {
    EU: 'eu',
    US: 'us',
}

const TMP_INDEX_SUFFIX = '.tmp';

module.exports = {
    ALGOLIA_FILES_FOLDER: ALGOLIA_FILES_FOLDER,
    SNAPSHOT_PRODUCTS_FILE_NAME: SNAPSHOT_PRODUCTS_FILE_NAME,
    TMP_SNAPSHOT_PRODUCTS_FILE_NAME: TMP_SNAPSHOT_PRODUCTS_FILE_NAME,
    UPDATE_PRODUCTS_FILE_NAME: UPDATE_PRODUCTS_FILE_NAME,

    SNAPSHOT_CATEGORIES_FILE_NAME: SNAPSHOT_CATEGORIES_FILE_NAME,
    TMP_SNAPSHOT_CATEGORIES_FILE_NAME: TMP_SNAPSHOT_CATEGORIES_FILE_NAME,
    UPDATE_CATEGORIES_FILE_NAME: UPDATE_CATEGORIES_FILE_NAME,

    ALGOLIA_LOG_FILE_NAME: ALGOLIA_LOG_FILE_NAME,
    ALGOLIA_LOG_FILE: ALGOLIA_LOG_FILE,

    ALGOLIA_DELTA_EXPORT_BASE_FOLDER: ALGOLIA_DELTA_EXPORT_BASE_FOLDER,
    ALGOLIA_DELTA_EXPORT_UPDATE_FILE_NAME: ALGOLIA_DELTA_EXPORT_UPDATE_FILE_NAME,

    INDEXING_APIS: INDEXING_APIS,
    REQUIRED_ACL_BY_INDEXING_API: REQUIRED_ACL_BY_INDEXING_API,
    RECORD_MODEL_TYPES: RECORD_MODEL_TYPES,
    ANALYTICS_REGIONS: ANALYTICS_REGIONS,

    TMP_INDEX_SUFFIX: TMP_INDEX_SUFFIX,
};
