'use strict';

/**
 * Call REST service and handle common errors
 */

var logger = require('*/cartridge/scripts/algolia/helper/jobHelper').getAlgoliaLogger();
var stringUtils = require('dw/util/StringUtils');
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
 * Validates API key permissions by checking ACLs and index access
 * @param {dw.svc.Service} service - Service instance to use for validation
 * @returns {Object} Response indicating validation status and any error messages
 */
function validateAPIKey(service) {
    const applicationID = algoliaData.getPreference('ApplicationID');
    
    // First check key permissions
    const keyResponse = service.call({
        method: 'GET',
        url: 'https://' + applicationID + '.algolia.net/1/keys/' + algoliaData.getPreference('AdminApiKey')
    });

    if (!keyResponse.ok) {
        return {
            error: true,
            errorMessage: Resource.msg('algolia.error.key.validation', 'algolia', null)
        };
    }

    const keyData = keyResponse.object.body;
    const requiredACLs = ['addObject', 'deleteObject', 'deleteIndex', 'settings'];
    const missingACLs = requiredACLs.filter(function(acl) {
        return keyData.acl.indexOf(acl) === -1;
    });

    if (missingACLs.length > 0) {
        const errorMessage = Resource.msgf('algolia.error.missing.permissions', 'algolia', null, missingACLs.join(', '));
        return {
            error: true,
            errorMessage: errorMessage
        };
    }

    // Then check index access by attempting to get settings of the products index
    const testIndex = algoliaData.calculateIndexName('products');
    const indexResponse = service.call({
        method: 'GET',
        url: 'https://' + applicationID + '.algolia.net/1/indexes/' + testIndex + '/settings'
    });

    if (!indexResponse.ok) {
        return {
            error: true,
            errorMessage: Resource.msg('algolia.error.index.access', 'algolia', null)
        };
    }

    return {
        error: false,
        errorMessage: ''
    };
}

module.exports.callService = callService;
module.exports.callJsonService = callJsonService;
module.exports.UNEXPECTED_ERROR_CODE = UNEXPECTED_ERROR_CODE;
module.exports.validateAPIKey = validateAPIKey;
