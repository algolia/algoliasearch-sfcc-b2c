'use strict';

var File = require('dw/io/File'); // eslint-disable-line no-redeclare
var FileReader = require('dw/io/FileReader'); // eslint-disable-line no-redeclare
var XMLStreamReader = require('dw/io/XMLStreamReader');

var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');

/**
 * Read JS object from XML file
 * @param {dw.io.XMLStreamReader} xmlStreamReader - XML Stream Reader
 * @param {string} nodeName - name of node XML object
 * @returns {Object} - JS object
 */
function readObject(xmlStreamReader, nodeName) {
    var result = null;
    var objXML = jobHelper.readXMLObjectFromStream(xmlStreamReader, nodeName);
    var obj = jobHelper.xmlToObject(objXML);
    if (obj) {
        result = obj[nodeName];
    }
    return result;
}

var FileReadIterator = function () {
    this.nodeName = null;
    this.file = null;
    this.fileReader = null;
    this.xmlReader = null;
    this.dataBuffer = null;
};

FileReadIterator.create = function (xmlFileName, nodeName) {
    var newFileReadIterator = new FileReadIterator();
    newFileReadIterator.file = new File(xmlFileName);

    try {
        // Open file
        newFileReadIterator.fileReader = new FileReader(newFileReadIterator.file, 'UTF-8');
        newFileReadIterator.xmlReader = new XMLStreamReader(newFileReadIterator.fileReader);

        // Read first object to buffer
        newFileReadIterator.nodeName = nodeName;
        newFileReadIterator.dataBuffer = readObject(newFileReadIterator.xmlReader, nodeName);
    } catch (error) {
        jobHelper.logFileError(xmlFileName, 'Error open file or read', error);
        newFileReadIterator.close();
        newFileReadIterator = null;
    }

    return newFileReadIterator;
};

FileReadIterator.prototype.close = function () {
    if (empty(this.deltaXmlReader)) { return false; }
    // Close XML Delta file
    this.xmlReader.close();
    this.fileReader.close();
    this.xmlReader = null;
    this.fileReader = null;
    this.dataBuffer = null;
    return true;
};

FileReadIterator.prototype.next = function () {
    var result = null;

    if (empty(this.xmlReader) || empty(this.dataBuffer)) { return result; }

    result = this.dataBuffer;
    this.dataBuffer = readObject(this.xmlReader, this.nodeName);

    return result;
};

FileReadIterator.prototype.hasNext = function () {
    return !empty(this.dataBuffer);
};

module.exports = FileReadIterator;
