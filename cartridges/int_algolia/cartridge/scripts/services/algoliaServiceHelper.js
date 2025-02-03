'use strict';

/**
 * Call REST service and handle common errors
 */

const logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();
const Resource = require('dw/web/Resource');
const stringUtils = require('dw/util/StringUtils');

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
            } catch (error) {
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
 * It retrieves key details from Algolia, then verifies that the key contains
 * all required ACLs (depending on whether it is an admin key or not) and that the
 * provided indexPrefix is covered by one of the allowed index patterns.
 *
 * @param {dw.svc.Service} service - The service instance used for the API call.
 * @param {string} applicationID - The Algolia Application ID.
 * @param {string} apiKey - The API key to validate.
 * @param {string} indexPrefix - The index prefix to validate against.
 * @returns {Object} An object with properties { error: Boolean, errorMessage: String, warning: String }.
 */
function validateAPIKey(service, applicationID, apiKey, indexPrefix) {
    // Use default indexPrefix if none is provided.
    if (!indexPrefix || indexPrefix.trim() === "") {
        var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
        indexPrefix = algoliaData.getIndexPrefix();
    }
    // Define the required ACLs.
    var requiredACLs = ['addObject', 'deleteObject', 'deleteIndex', 'settings'];

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
    var actualACLs = keyData.acl || [];

    // Check for missing required ACLs.
    var missingACLs = requiredACLs.filter(function (acl) {
        return actualACLs.indexOf(acl) === -1;
    });
    if (missingACLs.length > 0) {
        return {
            error: true,
            errorMessage: Resource.msgf('algolia.error.missing.permissions', 'algolia', null, missingACLs.join(', '))
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

    // Identify any extra (excessive) ACLs.
    var excessiveACLs = actualACLs.filter(function (acl) {
        return requiredACLs.indexOf(acl) === -1;
    });

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
    validateAPIKey: validateAPIKey
};
