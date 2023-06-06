/**
 *  Client to communicate with Algolia's Ingestion API:
 *  https://www.algolia.com/doc/rest-api/ingestion/
 **/

var algoliaIngestionService = require('*/cartridge/scripts/services/algoliaIngestionService');
var Logger = require('dw/system/Logger');

/**
 * Register a source
 * https://www.algolia.com/doc/rest-api/ingestion/#create-a-source
 * @returns {string} sourceID - the ID of the created source
 */
function registerSource(name) {
    var ingestionService = algoliaIngestionService.getService();
    var baseURL = ingestionService.getConfiguration().getCredential().getURL();

    ingestionService.setRequestMethod('POST');
    ingestionService.setURL(baseURL + '/1/sources');

    var requestBody = {
        type: 'sfcc',
        name: name,
    };

    try {
        var result = ingestionService.setThrowOnError().call(requestBody);
        if (result.ok) {
            return result.object.body.sourceID;
        } else {
            Logger.error('Error while registering source. Response: ' + result.object.body);
        }
    } catch(e) {
        Logger.error('Error while registering source: ' + e.message + ': ' + e.stack);
    }
}

/**
 * Register an authentication
 * https://www.algolia.com/doc/rest-api/ingestion/#create-a-authentication
 * @returns {string} authenticationID - the ID of the created authentication
 */
function registerAuthentication(name, appId, apiKey) {
    var ingestionService = algoliaIngestionService.getService();
    var baseURL = ingestionService.getConfiguration().getCredential().getURL();

    ingestionService.setRequestMethod('POST');
    ingestionService.setURL(baseURL + '/1/authentications');

    var requestBody = {
        type: 'algolia',
        name: name,
        input: {
            appID: appId,
            apiKey: apiKey,
        },
    };

    try {
        var result = ingestionService.setThrowOnError().call(requestBody);
        if (result.ok) {
            return result.object.body.authenticationID;
        } else {
            Logger.error('Error while registering authentication for appId + ' + appId + '. Response: ' + result.object.body);
        }
    } catch(e) {
        Logger.error('Error while registering authentication for appId + ' + appId + ': ' + e.message + ': ' + e.stack);
    }
}

/**
 * Register a destination
 * https://www.algolia.com/doc/rest-api/ingestion/#create-a-destination
 * @returns {string} destinationID - the ID of the created destination
 */
function registerDestination(name, indexName, authenticationID) {
    var ingestionService = algoliaIngestionService.getService();
    var baseURL = ingestionService.getConfiguration().getCredential().getURL();

    ingestionService.setRequestMethod('POST');
    ingestionService.setURL(baseURL + '/1/destinations');

    var requestBody = {
        type: 'search',
        name: name,
        input: {
            indexName: indexName,
        },
        authenticationID: authenticationID,
    };

    try {
        var result = ingestionService.setThrowOnError().call(requestBody);
        if (result.ok) {
            return result.object.body.destinationID;
        } else {
            Logger.error('Error while registering destination (indexName=' + indexName + 'authenticationID=' + authenticationID + '). Response: ' + result.object.body);
        }
    } catch(e) {
        Logger.error('Error while registering destination (indexName=' + indexName + 'authenticationID=' + authenticationID + '):' + e.message + ': ' + e.stack);
    }
}

/**
 * Register a task
 * https://www.algolia.com/doc/rest-api/ingestion/#create-a-task
 * @returns {string} taskID - the ID of the created task
 */
function registerTask(sourceID, destinationID, action) {
    var ingestionService = algoliaIngestionService.getService();
    var baseURL = ingestionService.getConfiguration().getCredential().getURL();

    ingestionService.setRequestMethod('POST');
    ingestionService.setURL(baseURL + '/1/tasks');

    var requestBody = {
        sourceID: sourceID,
        destinationID: destinationID,
        action: action,
        trigger: {
            type: 'onDemand'
        },
    };

    try {
        var result = ingestionService.setThrowOnError().call(requestBody);
        if (result.ok) {
            return result.object.body.taskID;
        } else {
            Logger.error('Error while registering task ' + action + '(sourceID=' + sourceID + '; destinationID=' + destinationID + '). Response: ' + result.object.body);
        }
    } catch(e) {
        Logger.error('Error while registering task ' + action + '(sourceID=' + sourceID + '; destinationID=' + destinationID + '): ' + e.message + ': ' + e.stack);
    }
}

module.exports.registerSource = registerSource;
module.exports.registerAuthentication = registerAuthentication;
module.exports.registerDestination = registerDestination;
module.exports.registerTask = registerTask;
