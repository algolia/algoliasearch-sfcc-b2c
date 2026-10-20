'use strict';

var File = require('dw/io/File'); // eslint-disable-line no-redeclare

// delta export job
const ALGOLIA_DELTA_EXPORT_BASE_FOLDER = File.IMPEX + '/src/platform/outbox/';

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

// The Business Manager dashboard renders a job report's error message in a single table
// cell, so the job steps truncate it to this length before persisting it.
const MAX_JOB_REPORT_ERROR_MESSAGE_LENGTH = 1000;

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

// Recommended dw.catalog.ProductActiveData fields exposed in the BM module's
// "Active data for custom ranking" checkbox-list preference. Single source of truth
// for the BM ISML option list, the unretrievableAttributes validator, and any
// future surface that needs the canonical recommendation set. The cartridge ships
// with built-in handlers for all 48 ProductActiveData properties; the ones not
// listed here can still be added through the Additional Product Attributes preference.
const ACTIVE_DATA_OPTIONS = [
    'ordersWeek',
    'revenueWeek',
    'conversionWeek',
    'ordersMonth',
    'revenueMonth',
    'conversionMonth'
];

module.exports = {
    ALGOLIA_DELTA_EXPORT_BASE_FOLDER: ALGOLIA_DELTA_EXPORT_BASE_FOLDER,

    INDEXING_APIS: INDEXING_APIS,
    REQUIRED_ACL_BY_INDEXING_API: REQUIRED_ACL_BY_INDEXING_API,
    MAX_JOB_REPORT_ERROR_MESSAGE_LENGTH: MAX_JOB_REPORT_ERROR_MESSAGE_LENGTH,
    RECORD_MODEL_TYPES: RECORD_MODEL_TYPES,
    ANALYTICS_REGIONS: ANALYTICS_REGIONS,

    TMP_INDEX_SUFFIX: TMP_INDEX_SUFFIX,

    ACTIVE_DATA_OPTIONS: ACTIVE_DATA_OPTIONS,
};
