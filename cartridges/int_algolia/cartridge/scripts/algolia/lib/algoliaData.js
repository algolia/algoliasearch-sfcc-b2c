'use strict';

var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');
var System = require('dw/system/System');
var URLUtils = require('dw/web/URLUtils');
var Resource = require('dw/web/Resource');
var logHelper = require('*/cartridge/scripts/algolia/helper/logHelper');

const version = require('*/algoliaconfig').version;

var currentSite = getCurrentSite(); // eslint-disable-line no-use-before-define

// exported properties
const CATEGORIES_SEPARATOR = ' > ';
const clientSideData = {
    "version": version,
    "enable": getPreference('Enable'),
    "applicationID": getPreference('ApplicationID'),
    "searchApiKey": getPreference('SearchApiKey'),
    "locale": request.getLocale(),
    "currencyCode": request.getSession().getCurrency().getCurrencyCode(),
    "currencySymbol": request.getSession().getCurrency().getSymbol(),
    "productsIndex": calculateIndexName('products'),
    "categoriesIndex": calculateIndexName('categories'),
    "quickViewUrlBase": URLUtils.url('Product-ShowQuickView').toString(),
    "strings": {
        "placeholder": Resource.msg('label.header.searchwatermark', 'common', null),
        "moreResults": Resource.msg('button.more', 'algolia', null),
        "noResults": Resource.msg('search.noResults','algolia',null),
        "result": Resource.msg('search.result','algolia',null),
        "results": Resource.msg('search.results','algolia',null),
        "bestMatches": Resource.msg('search.bestMatches','algolia',null),
        "priceAsc": Resource.msg('search.priceAsc','algolia',null),
        "priceDesc": Resource.msg('search.priceDesc','algolia',null),
        "reset": Resource.msg('link.reset', 'algolia', null),
        "brandPanelTitle": Resource.msg('search.brand','algolia',null),
        "sizePanelTitle": Resource.msg('link.size_chart','algolia',null),
        "colorPanelTitle": Resource.msg('label.tile.swatch.colors','algolia',null),
        "pricePanelTitle": Resource.msg('search.price','algolia',null),
        "categoryPanelTitle": Resource.msg('search.category','algolia',null),
        "products": Resource.msg('search.suggest.products','algolia',null),
        "categories": Resource.msg('search.suggest.categories','algolia',null),
        "priceFilter": {
            "separator": Resource.msg('search.pricefilter.separator','algolia',null),
            "submit": Resource.msg('search.pricefilter.submit','algolia',null),
        },
        "newArrivals": Resource.msg('panel.newarrivals','algolia',null)
    },
    "noImages": {
        "large": URLUtils.staticURL('/images/noimagelarge.png').toString(),
        "medium": URLUtils.staticURL('/images/noimagemedium.png').toString(),
        "small": URLUtils.staticURL('/images/noimagesmall.png').toString()
    }
};

//  Script for getting Algolia preferences
//
//             ID                 ║                    description                    ║ type of preference
//   ═════════════════════════════╬═══════════════════════════════════════════════════╬═══════════════════════════
//   Enable                       ║ Enable/disable all Algolia                        ║ Boolean
//   ApplicationID                ║ Identifies the application for this site          ║ String
//   SearchApiKey                 ║ Authorization key for Algolia                     ║ String
//   AdminApiKey                  ║ Authorization Admin key for Algolia               ║ String
//   AdditionalAttributes         ║ Any additional Product attributes                 ║ Set-of-string
//   AdditionalContentAttributes  ║ Any additional Content attributes                 ║ Set-of-string
//   InStockThreshold             ║ Stock Threshold                                   ║ Double
//   IndexPrefix                  ║ Optional prefix for the index name                ║ String
//   EnableSSR                    ║ Enables server-side rendering of CLP results      ║ Boolean
//  ══════════════════════════════╩═══════════════════════════════════════════════════╩═══════════════════════════
//  Preferences stored in the XML file
//
//             ID                ║                       description                        ║ type of preference
//   ════════════════════════════╬══════════════════════════════════════════════════════════╬════════════════════
//   LastCategorySyncDate        ║ Date of the last Category index sync job run (read only) ║ String
//   LastProductSyncDate         ║ Date of the last product index sync job run (read only)  ║ String
//   LastProductSyncLog          ║ Last product sync job log                                ║ String
//   LastProductDeltaSyncLog     ║ Last product delta sync job log                          ║ String
//   LastPartialPriceSyncLog     ║ Last partial price sync job log                          ║ String
//   LastPartialInventorySyncLog ║ Last partial inventory sync job log                      ║ String
//   LastCategorySyncLog         ║ Last category sync job log                               ║ String
//   ════════════════════════════╩══════════════════════════════════════════════════════════╩════════════════════
//
//  Example:
//    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
//    algoliaData.getPreference('Enable');
//    algoliaData.setPreference('Enable', true);
//
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════


