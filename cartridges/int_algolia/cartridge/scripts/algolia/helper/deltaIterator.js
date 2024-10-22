'use strict';

var File = require('dw/io/File'); // eslint-disable-line no-redeclare
var FileReader = require('dw/io/FileReader'); // eslint-disable-line no-redeclare
var XMLStreamReader = require('dw/io/XMLStreamReader');
var XMLStreamConstants = require('dw/io/XMLStreamConstants');

var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');

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

var DeltaIterator = function () {
    this.deltaFile = null;
    this.deltaFileReader = null;
    this.deltaXmlReader = null;
    this.dataBuffer = null;
    this.size = null;
    this.nodeName = null;
};

DeltaIterator.create = function (fileName, nodeName) {
    var newDeltaIterator = new DeltaIterator();
    newDeltaIterator.deltaFile = new File(fileName);
    newDeltaIterator.nodeName = nodeName;
    var deltaFileReader = null;
    var counter = 0;

    try {
        // Scan file and calculate number of ProductObjects
        deltaFileReader = new FileReader(newDeltaIterator.deltaFile, 'UTF-8');
        var xmlStreamReader = new XMLStreamReader(deltaFileReader);
        while (xmlStreamReader.hasNext()) {
            if (xmlStreamReader.next() === XMLStreamConstants.START_ELEMENT) {
                var localElementName = xmlStreamReader.getLocalName();
                if (localElementName === nodeName) { counter += 1; }
            }
        }
        xmlStreamReader.close();
    } catch (error) {
        jobHelper.logFileError(fileName, 'Error open file to read', error);
        newDeltaIterator.close();
        return null;
    }

    // Re-open XML Delta file to read
    newDeltaIterator.size = counter;
    newDeltaIterator.deltaFileReader = new FileReader(newDeltaIterator.deltaFile, 'UTF-8');
    newDeltaIterator.deltaXmlReader = new XMLStreamReader(newDeltaIterator.deltaFileReader);

    // Read first object to buffer
    if (counter > 0) {
        newDeltaIterator.dataBuffer = readObject(newDeltaIterator.deltaXmlReader, nodeName);
    }

    return newDeltaIterator;
};

DeltaIterator.prototype.close = function () {
    if (empty(this.deltaXmlReader)) { return false; }
    // Close XML Delta file
    this.deltaXmlReader.close();
    this.deltaFileReader.close();
    this.deltaXmlReader = null;
    this.deltaFileReader = null;
    this.dataBuffer = null;
    this.size = null;
    this.nodeName = null;

    return true;
};

DeltaIterator.prototype.next = function () {
    var result = null;

    if (empty(this.deltaXmlReader) || empty(this.dataBuffer)) { return result; }

    result = this.dataBuffer;
    try {
        this.dataBuffer = readObject(this.deltaXmlReader, this.nodeName);
    } catch (error) {
        jobHelper.logFileError(this.deltaFile.fullPath, 'Error read from file', error);
        this.close();
        return null;
    }

    return result;
};

DeltaIterator.prototype.hasNext = function () {
    return !empty(this.dataBuffer);
};

DeltaIterator.prototype.getSize = function () {
    return this.size;
};

DeltaIterator.prototype.getRecordSize = function () {
    // calculate size of object in buffer
    var recordSize = 0;
    if (this.dataBuffer) {
        try {
            recordSize = JSON.stringify(this.dataBuffer).length;
        } catch (e) { // eslint-disable-line no-unused-vars
            recordSize = 0;
        }
    }

    return recordSize;
};

module.exports = DeltaIterator;
