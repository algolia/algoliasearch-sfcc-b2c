'use strict';

/**
 * Function convert array to XML object
 * @param {Array} arr - array
 * @returns {Object} - XML Object
 */
function _arrayToXML(arr) {
    var result = new XML('<array></array>');

    arr.forEach(function (element, index) {
        var childXML = null;
        if (element instanceof Object) {
            childXML = new XML('<value id="' + index + '"></value>');
            // eslint-disable-next-line no-use-before-define
            appendObjToXML(childXML, element);
        } else {
            childXML = new XML('<value id="' + index + '">' + element + '</value>');
        }
        result.appendChild(childXML);
    });

    return result;
}

/**
 * Convert XML array object to JS array
 * @param {XML} xmlArray - XML Object
 * @returns {Array} - array
 */
function _xmlToArray(xmlArray) {
    var child = xmlArray.elements();
    var result = [];
    var len = child.length();
    for (var i = 0; i < len; i += 1) {
        if (child[i].hasSimpleContent()) {
            result.push(child[i].toString());
        } else {
            // eslint-disable-next-line no-use-before-define
            result.push(xmlToObject(child[i].elements()));
        }
    }
    return result;
}

/**
 * Check object for empty
 * @param {Object} obj - any Object
 * @returns {boolean} - is empty Object
 */
function _isEmptyObject(obj) {
    if (obj instanceof Object) {
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i += 1) {
            if (Object.hasOwnProperty.call(obj, keys[i])) return false;
        }
        return true;
    }
    return empty(obj);
}

/**
 * Function to create a clone object
 * @param {Object} obj - object to clone
 * @returns {Object} - clobe of Obj
 */
function _cloneObject(obj) {
    // Handle the simple types, and null or undefined
    if (empty(obj) || !(obj instanceof Object)) {
        return obj;
    }

    var copy = null;
    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i += 1) {
            copy[i] = _cloneObject(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        Object.keys(obj).forEach(function (key) {
            if (Object.hasOwnProperty.call(obj, key)) copy[key] = _cloneObject(obj[key]);
        });
        return copy;
    }

    return null;
}

/**
 * Function creates a new object that contains the top level properties of the compareObj
 * that are not in the baseObj. If objects are equals, returns empty Object
 * @param {Object} compareObj - compared Щbject
 * @param {Object} baseObj - base Object
  * @returns {Object} - object of differents
 */
function _compareTopLevelProperties(compareObj, baseObj) {
    var result = {};

    // if both x and y are null or undefined and exactly the same
    if (baseObj === compareObj) return result;

    // if they are not strictly equal, they both need to be Objects
    if (!(baseObj instanceof Object) && (compareObj instanceof Object)) {
        return compareObj;
    }

    var keys = Object.keys(baseObj);
    for (var i = 0; i < keys.length; i += 1) {
        var property = keys[i];
        var baseObjString = null;
        var compareObjString = null;

        try {
            baseObjString = JSON.stringify({ obj: baseObj[property] });
            compareObjString = JSON.stringify({ obj: compareObj[property] });
        } catch (error) {
            result[property] = _cloneObject(baseObj[property]);
            return result;
        }

        if (baseObjString !== compareObjString) {
            result[property] = _cloneObject(baseObj[property]);
        }
    }
    return result;
}

// ----------------------------- helpers used by productsIndexJob.js & categoryIndexJob.js -----------------------------

/**
 * Convert JS Object to XML Object and append to baseXML Object
 * @param {XML} baseXML - XML Object for update
 * @param {Object} obj - JS Object
 * @returns {XML} - combined XML Object
 */
