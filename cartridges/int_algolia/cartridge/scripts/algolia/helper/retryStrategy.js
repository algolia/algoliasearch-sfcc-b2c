const Result = require('dw/svc/Result')
const Logger = require('dw/system/Logger');

const algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
const appID = algoliaData.getPreference('ApplicationID');

const EXPIRATION_DELAY = 5 * 60 * 1000;

const INDEXING_APIS = {
    SEARCH_API: 'search-api',
    INGESTION_API: 'ingestion-api',
}

const ANALYTICS_REGIONS = {
    EU: 'eu',
    US: 'us',
}

// TODO: make these into site preferences -- return analyticsRegion programmatically if possible - getIndexSettings?
const analyticsRegion = ANALYTICS_REGIONS.EU;

let statefulhosts = {};

/**
 * Class keeping a host's state
 * @param {string} hostname hostname
 * @constructor
 */
function StatefulHost(hostname) {
    this.hostname = hostname;
    this.isDown = false;
    this.lastUpdate = Date.now();
}
StatefulHost.prototype.markDown = function() {
    this.lastUpdate = Date.now();
    this.isDown = true;
}
StatefulHost.prototype.isExpired = function() {
    return this.isDown && (Date.now() - this.lastUpdate > EXPIRATION_DELAY)
}
StatefulHost.prototype.reset = function() {
    Logger.info('Resetting host ' + this.hostname + '...');
    this.lastUpdate = Date.now();
    this.isDown = false;
}

/**
 * Initialize the default hosts, based on the 'ApplicationID' custom preference and the selected indexingAPI
 * @param {String} indexingAPI the indexing API to use for the call, Search API or Ingestion API
 */
function initHosts(indexingAPI) {
    switch (indexingAPI) {
        case INDEXING_APIS.INGESTION_API: {
            statefulhosts[INDEXING_APIS.INGESTION_API] = [
                new StatefulHost('data.' + analyticsRegion + '.algolia.com'),
            ];
            break;
        }
        default:
        case INDEXING_APIS.SEARCH_API: {
            statefulhosts[INDEXING_APIS.SEARCH_API] = [
                new StatefulHost(appID + '.algolia.net'),
                new StatefulHost(appID + '-1.algolianet.com'),
                new StatefulHost(appID + '-2.algolianet.com'),
                new StatefulHost(appID + '-3.algolianet.com'),
            ];
            break;
        }
    }
}

/**
 * Return the currently available hosts
 * @return {StatefulHost[]} The list of available hosts
 */
function getAvailableHosts(indexingAPI) {
    const res = [];

    // defaulting to 'search'api'
    if (typeof indexingAPI === 'undefined') {
        indexingAPI = INDEXING_APIS.SEARCH_API;
    }

    if (empty(statefulhosts[indexingAPI])) {
        initHosts(indexingAPI);
    }

    for (let i = 0; i < statefulhosts[indexingAPI].length; ++i) {
        if (statefulhosts[indexingAPI][i].isExpired()) {
            statefulhosts[indexingAPI][i].reset();
        }
        if (!statefulhosts[indexingAPI][i].isDown) {
            res.push(statefulhosts[indexingAPI][i]);
        }
    }
    if (res.length > 0) {
        return res;
    }

    Logger.info('All hosts are down, retrying them...');
    for (let i = 0; i < statefulhosts[indexingAPI].length; ++i) {
        res.push(statefulhosts[indexingAPI][i]);
    }
    return res;
}

/**
 * Helper to check if a dw.svc.Result is a timeout error
 * https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_svc_Result.html#dw_svc_Result_UNAVAILABLE_TIMEOUT_DetailAnchor
 * @param {dw.svc.Result} result The result to check
 * @return {boolean} True if it corresponds to a timeout error
 */
function isTimeoutError(result) {
    return result.getUnavailableReason() === Result.UNAVAILABLE_TIMEOUT;
}

/**
 * Determines if a service call result to Algolia is retryable
 * @param {dw.svc.Result} result - The service call result
 * @returns {boolean} - true if the request is retryable
 */
function isRetryable(result) {
    const status = result.getError();
    return (
        isTimeoutError(result) || (~~(status / 100) !== 2 && ~~(status / 100) !== 4)
    );
}

/**
 * Main logic of the retry strategy.
 * For a given request parameters, sends the request to each available hosts until it gets a valid response.
 * Available hosts are calculated based on the 'ApplicationID' custom property and the requestParams.indexingAPI parameter (Search or Ingestion)
 *
 * @param {dw.svc.HTTPService} service The service used to send the request
 * @param {Object} requestParams The request parameters
 * @return {dw.svc.Result} The first non-retryable result
 */
function retryableCall(service, requestParams) {
    // even with the Ingestion API selected for indexing globally, there are calls which
    // need to be made to the Search API, so the hosts need to be defined on a call-by-call basis
    let indexingAPI = requestParams.indexingAPI === INDEXING_APIS.INGESTION_API ? INDEXING_APIS.INGESTION_API : INDEXING_APIS.SEARCH_API;

    let result;
    let hosts = getAvailableHosts(indexingAPI);
    for (let i = 0; i < hosts.length; ++i) {
        let statefulhost = hosts[i];
        result = service.call({
            method: requestParams.method,
            url: 'https://' + statefulhost.hostname + requestParams.path,
            body: requestParams.body,
        });

        if (result.ok || !isRetryable(result)) {
            return result;
        }

        Logger.error('Request error on ' + statefulhost.hostname + ': ' +
            result.getError() + ' - ' + result.getErrorMessage());
        if (!isTimeoutError(result)) {
            Logger.info('Marking host ' + statefulhost.hostname + ' down.');
            statefulhost.markDown();
        }
    }

    // All hosts have been tried, return the last result
    return result;
}

module.exports.retryableCall = retryableCall;

// For testing
module.exports.StatefulHost = StatefulHost;
module.exports.initHosts = initHosts;
module.exports.getAvailableHosts = getAvailableHosts;
module.exports.isRetryable = isRetryable;
