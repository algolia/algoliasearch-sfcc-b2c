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

    var result = ingestionService.call(requestBody);
    if (result.ok) {
        return result.object.body.sourceID;
    } else {
        Logger.error('Error while registering source. Response: ' + result.getErrorMessage());
        throw new Error(result.getErrorMessage());
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

    var result = ingestionService.call(requestBody);
    if (result.ok) {
        return result.object.body.authenticationID;
    } else {
        Logger.error('Error while registering authentication for appId + ' + authInfo.appId + '. Response: ' + result.getErrorMessage());
        throw new Error(result.getErrorMessage());
    }
}

/**
 * Update the authentication
 * https://www.algolia.com/doc/rest-api/ingestion/#update-a-authentication
 * @param {string} authenticationID - the id of the registered authentication
 * @param {Object} authInfo - authentication info object
 * @param {string} authInfo.name - authentication name
 * @param {string} authInfo.appId - authentication appId
 * @param {string} authInfo.apiKey - authentication apiKey
 *
 * @returns {string} authenticationID - the ID of the created authentication
 */
function updateAuthentication(authenticationID, authInfo) {
    var ingestionService = algoliaIngestionService.getService();
    var baseURL = ingestionService.getConfiguration().getCredential().getURL();

    ingestionService.setRequestMethod('PATCH');
    ingestionService.setURL(baseURL + '/1/authentications/' + authenticationID);

    var requestBody = {
        name: authInfo.name,
        input: {
            appID: authInfo.appId,
            apiKey: authInfo.apiKey,
        },
    };

    var result = ingestionService.call(requestBody);
    if (result.ok) {
        return result.object.body.authenticationID;
    } else {
        Logger.error('Error while updating authentication for appId + ' + authInfo.appId + ': ' + result.getErrorMessage());
        throw new Error(result.getErrorMessage());
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

    var result = ingestionService.call(requestBody);
    if (result.ok) {
        return result.object.body.destinationID;
    } else {
        Logger.error('Error while registering destination (indexName=' + destinationInfo.indexName + 'authenticationID=' + destinationInfo.authenticationID + '). Response: ' + result.getErrorMessage());
        throw new Error(result.getErrorMessage());
    }
}

/**
 * Update the destination
 * https://www.algolia.com/doc/rest-api/ingestion/#update-a-destination
 * @param {string} destinationID - the id of the registered destination
 * @param {Object} destinationInfo - destination info object
 * @param {string} destinationInfo.name - destination name
 * @param {string} destinationInfo.indexName - destination index name
 * @param {string} destinationInfo.authenticationID - authenticationID to use
 *
 * @returns {string} destinationID - the ID of the created destination
 */
function updateDestination(destinationID, destinationInfo) {
    var ingestionService = algoliaIngestionService.getService();
    var baseURL = ingestionService.getConfiguration().getCredential().getURL();

    ingestionService.setRequestMethod('PATCH');
    ingestionService.setURL(baseURL + '/1/destinations/' + destinationID);

    var requestBody = {
        name: destinationInfo.name,
        input: {
            indexName: destinationInfo.indexName,
        },
        authenticationID: destinationInfo.authenticationID,
    };

    var result = ingestionService.call(requestBody);
    if (result.ok) {
        return result.object.body.destinationID;
    } else {
        Logger.error('Error while registering destination (indexName=' + destinationInfo.indexName + 'authenticationID=' + destinationInfo.authenticationID + '). Response: ' + result.getErrorMessage());
        throw new Error(result.getErrorMessage());
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

    var result = ingestionService.call(requestBody);
    if (result.ok) {
        return result.object.body.taskID;
    } else {
        Logger.error('Error while registering task ' + taskInfo.action + '(sourceID=' + taskInfo.sourceID + '; destinationID=' + taskInfo.destinationID + '). Response: ' + result.getErrorMessage());
        throw new Error(result.getErrorMessage());
    }
}

module.exports.registerSource = registerSource;
module.exports.registerAuthentication = registerAuthentication;
module.exports.updateAuthentication = updateAuthentication;
module.exports.registerDestination = registerDestination;
module.exports.updateDestination = updateDestination;
module.exports.registerTask = registerTask;