function appendObjToXML(baseXML, obj) {
    var result = baseXML;
    if (obj instanceof Array) {
        result.append = _arrayToXML(obj);
    } else {
        Object.keys(obj).forEach(function (property) {
            if (obj[property] instanceof Array) {
                result[property] = '';
                result[property].appendChild(_arrayToXML(obj[property]));
            } else if (obj[property] instanceof Object) {
                appendObjToXML(baseXML[property], obj[property]);
            } else {
                switch (typeof obj[property]) {
                    case 'number':
                        result[property] = new XML('<' + property + ' type="number">' + obj[property] + '</' + property + '>');
                        break;
                    case 'boolean':
                        result[property] = new XML('<' + property + ' type="boolean">' + obj[property] + '</' + property + '>');
                        break;
                    default:
                        result[property] = obj[property];
                        break;
                }
            }
        });
    }
    return result;
}

/**
 * Convert XML Object to JS Object
 * @param {XML} xmlObj - XML Object
 * @returns {Object} - JS Object
 */
function xmlToObject(xmlObj) {
    if (empty(xmlObj)) { return null; }

    var lengthChildren = xmlObj.length();

    // Convert XML Array to JS Array
    if (lengthChildren === 1 && xmlObj.name().localName === 'array') {
        return _xmlToArray(xmlObj);
    }

    var result = {};

    for (var i = 0; i < lengthChildren; i += 1) {
        var property = xmlObj[i].name().localName;
        if (xmlObj[i].hasSimpleContent()) {
            result[property] = xmlObj[i].toString();
            if (result[property].toLowerCase() === 'null') {
                result[property] = null;
            } else {
                // Restore value type from XML attribute
                var attribute = xmlObj[i].attribute('type').toString();
                if (attribute === 'number') { result[property] = parseFloat(result[property]); }
                if (attribute === 'boolean') { result[property] = result[property].toLowerCase() === 'true'; }
            }
        } else {
            result[property] = xmlToObject(xmlObj[i].elements());
        }
    }
    return result;
}

/**
 * Function returns true if the baseObj Object contains properties of the compareObj Object
 * @param {Object} compareObj - second Object
 * @param {Object} baseObj - first Object
 * @returns {boolean} - success
 */
function hasSameProperties(compareObj, baseObj) {
    var keys = Object.keys(compareObj);
    for (var i = 0; i < keys.length; i += 1) {
        if (!Object.hasOwnProperty.call(baseObj, keys[i])) return false;
    }
    return true;
}


/**
 * Compares two objects and creates a new one with properties whose values differ.
 * Values of compareObj are written to the new object
 * @param {Object} compareObj - second Object
 * @param {Object} baseObj - first Object
 * @returns {Object} - object of differents
 */
function objectCompare(compareObj, baseObj) {
    var result = _compareTopLevelProperties(compareObj, baseObj);
    return _isEmptyObject(result) ? null : result;
}

/**
 * Read XML object from StreamReader
 * @param {dw.io.XMLStreamReader} xmlStreamReader - XML Stream Reader
 * @param {string} modeName - name of node XML object
 * @returns {Object|null} - XML Object or null
 */
function readXMLObjectFromStream(xmlStreamReader, modeName) {
    var XMLStreamConstants = require('dw/io/XMLStreamConstants');
    var result = null;
    while (xmlStreamReader.hasNext()) {
        if (xmlStreamReader.next() === XMLStreamConstants.START_ELEMENT) {
            var localElementName = xmlStreamReader.getLocalName();
            if (localElementName === modeName) {
                result = xmlStreamReader.readXMLObject();
                break;
            }
        }
    }
    return result;
}

/**
 * Parse error message and write it to log
 * @param {string}  errorMessage - Error message
 * @returns {null} - Null
 */
function logError(errorMessage, error) {
    var logger = require('dw/system/Logger').getLogger('algolia');
    logger.error('\nError: {0}',
        errorMessage,
    );

    return null;
}


/**
 * Parse error message and write it to log
 * @param {string}  file  - File name where the IOError
 * @param {string}  errorMessage - Error message
 * @param {Error}   error - IOError
 * @returns {null} - Null
 */
function logFileError(file, errorMessage, error) {
    var logger = require('dw/system/Logger').getLogger('algolia');
    logger.error('\nFile: {0},\nError: {1},\nError: {2},',
        file,
        errorMessage,
        error.message);

    return null;
}

