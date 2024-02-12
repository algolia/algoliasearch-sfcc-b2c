'use strict';

var URLUtils = require('dw/web/URLUtils');
var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
var logger = jobHelper.getAlgoliaLogger();

var contentAssetFunctions = {
    // Generates a static URL based on the relative path provided
    staticURL: function(relPath) {
        return URLUtils.httpsStatic(relPath);
    },
    // A higher-order function to reduce duplication in creating URL functions
    createUrlFunction: function(method) {
        return function() {
            var args = Array.prototype.slice.call(arguments);
            var action = args.shift();
            try {
                return URLUtils[method].apply(URLUtils, [action].concat(args));
            } catch (e) {
                // Log or handle the error as appropriate for your application
                logger.error('Error calling URLUtils.: ' + method + ': ', e);
                return null;
            }
        };
    }
};

// Extending contentAssetFunctions with URL utility methods
contentAssetFunctions.url = contentAssetFunctions.createUrlFunction('url');
contentAssetFunctions.https = contentAssetFunctions.createUrlFunction('https');
contentAssetFunctions.http = contentAssetFunctions.createUrlFunction('http');

/**
* Splits and trims the arguments string
* @param {string} argsStr - The string of arguments to split and trim
* @returns {Array} The array of split and trimmed arguments
*/
function splitAndTrim(argsStr) {
    var args = argsStr.split(',');
    for (var i = 0; i < args.length; i++) {
        args[i] = args[i].trim();
    }
    return args;
}

/**
 * Handles content links in the body text
 * @param {string} body - The body text to handle
 * @returns {string} The body text with content links handled
 */
function contentLinkHandler(body) {
    if (!body) {
        return '';
    }

    // Check and Replace URL functions in the body text
    if (body.indexOf('$Url(') !== -1 || body.indexOf('$url(') !== -1){
        body = body.replace(/\$Url\((.*?)\)\$/gi, function(match, argsStr) {
            var args = splitAndTrim(argsStr);
            var action = args.shift();
            return contentAssetFunctions.url.apply(null, [action].concat(args));
        });
    }

    // Check and Replace HTTP URL functions in the body text
    if (body.indexOf('$httpUrl(') !== -1) {
        body = body.replace(/\$httpUrl\((.*?)\)\$/gi, function(match, argsStr) {
            var args = splitAndTrim(argsStr);
            var action = args.shift();
            return contentAssetFunctions.http.apply(null, [action].concat(args));
        });
    }

    // Check and Replace HTTPS URL functions in the body text
    if (body.indexOf('$httpsUrl(') !== -1) {
        body = body.replace(/\$httpsUrl\((.*?)\)\$/gi, function(match, argsStr) {
            var args = splitAndTrim(argsStr);
            var action = args.shift();
            return contentAssetFunctions.https.apply(null, [action].concat(args));
        });
    }

    return body;
}

// Export the content link handler function
exports.contentLinkHandler = contentLinkHandler;
