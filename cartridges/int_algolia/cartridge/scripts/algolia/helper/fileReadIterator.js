'use strict';

var File = require('dw/io/File');
var FileReader = require('dw/io/FileReader');
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

var FileReadterator = function () {
    this.nodeName = null;
    this.file = null;
    this.fileReader = null;
    this.xmlReader = null;
    this.dataBuffer = null;
};

FileReadterator.create = function (xmlFileName, nodeName) {
    var newFileReadterator = new FileReadterator();
    newFileReadterator.file = new File(xmlFileName);

    try {
        // Open file
        newFileReadterator.fileReader = new FileReader(newFileReadterator.file, 'UTF-8');
        newFileReadterator.xmlReader = new XMLStreamReader(newFileReadterator.fileReader);

        // Read first object to buffer
        newFileReadterator.nodeName = nodeName;
        newFileReadterator.dataBuffer = readObject(newFileReadterator.xmlReader, nodeName);
    } catch (error) {
        jobHelper.logFileError(xmlFileName, 'Error open file or read', error);
        newFileReadterator.close();
        newFileReadterator = null;
    }

    return newFileReadterator;
};

FileReadterator.prototype.close = function () {
    if (empty(this.deltaXmlReader)) { return false; }
    // Close XML Delta file
    this.xmlReader.close();
    this.fileReader.close();
    this.xmlReader = null;
    this.fileReader = null;
    this.dataBuffer = null;
    return true;
};

FileReadterator.prototype.next = function () {
    var result = null;

    if (empty(this.xmlReader) || empty(this.dataBuffer)) { return result; }

    result = this.dataBuffer;
    this.dataBuffer = readObject(this.xmlReader, this.nodeName);

    return result;
};

FileReadterator.prototype.hasNext = function () {
    return !empty(this.dataBuffer);
};

module.exports = FileReadterator;
