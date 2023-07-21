/**
 *  Client to communicate with Algolia's Ingestion API:
 *  https://www.algolia.com/doc/rest-api/ingestion/
 **/

var algoliaIngestionService = require('*/cartridge/scripts/services/algoliaIngestionService');
var Logger = require('dw/system/Logger');

/**
 * Register the source
 * https://www.algolia.com/doc/rest-api/ingestion/#create-a-source
 * @param {string} name - name
 * @param {string} siteID - SFCC site ID
 *
 * @returns {string} sourceID - the ID of the created source
 */
function registerSource(name, siteID) {
    var ingestionService = algoliaIngestionService.getService();
    var baseURL = ingestionService.getConfiguration().getCredential().getURL();

    ingestionService.setRequestMethod('POST');
    ingestionService.setURL(baseURL + '/1/sources');

    var requestBody = {
        type: 'sfcc',
        name: name,
        input: {
            siteID: siteID,
        }
    };

    try {
        var result = ingestionService.setThrowOnError().call(requestBody);
        if (result.ok) {
            return result.object.body.sourceID;
        } else {
            Logger.error('Error while registering source. Response: ' + result.object.body);
        }
    } catch(e) {
        Logger.error('Uncaught error while registering source: ' + e.message + ': ' + e.stack);
    }
}

/**
 * Register the authentication
 * https://www.algolia.com/doc/rest-api/ingestion/#create-a-authentication
 * @param {Object} authInfo - authentication info object
 * @param {string} authInfo.name - authentication name
 * @param {string} authInfo.appId - authentication appId
 * @param {string} authInfo.apiKey - authentication apiKey
 *
 * @returns {string} authenticationID - the ID of the created authentication
 */
function registerAuthentication(authInfo) {
    var ingestionService = algoliaIngestionService.getService();
    var baseURL = ingestionService.getConfiguration().getCredential().getURL();

    ingestionService.setRequestMethod('POST');
    ingestionService.setURL(baseURL + '/1/authentications');

    var requestBody = {
        type: 'algolia',
        name: authInfo.name,
        input: {
            appID: authInfo.appId,
            apiKey: authInfo.apiKey,
        },
    };

    try {
        var result = ingestionService.setThrowOnError().call(requestBody);
        if (result.ok) {
            return result.object.body.authenticationID;
        } else {
            Logger.error('Error while registering authentication for appId + ' + authInfo.appId + '. Response: ' + result.object.body);
        }
    } catch(e) {
        Logger.error('Uncaught error while registering authentication for appId + ' + authInfo.appId + ': ' + e.message + ': ' + e.stack);
    }
}

/**
 * Register the destination
 * https://www.algolia.com/doc/rest-api/ingestion/#create-a-destination
 * @param {Object} destinationInfo - destination info object
 * @param {string} destinationInfo.name - destination name
 * @param {string} destinationInfo.indexName - destination index name
 * @param {string} destinationInfo.authenticationID - authenticationID to use
 *
 * @returns {string} destinationID - the ID of the created destination
 */
function registerDestination(destinationInfo) {
    var ingestionService = algoliaIngestionService.getService();
    var baseURL = ingestionService.getConfiguration().getCredential().getURL();

    ingestionService.setRequestMethod('POST');
    ingestionService.setURL(baseURL + '/1/destinations');

    var requestBody = {
        type: 'search',
        name: destinationInfo.name,
        input: {
            indexName: destinationInfo.indexName,
        },
        authenticationID: destinationInfo.authenticationID,
    };

    try {
        var result = ingestionService.setThrowOnError().call(requestBody);
        if (result.ok) {
            return result.object.body.destinationID;
        } else {
            Logger.error('Error while registering destination (indexName=' + destinationInfo.indexName + 'authenticationID=' + authenticationID + '). Response: ' + result.object.body);
        }
    } catch(e) {
        Logger.error('Error while registering destination (indexName=' + destinationInfo.indexName + 'authenticationID=' + authenticationID + '):' + e.message + ': ' + e.stack);
    }
}

/**
 * Register a task
 * https://www.algolia.com/doc/rest-api/ingestion/#create-a-task
 * @param {Object} taskInfo - task info object
 * @param {string} taskInfo.sourceID - sourceID of the task
 * @param {string} taskInfo.destinationID - destinationID of the task
 * @param {string} taskInfo.action - action of the task
 *
 * @returns {string} taskID - the ID of the created task
 */
function registerTask(taskInfo) {
    var ingestionService = algoliaIngestionService.getService();
    var baseURL = ingestionService.getConfiguration().getCredential().getURL();

    ingestionService.setRequestMethod('POST');
    ingestionService.setURL(baseURL + '/1/tasks');

    var requestBody = {
        sourceID: taskInfo.sourceID,
        destinationID: taskInfo.destinationID,
        action: taskInfo.action,
        trigger: {
            type: 'subscription'
        },
    };

    try {
        var result = ingestionService.setThrowOnError().call(requestBody);
        if (result.ok) {
            return result.object.body.taskID;
        } else {
            Logger.error('Error while registering task ' + taskInfo.action + '(sourceID=' + taskInfo.sourceID + '; destinationID=' + taskInfo.destinationID + '). Response: ' + result.object.body);
        }
    } catch(e) {
        Logger.error('Uncaught error while registering task ' + taskInfo.action + '(sourceID=' + taskInfo.sourceID + '; destinationID=' + taskInfo.destinationID + '): ' + e.message + ': ' + e.stack);
    }
}

module.exports.registerSource = registerSource;
module.exports.registerAuthentication = registerAuthentication;
module.exports.registerDestination = registerDestination;
module.exports.registerTask = registerTask;
