'use strict';

var File = require('dw/io/File');
var FileReader = require('dw/io/FileReader');
var XMLStreamReader = require('dw/io/XMLStreamReader');
var XMLStreamConstants = require('dw/io/XMLStreamConstants');

var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');
var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');

var ProductDeltaIterator = function () {
    this.deltaFile = null;
    this.deltaFileReader = null;
    this.deltaXmlReader = null;
    this.dataBuffer = null;
    this.size = null;
};

ProductDeltaIterator.create = function () {
    var newProductDeltaIterator = new ProductDeltaIterator();

    var fileName = algoliaConstants.UPDATE_PRODUCTS_FILE_NAME;
    newProductDeltaIterator.deltaFile = new File(fileName);

    // Scan file and calculate number of ProductObjects
    var deltaFileReader = new FileReader(newProductDeltaIterator.deltaFile, 'UTF-8');
    var xmlStreamReader = new XMLStreamReader(deltaFileReader);
    var counter = 0;
    while (xmlStreamReader.hasNext()) {
        if (xmlStreamReader.next() === XMLStreamConstants.START_ELEMENT) {
            var localElementName = xmlStreamReader.getLocalName();
            if (localElementName === 'product') { counter += 1; }
        }
    }
    xmlStreamReader.close();
    xmlStreamReader.close();

    // Re-open XML Delta file to read
    newProductDeltaIterator.size = counter;
    newProductDeltaIterator.deltaFileReader = new FileReader(newProductDeltaIterator.deltaFile, 'UTF-8');
    newProductDeltaIterator.deltaXmlReader = new XMLStreamReader(newProductDeltaIterator.deltaFileReader);

    // Read first object to buffer
    var productDeltaXML = jobHelper.readXMLObjectFromStream(newProductDeltaIterator.deltaXmlReader, 'product');
    var product = jobHelper.xmlToObject(productDeltaXML);
    newProductDeltaIterator.dataBuffer = product ? product.product : null;

    return newProductDeltaIterator;
};

ProductDeltaIterator.prototype.close = function () {
    if (empty(this.deltaXmlReader)) { return false; }
    // Close XML Delta file
    this.deltaXmlReader.close();
    this.deltaFileReader.close();
    this.deltaXmlReader = null;
    this.deltaFileReader = null;
    this.dataBuffer = null;
    this.size = null;

    return true;
};

ProductDeltaIterator.prototype.next = function () {
    var result = null;

    if (empty(this.deltaXmlReader) || empty(this.dataBuffer)) { return result; }

    result = this.dataBuffer;
    var productDeltaXML = jobHelper.readXMLObjectFromStream(this.deltaXmlReader, 'product');
    var product = jobHelper.xmlToObject(productDeltaXML);
    this.dataBuffer = product ? product.product : null;

    return result;
};

ProductDeltaIterator.prototype.hasNext = function () {
    return !empty(this.dataBuffer);
};

ProductDeltaIterator.prototype.getSize = function () {
    return this.size;
};

ProductDeltaIterator.prototype.getRecordSize = function () {
    // calculate size of object in buffer
    var recordSize = 0;
    if (this.dataBuffer) {
        try {
            recordSize = JSON.stringify(this.dataBuffer).length;
        } catch (error) {
            recordSize = 0;
        }
    }

    return recordSize;
};

module.exports = ProductDeltaIterator;
