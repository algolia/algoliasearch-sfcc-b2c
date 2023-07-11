'use strict';

var File = require('dw/io/File');
var FileWriter = require('dw/io/FileWriter');
var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter');
var FileReader = require('dw/io/FileReader');
var XMLStreamReader = require('dw/io/XMLStreamReader');

var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

var LOG_NODE_NAME = 'logger';

/**
 * Log Data Object
 */
function LogJob() {
    this.processedDate = '---';
    this.processedError = false;
    this.processedErrorMessage = '';
    this.processedRecords = 0;
    this.processedToUpdateRecords = 0;
    this.sendDate = '---';
    this.sendError = false;
    this.sendErrorMessage = '';
    this.sentChunks = 0;
    this.sentRecords = 0;
    this.failedChunks = 0;
    this.failedRecords = 0;
}

/**
 * Read JS object from XML file
 * @param {dw.io.XMLStreamReader} xmlStreamReader - XML Stream Reader
 * @param {string} nodeName - name of node XML object
 * @returns {Object} - JS object
 */
function readObject(xmlStreamReader, nodeName) {
    var objXML = jobHelper.readXMLObjectFromStream(xmlStreamReader, nodeName);
    var obj = jobHelper.xmlToObject(objXML);
    return obj ? obj[nodeName] : null;
}

/**
 * @description Get category and product log data from log file for current site
 * @param {string} id - name of preference [category | product | productdelta]
 * @param {string} logFileName - full Log file name
 * @returns {Object} - log data
 */
function getLogData(id, logFileName) {
    var logData = {
        category: new LogJob(),
        product: new LogJob(),
        productdelta: new LogJob(),
    };

    var logFile = empty(logFileName) ? new File(algoliaConstants.ALGOLIA_LOG_FILE) : new File(logFileName);

    if (logFile.exists()) {
        var logFileReader = null;
        var logXMLFileReader = null;

        try {
            // Open file
            logFileReader = new FileReader(logFile, 'UTF-8');
            logXMLFileReader = new XMLStreamReader(logFileReader);
            logData = readObject(logXMLFileReader, LOG_NODE_NAME);
        } catch (error) {
            jobHelper.logFileError(algoliaConstants.ALGOLIA_LOG_FILE, 'Error open file to read', error);
        }

        logXMLFileReader.close();
        logFileReader.close();
    }

    var result = null;
    switch (id) {
        case 'category': result = logData.category ? logData.category : null; break;
        case 'product': result = logData.product ? logData.product : null; break;
        case 'productdelta': result = logData.productdelta ? logData.productdelta : null; break;
        case LOG_NODE_NAME: result = logData; break;
    }

    return result;
}

/**
 * @description Get category and product log data from log file for ALL SITES
 * @returns {Array} -  array of Sites log data
 */
function getLogDataAllSites() {
    var sites = require('dw/system/Site').getAllSites();
    var result = [];
    for (var i = 0; i < sites.size(); i += 1) {
        var logFileName = algoliaConstants.ALGOLIA_FILES_FOLDER + sites[i].getID() + algoliaConstants.ALGOLIA_LOG_FILE_NAME;
        var logFile = new File(logFileName);

        if (logFile.exists()) {
            var siteLog = {
                siteID: sites[i].getID(),
                category: null,
                product: null,
                productdelta: null,
            };
            siteLog.category = getLogData('category', logFileName);
            siteLog.product = getLogData('product', logFileName);
            siteLog.productdelta = getLogData('productdelta', logFileName);
            result.push(siteLog);
        }
    }
    return result;
}

/**
 * @description Save product and category log data to file for current site
 * @param {string} id - name of preference [category | product | productdelta]
 * @param {Object} productLog - product log Object
 * @returns {boolean} - Log data write success
 */
function setLogData(id, productLog) {
    if (empty(productLog) || empty(id)) return false;

    var logData = getLogData(LOG_NODE_NAME);
    logData[id] = productLog;
    // Open Delta XML file to write
    var logFile = new File(algoliaConstants.ALGOLIA_LOG_FILE);
    var logFileWriter = null;
    var logXmlWriter = null;
    try {
        logFileWriter = new FileWriter(logFile, 'UTF-8');
        logXmlWriter = new XMLStreamWriter(logFileWriter);
        logXmlWriter.writeStartDocument();
    } catch (error) {
        jobHelper.logFileError(logFile.fullPath, 'Error open Log file to write', error);
        return false;
    }

    var logXML = new XML('<' + LOG_NODE_NAME + '></' + LOG_NODE_NAME + '>');
    jobHelper.appendObjToXML(logXML, logData);
    logXmlWriter.writeCharacters('\n');
    logXmlWriter.writeRaw(logXML.toXMLString());
    logXmlWriter.writeCharacters('\n');

    // Close XML Update file
    logXmlWriter.writeEndDocument();
    logXmlWriter.close();
    logFileWriter.close();
    return true;
}

module.exports = {
    getLogDataAllSites: getLogDataAllSites,
    getLogData: getLogData,
    setLogData: setLogData
};
