'use strict';

/**
 * Call REST service and handle common errors
 */

const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();
const stringUtils = require('dw/util/StringUtils');
const Resource = require('dw/web/Resource');

var UNEXPECTED_ERROR_CODE = '-1';

/**
 * Custom helper to check if a string starts with a given prefix.
 * @param {string} str
 * @param {string} prefix
 * @returns {boolean}
 */
function stringStartsWith(str, prefix) {
    return str.substring(0, prefix.length) === prefix;
}

/**
 * Custom helper to check if a string ends with a given suffix.
 * @param {string} str
 * @param {string} suffix
 * @returns {boolean}
 */
function stringEndsWith(str, suffix) {
    return str.substring(str.length - suffix.length) === suffix;
}

/**
 * Determines whether the given indexPrefix matches a restricted pattern.
 * The pattern may include a wildcard character '*' which is interpreted as:
 *   - If '*' appears anywhere, then only the portion before the first '*' is used for matching.
 *   - If the pattern starts with '*', then the suffix (after the '*') is used.
 *   - Otherwise, an exact match is required.
 *
 * @param {string} indexPrefix
 * @param {string} pattern
 * @returns {boolean} True if matched.
 */
function matchIndexPrefix(indexPrefix, pattern) {
    // If the restricted pattern is exactly "*", it covers any prefix.
    if (pattern === '*') {
        return true;
    }

    // If the pattern contains a wildcard '*'
    if (pattern.indexOf('*') > -1) {
        // If the pattern starts with '*', use the substring after '*' as suffix for matching.
        if (pattern.charAt(0) === '*') {
            var suffixPart = pattern.substring(1);
            return stringEndsWith(indexPrefix, suffixPart);
        }
        // Otherwise, take the substring before the first '*' as the required prefix.
        var starPos = pattern.indexOf('*');
        var patternPrefix = pattern.substring(0, starPos);
        return stringStartsWith(indexPrefix, patternPrefix);
    }

    // No wildcard: perform an exact match.
    return indexPrefix === pattern;
}

/**
 * Formats standard error message string.
 * @param {string} title - Error title or function name.
 * @param {string} url - Service endpoint URL.
 * @param {number} error - HTTP response code.
 * @param {string} errorMessage - Error message.
 * @returns {string} Formatted error message.
 */
function standardErrorMessage(title, url, error, errorMessage) {
    return stringUtils.format('Error: {0},\nUrl: {1},\nErrorCode: {2},\nMessage: {3}',
        title || 'Algolia Service',
        url,
        error,
        errorMessage);
}

/**
 * Parse error message and write it to log.
 * @param {string} title - Error title or function name.
 * @param {string} url - Service endpoint URL.
 * @param {dw.svc.Result} result - Result object.
 * @returns {null}
 */
function logServiceError(title, url, result) {
    var logMessage = '';

    switch (result.error) {
        case 400:
            // Response is not a JSON. Write it as plain string.
            logMessage = standardErrorMessage(title, url, result.error, result.errorMessage);
            break;
        case 500:
        case 403:
        default:
            logMessage = standardErrorMessage(title, url, result.error, result.errorMessage);
    }

    logger.error(logMessage);

    return null;
}

/**
 * Call service, parse errors, and return data or null.
 * @param {string} title - Action or method description.
 * @param {dw.svc.Service} service - Service instance to call.
 * @param {Object} params - Parameters to pass to service.call.
 * @returns {?{
 *              response: string,
 *              headers: dw.util.Map,
 *              statusCode: number
 *          }} Response object or null on error.
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
 * Check if response type is JSON.
 * @param {dw.svc.HTTPService} service - Service instance.
 * @returns {boolean} True if Content-Type is application/json.
 */
function isResponseJSON(service) {
    var contentTypeHeader = service.getClient().getResponseHeader('Content-Type');
    return contentTypeHeader && contentTypeHeader.split(';')[0].toLowerCase() === 'application/json';
}

/**
 * Call JSON service and return a dw.system.Status.
 * @param {string} title - Action description.
 * @param {dw.svc.HTTPService} service - Service instance.
 * @param {Object} params - Parameters to pass.
 * @returns {dw.system.Status} Status with response details.
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
            // Not JSON, handle gracefully.
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
 * Validate an Algolia API Key's ACLs and index restrictions.
 * It checks that the key has all required ACLs and, if the key is restricted to specific indices,
 * that the provided indexPrefix (or the generated default, if empty) is covered by at least one allowed pattern.
 * This implementation follows logic similar to that used in the Crawler project.
 *
 * @param {dw.svc.Service} service
 * @param {string} applicationID
 * @param {string} apiKey
 * @param {string} indexPrefix
 * @param {boolean} isAdminKey
 * @returns {Object} { error: Boolean, errorMessage: String, warning: String }
 */
function validateAPIKey(service, applicationID, apiKey, indexPrefix, isAdminKey) {
    // If indexPrefix is empty, use the default generated value.
    if (!indexPrefix || indexPrefix.trim() === "") {
        var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
        indexPrefix = algoliaData.getIndexPrefix();
    }

    // Build the required ACL array.
    var requiredACLs = isAdminKey
        ? ['addObject', 'deleteObject', 'deleteIndex', 'settings']
        : ['search'];

    // Retrieve key info from Algolia using the /keys endpoint.
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
    var actualACLs = keyData.acl || [];

    // Identify missing vs. excessive ACLs.
    var missingACLs = requiredACLs.filter(function (reqAcl) {
        return actualACLs.indexOf(reqAcl) === -1;
    });
    var excessiveACLs = actualACLs.filter(function (acl) {
        return requiredACLs.indexOf(acl) === -1;
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

    // Check index restrictions, if any.
    var restrictedIndexes = keyData.indexes;
    if (restrictedIndexes && restrictedIndexes.length > 0) {
        var match = false;
        for (var i = 0; i < restrictedIndexes.length; i++) {
            var pattern = restrictedIndexes[i];
            if (matchIndexPrefix(indexPrefix, pattern)) {
                match = true;
                break;
            }
        }
        if (!match) {
            var prefixError = Resource.msgf('algolia.error.index.restrictedprefix', 'algolia', null, indexPrefix);
            return {
                error: true,
                errorMessage: prefixError,
                warning: excessiveACLs.length > 0
                    ? Resource.msgf('algolia.warning.excessive.permissions', 'algolia', null, excessiveACLs.join(', '))
                    : ''
            };
        }
    }

    // All checks passed.
    return {
        error: false,
        errorMessage: '',
        warning: excessiveACLs.length > 0
            ? Resource.msgf('algolia.warning.excessive.permissions', 'algolia', null, excessiveACLs.join(', '))
            : ''
    };
}

module.exports = {
    callService: callService,
    callJsonService: callJsonService,
    UNEXPECTED_ERROR_CODE: UNEXPECTED_ERROR_CODE,
    validateAPIKey: validateAPIKey
};
