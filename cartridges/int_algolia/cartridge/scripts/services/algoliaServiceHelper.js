'use strict';

/**
 * Call REST service and handle common errors
 */

const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();
const Resource = require('dw/web/Resource');
const stringUtils = require('dw/util/StringUtils');
const { INDEXING_APIS, REQUIRED_ACL_BY_INDEXING_API } = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

/**
 * Formats standard error message string
 * @param {string} title        - Error title, place or function name
 * @param {string} url          - Url of the service endpoint
 * @param {number} error        - HTTP response code for an HTTPService
 * @param {string} errorMessage - Error Message
 * @returns {string}            - formatted message
 */
function standardErrorMessage(title, url, error, errorMessage) {
    return stringUtils.format('Error: {0},\nUrl: {1},\nErrorCode: {2},\nMessage: {3}',
        title || 'Algolia Service',
        url,
        error,
        errorMessage);
}

/**
 * Parse error message and write it to log
 * @param {string}        title  - Error title, place or function name
 * @param {string}        url    - Url of the service endpoint
 * @param {dw.svc.Result} result - result
 * @returns {null} - Null
 */
function logServiceError(title, url, result) {
    var logMessage = '';

    switch (result.error) {
        case 400:
            // Response is not a JSON. Write is as plain string.
            logMessage = standardErrorMessage(title, url, result.error, result.errorMessage);
            break;
        case 500:
        case 403:
        default:
            logMessage = standardErrorMessage(title, url, result.error, result.errorMessage);
    } // switch ends

    logger.error(logMessage);

    return null;
}

/**
 * Call service, parse errors and return data or null
 * @param {string}         title   - Name of the action or method to describe the action performed
 * @param {dw.svc.Service} service - Service instance to call
 * @param {Object}         params  - Params to be passed to service.call function
 * @returns {?{
 *              response: string,
 *              headers: dw.util.Map,
 *              statusCode: number
 *          }}                     - Response object or `null` in case of errors
 */
function callService(title, service, params) {
    var result;
    var data = null;

    try {
        result = service.setThrowOnError().call(JSON.stringify(params));
    } catch (error) {
        logger.error('HTTP Service request failed.\nMessage: {0}, Url: {1}', error.name, service.getURL());
        return null;
    }

    if (result.ok) {
        data = result.object;
    } else {
        logServiceError(title, service.getURL(), result);
    }

    return data;
}

/**
 * Check if response type is JSON
 * @param {dw.svc.HTTPService} service - Service to obtain client from
 * @returns {boolean}                  - boolean if `Content-Type` is `application/json`
 */
function isResponseJSON(service) {
    var contentTypeHeader = service.getClient().getResponseHeader('Content-Type');
    return contentTypeHeader && contentTypeHeader.split(';')[0].toLowerCase() === 'application/json';
}

/**
 *
 * @param {string} title - Name of the action or method to describe the action performed
 * @param {dw.svc.HTTPService} service - Service instance to call
 * @param {Object} params - Params to be passed to service.call function
 * @returns {dw.system.Status} - for success calls result data available via getDetail('object');
 */
function callJsonService(title, service, params) {
    var Status = require('dw/system/Status');

    var callStatus = new Status(Status.OK);
    var statusItem = callStatus.items.get(0);

    var result = null;
    var data = null;

    try {
        result = service.setThrowOnError().call(JSON.stringify(params));
    } catch (error) {
        statusItem.setStatus(Status.ERROR);
        logger.error('HTTP Service request failed.\nMessage: {0}, Url: {1}', error.name, service.getURL());
        return callStatus;
    }

    if (result.ok) {
        if (isResponseJSON(service)) {
            try {
                data = JSON.parse(result.object.response);
                statusItem.addDetail('object', data);
            } catch (parseError) { // eslint-disable-line no-unused-vars
                // response is marked as json, but it is not
                statusItem.setStatus(Status.ERROR);
                logger.error('JSON.parse error. Method: {0}. String: {1}', title, result.object.response);
            }
        } else {
            // statusItem.setStatus(Status.ERROR);
            statusItem.addDetail('object', {});
            if (result.object && result.object.response) {
                logger.warn('Response is not JSON. Method: {0}. Result: {1}', title, result.object.response);
            }
        }
    } else {
        statusItem.setStatus(Status.ERROR);
        statusItem.addDetail('errorMessage', result.errorMessage);
        statusItem.addDetail('errorCode', result.error);
        logServiceError(title, service.getURL(), result);
    }

    return callStatus;
}

