'use strict';

var File = require('dw/io/File');
var FileReader = require('dw/io/FileReader');
var XMLStreamReader = require('dw/io/XMLStreamReader');
var XMLStreamConstants = require('dw/io/XMLStreamConstants');

var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');
var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');

var CategoryDeltaIterator = function () {
    this.deltaFile = null;
    this.deltaFileReader = null;
    this.deltaXmlReader = null;
    this.dataBuffer = null;
    this.size = null;
};

CategoryDeltaIterator.create = function () {
    var newCategoryDeltaIterator = new CategoryDeltaIterator();

    var fileName = algoliaConstants.UPDATE_CATEGORIES_FILE_NAME;
    newCategoryDeltaIterator.deltaFile = new File(fileName);

    // Scan file and calculate number of Cateogry Objects
    var deltaFileReader = new FileReader(newCategoryDeltaIterator.deltaFile, 'UTF-8');
    var xmlStreamReader = new XMLStreamReader(deltaFileReader);
    var counter = 0;
    while (xmlStreamReader.hasNext()) {
        if (xmlStreamReader.next() === XMLStreamConstants.START_ELEMENT) {
            var localElementName = xmlStreamReader.getLocalName();
            if (localElementName === 'category') { counter += 1; }
        }
    }
    xmlStreamReader.close();
    xmlStreamReader.close();

    // Re-open XML Delta file to read
    newCategoryDeltaIterator.size = counter;
    newCategoryDeltaIterator.deltaFileReader = new FileReader(newCategoryDeltaIterator.deltaFile, 'UTF-8');
    newCategoryDeltaIterator.deltaXmlReader = new XMLStreamReader(newCategoryDeltaIterator.deltaFileReader);

    // Read first object to buffer
    var categoryDeltaXML = jobHelper.readXMLObjectFromStream(newCategoryDeltaIterator.deltaXmlReader, 'category');
    var category = jobHelper.xmlToObject(categoryDeltaXML);
    newCategoryDeltaIterator.dataBuffer = category ? category.category : null;

    return newCategoryDeltaIterator;
};

CategoryDeltaIterator.prototype.close = function () {
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

CategoryDeltaIterator.prototype.next = function () {
    var result = null;

    if (empty(this.deltaXmlReader) || empty(this.dataBuffer)) { return result; }

    result = this.dataBuffer;
    var categoryDeltaXML = jobHelper.readXMLObjectFromStream(this.deltaXmlReader, 'category');
    var category = jobHelper.xmlToObject(categoryDeltaXML);
    this.dataBuffer = category ? category.category : null;

    return result;
};

CategoryDeltaIterator.prototype.hasNext = function () {
    return !empty(this.dataBuffer);
};

CategoryDeltaIterator.prototype.getSize = function () {
    return this.size;
};

CategoryDeltaIterator.prototype.getRecordSize = function () {
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

module.exports = CategoryDeltaIterator;
