'use strict';

/**
 * Call REST service and handle common errors
 */

const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();

const stringUtils = require('dw/util/StringUtils');
const Resource = require('dw/web/Resource');
const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

var UNEXPECTED_ERROR_CODE = '-1';

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

    var result;
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
                var data = JSON.parse(result.object.response);
                statusItem.addDetail('object', data);
            } catch (error) {
                statusItem.setStatus(Status.ERROR);
                logger.error('JSON.parse error. Error: {0}. Method: {1}. String: {2}', error, title, result.object.response);
            }
        } else {
            // not JSON, handle gracefully
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
 * @param {string} indexName - full index name (e.g. "testPrefix__products__en_US")
 * @param {string} pattern   - pattern from the key's indexes field ("*", "myPrefix_*", etc.)
 * @returns {boolean}        - true if the indexName matches the wildcard or exact pattern
 */
function matchesIndexName(indexName, pattern) {
    // Escape regex special chars except '*'
    var escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Replace '*' with '.*'
    escaped = escaped.replace(/\*/g, '.*');
    var re = new RegExp('^' + escaped + '$');
    return re.test(indexName);
}

/**
 * Validate an Algolia API Key's ACLs and index restrictions.
 * 
 * @param {dw.svc.Service} service - Service instance to call
 * @param {string} applicationID   - Algolia Application ID
 * @param {string} apiKey          - Key we want to validate (admin or search)
 * @param {string} indexPrefix     - The custom prefix used by the cartridge
 * @param {Array} locales          - Locales from BM form
 * @param {boolean} isAdminKey     - If true, we require admin ACLs; if false, we require 'search'
 * @param {boolean} isRecommendationEnabled - If true, we require 'recommend' ACL
 * @param {boolean} isContentSearchEnabled - If true, we require 'contentSearch' ACL
 * @returns {Object} { error:Boolean, errorMessage:String, warning:String }
 */
function validateAPIKey(service, applicationID, apiKey, indexPrefix, locales, isAdminKey, isRecommendationEnabled, isContentSearchEnabled) {
    // 0) Build the required ACL array
    var requiredACLs;
    if (isAdminKey) {
        requiredACLs = ['addObject', 'deleteObject', 'deleteIndex', 'settings'];
    } else {
        // minimal read usage is  "search", (initial values for search ke : "search", "listIndexes", "settings)
        requiredACLs = ['search'];

        if (isRecommendationEnabled) {
            requiredACLs.push('recommendation');
        }
    }

    // 1) Retrieve key info from Algolia
    var keyResponse = service.call({
        method: 'GET',
        url: 'https://' + applicationID + '.algolia.net/1/keys/' + apiKey
    });

    if (!keyResponse.ok) {
        return {
            error: true,
            errorMessage: Resource.msg('algolia.error.key.validation', 'algolia', null)
        };
    }

    var keyData = keyResponse.object.body;

    // 2) Check required ACLs
    var missingACLs = requiredACLs.slice();
    var excessiveACLs = [];
    var actualACLs = keyData.acl || [];

    actualACLs.forEach(function (acl) {
        var idx = missingACLs.indexOf(acl);
        if (idx === -1) {
            // not required => it's extra
            excessiveACLs.push(acl);
        } else {
            // remove from missing
            missingACLs.splice(idx, 1);
        }
    });

    if (missingACLs.length > 0) {
        var errMsg = Resource.msgf('algolia.error.missing.permissions', 'algolia', null, missingACLs.join(', '));
        return {
            error: true,
            errorMessage: errMsg,
            warning: excessiveACLs.length > 0
                ? Resource.msgf('algolia.warning.excessive.permissions', 'algolia', null, excessiveACLs.join(', '))
                : ''
        };
    }

    // 3) If indexes field is not present or empty, the key has no index-specific restriction => pass
    var restrictedIndexes = keyData.indexes || [];
    if (restrictedIndexes.length === 0) {
        return {
            error: false,
            errorMessage: '',
            warning: excessiveACLs.length > 0
                ? Resource.msgf('algolia.warning.excessive.permissions', 'algolia', null, excessiveACLs.join(', '))
                : ''
        };
    }

    // 4) If indexes field exists, confirm that all indices we might create (for each type, each locale) match
    var indexTypes = ['products', 'categories'];

    if (isContentSearchEnabled) {
        indexTypes.push('contents');
    }

    var hasError = false;
    var errorMessage = '';

    indexTypes.forEach(function (indexType) {
        locales.forEach(function (locale) {
            var indexName = algoliaData.calculateIndexName(indexType, locale, indexPrefix);
            var matched = restrictedIndexes.some(function (pattern) {
                return matchesIndexName(indexName, pattern);
            });

            if (!matched) {
                hasError = true;
                errorMessage = Resource.msgf('algolia.error.index.restricted', 'algolia', null, indexName);
            }
        });
    });

    if (hasError) {
        return {
            error: true,
            errorMessage: errorMessage,
            warning: excessiveACLs.length > 0
                ? Resource.msgf('algolia.warning.excessive.permissions', 'algolia', null, excessiveACLs.join(', '))
                : ''
        };
    } else {
        return {
            error: false,
            errorMessage: '',
            warning: excessiveACLs.length > 0
                ? Resource.msgf('algolia.warning.excessive.permissions', 'algolia', null, excessiveACLs.join(', '))
                : ''
        };
    }
}

module.exports = {
    callService: callService,
    callJsonService: callJsonService,
    UNEXPECTED_ERROR_CODE: UNEXPECTED_ERROR_CODE,
    validateAPIKey: validateAPIKey
};