/**
 * Validates an Algolia API key’s permissions and index restrictions.
 * It retrieves key details from Algolia, then verifies that the key’s ACL
 * contains every entry required by the selected indexing API and that the
 * provided indexPrefix is covered by one of the allowed index patterns.
 *
 * @param {dw.svc.Service} service - The service instance used for the API call.
 * @param {string} applicationID - The Algolia Application ID.
 * @param {string} apiKey - The API key to validate.
 * @param {string} indexPrefix - The index prefix to validate against.
 * @param {string} [indexingAPI] - Selected indexing API ('search-api' or 'ingestion-api').
 *                                 Defaults to 'search-api' when omitted to match the rest of the cartridge.
 * @returns {Object} An object with properties { error: Boolean, errorMessage: String, warning: String }.
 */
function validateAPIKey(service, applicationID, apiKey, indexPrefix, indexingAPI) {

    var selectedIndexingAPI = indexingAPI || INDEXING_APIS.SEARCH_API;
    var requiredACL = REQUIRED_ACL_BY_INDEXING_API[selectedIndexingAPI]
        || REQUIRED_ACL_BY_INDEXING_API[INDEXING_APIS.SEARCH_API];

    var response = service.call({
        method: 'GET',
        url: 'https://' + applicationID + '.algolia.net/1/keys/' + apiKey
    });

    if (!response.ok) {
        return {
            error: true,
            errorMessage: Resource.msg('algolia.error.key.validation', 'algolia', null)
        };
    }

    var keyData = response.object.body;
    var actualACLPerms = keyData.acl || [];

    // Identify required ACL entries that are missing from the key.
    var missingACLPerms = requiredACL.filter(function (entry) {
        return actualACLPerms.indexOf(entry) === -1;
    });
    if (missingACLPerms.length > 0) {
        return {
            error: true,
            errorMessage: Resource.msgf(
                'algolia.error.missing.permissions',
                'algolia',
                null,
                selectedIndexingAPI,
                missingACLPerms.join(', '),
                requiredACL.join(', ')
            )
        };
    }

    // Check index restrictions if any are specified.
    var restrictedIndexes = keyData.indexes;
    if (restrictedIndexes && restrictedIndexes.length > 0 && indexPrefix) {
        var match = restrictedIndexes.some(function (pattern) {
            // Check for universal wildcard
            if (pattern === '*') {
                return true;
            }
            // Polyfill for endsWith('*'): check if the last character is '*'
            if (pattern.charAt(pattern.length - 1) === '*') {
                var prefix = pattern.substring(0, pattern.length - 1);
                // Polyfill for startsWith: check if indexPrefix begins with prefix
                return indexPrefix.substring(0, prefix.length) === prefix;
            }
            return pattern === indexPrefix;
        });
        if (!match) {
            return {
                error: true,
                errorMessage: Resource.msgf('algolia.error.index.restrictedprefix', 'algolia', null, indexPrefix)
            };
        }
    }

    // Identify ACL entries on the key that exceed what the selected indexing API requires.
    var excessiveACL = actualACLPerms.filter(function (entry) {
        return requiredACL.indexOf(entry) === -1;
    });

    return {
        error: false,
        errorMessage: '',
        warning: excessiveACL.length > 0
            ? Resource.msgf(
                'algolia.warning.excessive.permissions',
                'algolia',
                null,
                selectedIndexingAPI,
                excessiveACL.join(', '),
                requiredACL.join(', ')
            )
            : ''
    };
}

/**
 * Compare a list of selected attribute IDs against the unretrievableAttributes setting of every product index
 * the cartridge writes to (one per locale, derived from indexPrefix and the supplied locale list), and produce
 * a copy-only warning listing the IDs that are missing from each index's unretrievableAttributes list.
 *
 * Soft-fail by design:
 * - Empty selection or empty locale list short-circuits to {error: false, warning: ''}.
 * - 404 (index does not exist yet, e.g. the customer hasn't run the indexing job once) is logged
 *   and the index is skipped, never blocking save.
 * - Network or auth errors are logged and the index is skipped, never blocking save.
 * - The function never returns error: true; it only ever attaches a warning string.
 *
 * Replica indices are not enumerated by the cartridge -- the warning copy directs the user to set
 * unretrievableAttributes on each replica or to use forwardToReplicas: true when applying settings.
 *
 * @param {dw.svc.HTTPService} service - configured indexing service (must already carry application ID and admin API key)
 * @param {string} applicationID - Algolia application ID (used to build the per-call URL)
 * @param {string} indexPrefix - effective index prefix used by the cartridge (already resolved against the site default)
 * @param {Array<string>} locales - list of locales to check (e.g. Algolia_LocalesForIndexing or Site.getAllowedLocales())
 * @param {Array<string>} selectedAttributes - attribute IDs selected in the BM module (typically a subset of CUSTOM_RANKING_ACTIVE_DATA_OPTIONS)
 * @returns {Object} { error: boolean (always false), warning: String, notFoundNotice: String, unreachableNotice: String, details: Array<{indexName, missing, status, error}> }
 */