/**
 * @description Getting preference for Algolia
 * @param {string} id name of preference
 * @returns {*} value of preference
 */
function getPreference(id) {
    let value = currentSite.getCustomPreferenceValue('Algolia_' + id);
    return value === null ? '' : value;
}

/**
 * @description Set preference for Algolia
 * @param {string} id name of preference
 * @param {string} value value to save
 * @returns {void}
 */
function setPreference(id, value) {
    Transaction.wrap(function () {
        currentSite.setCustomPreferenceValue('Algolia_' + id, value);
    });
}

/**
 * @description Getting preference (as set of strings) for Algolia
 * @param {string} id name of preference
 * @returns {array} value of preference
 */
function getSetOfArray(id) {
    let values = currentSite.getCustomPreferenceValue('Algolia_' + id);
    return values && values.length ? values.map(function (element) { return element; }) : [];
}

/**
 * @description Getting preference (as set of strings) for Algolia
 * @param {string} id name of preference
 * @returns {string} value of preference
 */
function getSetOfStrings(id) {
    let values = currentSite.getCustomPreferenceValue('Algolia_' + id);
    return values && values.length ? values.join(', ') : '';
}

/**
 * @description Set preference (as set of strings) for Algolia
 * @param {string} id name of preference
 * @param {string} value value to save
 * @returns {void}
 */
function setSetOfStrings(id, value) {
    Transaction.wrap(function () {
        var toSave = value.replace(/ /g, ''); // remove white spaces
        toSave = toSave.split(','); // create array
        currentSite.setCustomPreferenceValue('Algolia_' + id, toSave);
    });
}

/**
 * @description Get category and product log data from log file for current Site
 * @param {string} id name of preference [LastProductSyncLog | LastProductDeltaSyncLog | LastPartialPriceSyncLog | LastPartialInventorySyncLog | LastCategorySyncLog]
 * @returns {Object} log data
 */
function getLogData(id) {
    var productLog = null;
    switch (id) {
        case 'LastCategorySyncLog': productLog = logHelper.getLogData('category'); break;
        case 'LastProductSyncLog': productLog = logHelper.getLogData('product'); break;
        case 'LastProductDeltaSyncLog': productLog = logHelper.getLogData('productdelta'); break;
        case 'LastPartialPriceSyncLog': productLog = logHelper.getLogData('partialproductprice'); break;
        case 'LastPartialInventorySyncLog': productLog = logHelper.getLogData('partialproductinventory'); break;
    }
    return productLog;
}

/**
 * @description Save product and category log data to file for current Site
 * @param {string} id name of preference [LastProductSyncLog | LastProductDeltaSyncLog | LastPartialPriceSyncLog | LastPartialInventorySyncLog | LastCategorySyncLog]
 * @param {Object} productLog ploduct log Object
 * @returns {bullean} Log data write success
 */
function setLogData(id, productLog) {
    var result = false;
    switch (id) {
        case 'LastCategorySyncLog': result = logHelper.setLogData('category', productLog); break;
        case 'LastProductSyncLog': result = logHelper.setLogData('product', productLog); break;
        case 'LastProductDeltaSyncLog': result = logHelper.setLogData('productdelta', productLog); break;
        case 'LastPartialPriceSyncLog': result = logHelper.setLogData('partialproductprice', productLog); break;
        case 'LastPartialInventorySyncLog': result = logHelper.setLogData('partialproductinventory', productLog); break;
    }
    return result;
}

/**
 * @description Get category and product log data from log file for all Sites
 * @returns {Array} array of Sites log data
 */
function getLogDataAllSites() {
    return logHelper.getLogDataAllSites();
}

/**
 * Get instance hostname replacing dots with dashes and skipping
 * the general parts from the sandbox hostnames.
 * @returns {string} hostname
 */
