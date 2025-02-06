'use strict';

const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
const System = require('dw/system/System');
const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

const version = require('*/algoliaconfig').version;

/**
 * Algolia Indexing Service definition file
 * The service can be called with the following parameters object:
 * { "method": string, "url": string, "body": {} }
 * @param {Object} jobInfo - Some information about the job using the service
 * @returns {dw.svc.HTTPService} - HTTPService object
 */
function getService(jobInfo) {
    const applicationID = jobInfo.applicationID || algoliaData.getPreference('ApplicationID');
    const adminAPIKey = jobInfo.adminApikey || algoliaData.getPreference('AdminApiKey');

    if (empty(applicationID) || empty(adminAPIKey)) {
        throw new Error('Indexing service: Missing credentials');
    }

    let indexingService = LocalServiceRegistry.createService('algolia.http.search.write', {
        createRequest: function (service, parameters) {
            if (parameters) {
                service.setRequestMethod(parameters.method || 'POST');
                service.setURL(parameters.url);
                return JSON.stringify(parameters.body);
            }
        },
        parseResponse: function (service, response) {
            return {
                body: JSON.parse(response.text),
                headers: response.responseHeaders,
                statusCode: response.statusCode,
            }
        },
    });

    indexingService.addHeader('Content-Type', 'application/json; charset=UTF-8');
    indexingService.addHeader('X-Algolia-Application-Id', applicationID);
    indexingService.addHeader('X-Algolia-API-Key', adminAPIKey);
    indexingService.addHeader(
        'x-algolia-agent', 'Algolia Salesforce B2C v' + version +
        '; CM: ' + System.getCompatibilityMode() +
        '; JobID: ' + (jobInfo ? jobInfo.jobID : 'unknown') +
        '; StepID: ' + (jobInfo ? jobInfo.stepID : 'unknown') +
        (jobInfo && jobInfo.indexingMethod ? '; IndexingMethod: ' + jobInfo.indexingMethod : '')
    );

    return indexingService;
}

module.exports.getService = getService;