/**
 * Parse error message and write it to log
 * @param {string}  file  - File name where the IOError
 * @param {string}  infoMessage - Info message
 * @returns {null} - Null
 */
function logFileInfo(file, infoMessage) {
    var logger = require('dw/system/Logger').getLogger('algolia');
    logger.info('\nFile: {0},\nMessage: {1}',
        file,
        infoMessage);

    return null;
}

/**
 * Function checks for the exists of the Algolia folder and creates it if the folder is not exists
 * @returns {boolean} - success
 */
function checkAlgoliaFolder() {
    var File = require('dw/io/File');
    var algoliaFolderName = require('*/cartridge/scripts/algolia/lib/algoliaConstants').ALGOLIA_FILES_FOLDER;
    var result = false;
    try {
        var algoliaFolder = new File(algoliaFolderName);
        result = algoliaFolder.exists() ? true : algoliaFolder.mkdirs();
    } catch (error) {
        logFileError(algoliaFolderName, 'Error create directory path', error);
        result = false;
    }
    return result;
}

/**
 * UpdateProductModel class that represents an Algolia ProductModel
 * for update product properties
 * @param {Object} algoliaProduct - Algolia Product Model
 * @constructor
 */
function UpdateProductModel(algoliaProduct) {
    this.topic = 'products/index';
    this.resource_type = 'product';
    this.resource_id = algoliaProduct.id;
    this.options = {
        data: {}
    };

    var keys = Object.keys(algoliaProduct);
    for (var i = 0; i < keys.length; i += 1) {
        if (keys[i] !== 'id') {
            this.options.data[keys[i]] = algoliaProduct[keys[i]];
        }
    }
}

/**
 * Write Object to XMlStreamWriter
 * @param {dw.io.XMLStreamWriter} xmlStreamWriter - XML Stream Writer
 * @param {Object} obj - name of node XML object
 * @returns {null} - XML Object or null
 */
function writeObjectToXMLStream(xmlStreamWriter, obj) {
    var productModelXML = new XML('<product></product>');
    appendObjToXML(productModelXML, obj);

    xmlStreamWriter.writeCharacters('\n');
    xmlStreamWriter.writeRaw(productModelXML.toXMLString());
    xmlStreamWriter.writeCharacters('\n');
    return null;
}

/**
 * The function returns the filtered next product from SeekableIterator
 * and converted to the Algolia Product Model
 * @param {dw.util.SeekableIterator} productsIterator - Product SeekableIterator
 * @returns {Object} -  Algolia Product Model
 */
function getNextProductModel(productsIterator) {
    var productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');
    var AlgoliaProduct = require('*/cartridge/scripts/algolia/model/algoliaProduct');
    var algoliaProductModel = null;
    while (productsIterator.hasNext()) {
        var product = productsIterator.next();
        if (productFilter.isInclude(product)) {
            algoliaProductModel = new AlgoliaProduct(product);
            break;
        }
    }
    return algoliaProductModel;
}

// ----------------------------- helpers used by sendDeltaExportProducts.js -----------------------------

/**
 * Retrieves the first child folder within the specified parent folder path.
 *
 * @param {dw.io.File} folder - The path to the parent folder.
 * @returns {dw.io.File|null} The first child folder as a `dw.io.File` instance, or `null` if no child folders are found.
 */
function getFirstChildFolder(folder) {
    if (!empty(folder) && folder.isDirectory()) {
        var files = folder.listFiles();
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (file.isDirectory()) {
                return file;
            }
        }
    }

    return null;
}

/**
 * Retrieves the list of delta export zips from the specified folder.
 *
 * @param {dw.io.File} folder - The folder containing the zip files.
 * @returns {string[]} An array of zip file names which match the pattern.
 */