function getInstanceHostName() {
    var instanceHostname = System.getInstanceHostname();

    // remove the sandbox host
    if (System.instanceType === System.DEVELOPMENT_SYSTEM) {
        instanceHostname = instanceHostname.replace('.commercecloud.salesforce.com', '');
        instanceHostname = instanceHostname.replace('.demandware.net', '');
    }
    // replace dots
    return instanceHostname.replace(/[\.|-]/g, '_'); /* eslint-disable-line */
}

/**
 * Create index prefix for search results request
 * If custom site preference Algolia_IndexPrefix is set in BM,
 * its value will be used as a prefix instead of the first part of the hostname and the siteID
 * @returns {string} index prefix
 */
function getIndexPrefix() {
    var indexPrefix = getPreference('IndexPrefix');

    if (!empty(indexPrefix)) {
        return indexPrefix.trim();
    } else {
        return getInstanceHostName() + '__' + currentSite.getID();
    }
}

/**
 * Create index name for search results request
 * If custom site preference Algolia_IndexPrefix is set in BM,
 * its value will be used as a prefix instead of the first part of the hostname and the siteID
 * @param {string} type type of indices: products | categories
 * @param {string} locale optional: requested locale
 * @returns {string} index name
 */
function calculateIndexName(type, locale) {
    return getIndexPrefix() + '__' + type + '__' + (locale || request.getLocale());
}

/**
 * @description Convert Date to local DateTime format string
 * @param {Date} date Date
 * @returns {string} local formated DateTime
 */
function getLocalDateTime(date) {
    return empty(date) ? '---' : date.toLocaleDateString() + ' | ' + date.toLocaleTimeString();
}

/**
 * @description Get Date preference to local DateTime format string
 * @param {string} id name of Date preference [LastCategorySyncDate, LastProductSyncDate]
 * @returns {string} local formated DateTime
 */
function getSyncLocalDateTime(id) {
    var productLog = null;
    switch (id) {
        case 'LastCategorySyncDate': productLog = logHelper.getLogData('category'); break;
        case 'LastProductSyncDate': productLog = logHelper.getLogData('product'); break;
        case 'LastProductDeltaSyncDate': productLog = logHelper.getLogData('productdelta'); break;
        case 'LastPartialPriceSyncLog': productLog = logHelper.getLogData('partialproductprice'); break;
        case 'LastPartialInventorySyncLog': productLog = logHelper.getLogData('partialproductinventory'); break;
    }
    return empty(productLog) ? '---' : productLog.sendDate;
}

/**
 * @description Get sites that have Algolia enabled
 * @returns {Array} array of sites that have Algolia enabled
 */
function getAlgoliaSites() {
    return Site.getAllSites().toArray().filter(function (site) {
        return site.getCustomPreferenceValue('Algolia_Enable');
    });
}

/**
 * @description Get current site depending on request parameter
 * @returns {dw.system.Site} current site
 */
function getCurrentSite() {
    if (request.httpParameterMap && request.httpParameterMap.isParameterSubmitted('siteID')) {
        var result = null;
        var siteIterator = Site.getAllSites().iterator();

        while (siteIterator.hasNext()) {
            var site = siteIterator.next();
            if (site.ID === request.httpParameterMap.siteID.stringValue) {
                result = site;
                break;
            }
        }

        return result;
    }

    return Site.getCurrent();
}

/**
 * Splits a string by a separator into an array of substrings and trims the values
 * @param {string} string input string
 * @param {string} [separator] separator to split by
 * @returns {Array} array of strings the original string is separated into
 */
function csvStringToArray(string, separator) {
    if (typeof string !== 'string' || empty(string)) {
        return [];
    } else {
        return string.split(separator ? separator : ',').map(function(item) {
            return item.trim();
        });
    }
}

module.exports = {
    getPreference: getPreference,
    setPreference: setPreference,
    getSetOfArray: getSetOfArray,
    getSetOfStrings: getSetOfStrings,
    setSetOfStrings: setSetOfStrings,
    getLogData: getLogData,
    setLogData: setLogData,
    getLogDataAllSites: getLogDataAllSites,
    getInstanceHostName: getInstanceHostName,
    getIndexPrefix: getIndexPrefix,
    calculateIndexName: calculateIndexName,
    getLocalDateTime: getLocalDateTime,
    getSyncLocalDateTime: getSyncLocalDateTime,
    getAlgoliaSites: getAlgoliaSites,
    getCurrentSite: getCurrentSite,
    csvStringToArray: csvStringToArray,
    CATEGORIES_SEPARATOR: CATEGORIES_SEPARATOR,
    clientSideData: clientSideData,
};