function validateUnretrievableAttributes(service, applicationID, indexPrefix, locales, selectedAttributes) {
    var emptyResult = { error: false, warning: '', notFoundNotice: '', unreachableNotice: '', details: [] };

    if (!selectedAttributes || selectedAttributes.length === 0) {
        return emptyResult;
    }
    if (!locales || locales.length === 0) {
        return emptyResult;
    }
    if (!indexPrefix || !applicationID) {
        return emptyResult;
    }

    var details = [];
    var indicesWithGaps = [];
    var indicesNotFound = [];
    var indicesUnreachable = [];
    var indicesOk = [];

    for (let i = 0; i < locales.length; i++) {
        let locale = locales[i];
        if (!locale) {
            continue;
        }

        let indexName = indexPrefix + '__products__' + locale;
        let entry = { indexName: indexName, missing: [], status: 'ok', error: '' };

        let response;
        try {
            response = service.call({
                method: 'GET',
                url: 'https://' + applicationID + '.algolia.net/1/indexes/' + encodeURIComponent(indexName) + '/settings'
            });
        } catch (err) {
            entry.status = 'unreachable';
            entry.error = (err && err.message) ? err.message : String(err);
            logger.warn('validateUnretrievableAttributes: ' + indexName + ' -> unreachable (call threw): ' + entry.error);
            details.push(entry);
            indicesUnreachable.push(indexName);
            continue;
        }

        if (!response || !response.ok) {
            // 404: index does not exist yet (e.g. customer hasn't run the indexing job).
            // Other errors: auth, transient network. Either way, do not block save.
            let statusCode = response && response.error;
            if (statusCode === 404) {
                entry.status = 'not-found';
                entry.error = 'HTTP 404';
                logger.info('validateUnretrievableAttributes: ' + indexName + ' -> not-found (run AlgoliaProductIndex_v2 to create it).');
                indicesNotFound.push(indexName);
            } else {
                entry.status = 'unreachable';
                entry.error = 'HTTP ' + statusCode + ': ' + ((response && response.errorMessage) || 'unknown');
                logger.warn('validateUnretrievableAttributes: ' + indexName + ' -> unreachable: ' + entry.error);
                indicesUnreachable.push(indexName);
            }
            details.push(entry);
            continue;
        }

        let settings = (response.object && response.object.body) || {};
        let configured = settings.unretrievableAttributes || [];
        let missing = selectedAttributes.filter(function (attribute) {
            return configured.indexOf(attribute) === -1;
        });

        entry.missing = missing;
        details.push(entry);

        if (missing.length > 0) {
            entry.status = 'missing';
            indicesWithGaps.push(indexName + ' (' + missing.join(', ') + ')');
            logger.info('validateUnretrievableAttributes: ' + indexName + ' -> missing: ' + missing.join(', '));
        } else {
            indicesOk.push(indexName);
            logger.info('validateUnretrievableAttributes: ' + indexName + ' -> ok (all selected fields configured).');
        }
    }

    logger.info('validateUnretrievableAttributes: summary - ok=' + indicesOk.length +
        ', missing=' + indicesWithGaps.length +
        ', not-found=' + indicesNotFound.length +
        ', unreachable=' + indicesUnreachable.length +
        ' (selected: ' + selectedAttributes.join(',') + ')');

    // Render each index as a bullet on its own line.
    function bulletList(items) {
        return '\u2022 ' + items.join('\n\u2022 ');
    }
    var warning = '';
    if (indicesWithGaps.length > 0) {
        warning = Resource.msgf('algolia.warning.unretrievable.missing', 'algolia', null, bulletList(indicesWithGaps));
    }
    var notFoundNotice = '';
    if (indicesNotFound.length > 0) {
        notFoundNotice = Resource.msgf('algolia.notice.unretrievable.notfound', 'algolia', null, bulletList(indicesNotFound));
    }
    var unreachableNotice = '';
    if (indicesUnreachable.length > 0) {
        unreachableNotice = Resource.msgf('algolia.notice.unretrievable.unreachable', 'algolia', null, bulletList(indicesUnreachable));
    }

    return {
        error: false,
        warning: warning,
        notFoundNotice: notFoundNotice,
        unreachableNotice: unreachableNotice,
        details: details
    };
}

module.exports = {
    callService: callService,
    callJsonService: callJsonService,
    validateAPIKey: validateAPIKey,
    validateUnretrievableAttributes: validateUnretrievableAttributes
};