function getDeltaExportZipList(folder) {

    // return all file names in export folder as an array of strings
    var exportDirFiles = folder.list(); // returns an array of strings with the files or null if not a folder

    // if delta export folder is empty or doesn't exist, don't continue
    if (empty(exportDirFiles) || !folder.isDirectory()) {
        return [];
    } else {
        // filter and sort file names - results returned by list() are unsorted
        return exportDirFiles.filter(function(file) {
            return !!file.match(/^\d{6}\.zip$/); // file name must be a six-character sequential number with a .zip extension
        }).sort();
    }
}

/**
 * Retrieves the child folders of a given folder.
 *
 * @param {dw.io.File} folder - The folder to be searched
 * @returns {dw.io.File[]} An array of subfolders
 */
function getChildFolders(folder) {
    if (empty(folder) || !folder.isDirectory()) {
        return [];
    } else {
        return folder.listFiles(function(file) {
            return file.isDirectory();
        }).toArray().sort();
    }
}

/**
 * Takes each XML file in sequential order and retrieves the changed products' IDs from it.
 * Adds it to the changedProducts object that is built in memory, which looks like this:
 * changedProducts: {
 *     'productID1': true,
 *     'productID2': false,
 *     'productID3': false,
 *     [...]
 * }
 * If there are multiple delta export files and a certain product had multiple changes applied to it,
 * the newer event will overwrite the older one (e.g. if a product was modified and then deleted or
 * if a product was deleted and then re-added in another XML).
 * The Boolean value of the productID keys indicates whether the product was added/changed (true)
 * or removed with <product mode="delete" product-id=""/> (false).
 * These products will then be retrieved from the database, enriched and then sent to Algolia (or marked for deletion).
 *
 * @param {dw.io.File} xmlFile - The path to the XML file.
 * @param {Object} changedProducts - an object containing the changed products
 * @returns {Object} An object with product IDs as keys and their availability status as values.
 */
function buildChangedProductsObjectFromXML(xmlFile, changedProducts) {
    var XMLStreamReader = require('dw/io/XMLStreamReader');
    var XMLStreamConstants = require('dw/io/XMLStreamConstants');
    var FileReader = require('dw/io/FileReader');
    var catalogID;

    if (xmlFile.exists()) {
        var fileReader = new FileReader(xmlFile);
        var xmlStreamReader = new XMLStreamReader(fileReader);
        var success = false;

        while (xmlStreamReader.hasNext()) {
            var xmlEvent = xmlStreamReader.next();

            if (xmlEvent === XMLStreamConstants.START_ELEMENT) {
                if (xmlStreamReader.getLocalName() === 'catalog') { // <catalog> start element
                    catalogID = xmlStreamReader.getAttributeValue(null, 'catalog-id');
                }
                if (xmlStreamReader.getLocalName() === 'product') { // <product> start element
                    var productID = xmlStreamReader.getAttributeValue(null, 'product-id'); // <product product-id="">
                    var mode = xmlStreamReader.getAttributeValue(null, 'mode'); // <product mode="delete">
                    var isAvailable = mode !== 'delete';
                    changedProducts[productID] = isAvailable;
                }
            }

            if (xmlEvent === XMLStreamConstants.END_ELEMENT && xmlStreamReader.getLocalName() === 'catalog') { // </catalog>
                success = true;
            }
        }
        xmlStreamReader.close();
    };

    return success;
}

module.exports = {
    // productsIndexJob & categoryIndexJob
    appendObjToXML: appendObjToXML,
    xmlToObject: xmlToObject,
    objectCompare: objectCompare,
    hasSameProperties: hasSameProperties,
    readXMLObjectFromStream: readXMLObjectFromStream,
    logError: logError,
    logFileError: logFileError,
    logFileInfo: logFileInfo,
    checkAlgoliaFolder: checkAlgoliaFolder,

    UpdateProductModel: UpdateProductModel,
    writeObjectToXMLStream: writeObjectToXMLStream,
    getNextProductModel: getNextProductModel,

    // sendDeltaExportProducts
    getFirstChildFolder: getFirstChildFolder,
    getDeltaExportZipList: getDeltaExportZipList,
    getChildFolders: getChildFolders,
    buildChangedProductsObjectFromXML: buildChangedProductsObjectFromXML,
};
