'use strict';

/**
 * Function convert array to XML object
 * @param {Array} arr - array
 * @returns {Object} - XML Object
 */
function arrayToXML(arr) {
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
function xmlToArray(xmlArray) {
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
 * Convert JS Object to XML Object and append to baseXML Object
 * @param {XML} baseXML - XML Object for update
 * @param {Object} obj - JS Object
 * @returns {XML} - combined XML Object
 */
function appendObjToXML(baseXML, obj) {
    var result = baseXML;
    if (obj instanceof Array) {
        result.append = arrayToXML(obj);
    } else {
        Object.keys(obj).forEach(function (property) {
            // eslint-disable-next-line no-restricted-globals
            var xmlPproperty = isNaN(property) ? property : 'number-' + property;
            if (obj[property] instanceof Array) {
                result[xmlPproperty] = '';
                result[xmlPproperty].appendChild(arrayToXML(obj[property]));
            } else if (obj[property] instanceof Object) {
                appendObjToXML(baseXML[xmlPproperty], obj[property]);
            } else {
                switch (typeof obj[property]) {
                    case 'number':
                        result[xmlPproperty] = new XML('<' + property + ' type="number">' + obj[property] + '</' + property + '>');
                        break;
                    case 'boolean':
                        result[xmlPproperty] = new XML('<' + property + ' type="boolean">' + obj[property] + '</' + property + '>');
                        break;
                    default:
                        result[xmlPproperty] = obj[property];
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
        return xmlToArray(xmlObj);
    }

    var result = {};

    for (var i = 0; i < lengthChildren; i += 1) {
        var xmlProperty = xmlObj[i].name().localName;
        var property = xmlProperty.indexOf('number-', 0) < 0 ? xmlProperty : xmlProperty.substring(7);
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
 * Check object for empty
 * @param {Object} obj - any Object
 * @returns {boolean} - is empty Object
 */
function isEmptyObject(obj) {
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
 * Function to create a clone object
 * @param {Object} obj - object to clone
 * @returns {Object} - clobe of Obj
 */
function cloneObject(obj) {
    // Handle the simple types, and null or undefined
    if (empty(obj) || !(obj instanceof Object)) {
        return obj;
    }

    var copy = null;
    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i += 1) {
            copy[i] = cloneObject(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        Object.keys(obj).forEach(function (key) {
            if (Object.hasOwnProperty.call(obj, key)) copy[key] = cloneObject(obj[key]);
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
function compareTopLevelProperties(compareObj, baseObj) {
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
            result[property] = cloneObject(baseObj[property]);
            return result;
        }

        if (baseObjString !== compareObjString) {
            result[property] = cloneObject(baseObj[property]);
        }
    }
    return result;
}

/**
 * Compares two objects and creates a new one with properties whose values differ.
 * Values of compareObj are written to the new object
 * @param {Object} compareObj - second Object
 * @param {Object} baseObj - first Object
 * @returns {Object} - object of differents
 */
function objectCompare(compareObj, baseObj) {
    var result = compareTopLevelProperties(compareObj, baseObj);
    return isEmptyObject(result) ? null : result;
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

module.exports = {
    appendObjToXML: appendObjToXML,
    xmlToObject: xmlToObject,
    objectCompare: objectCompare,
    hasSameProperties: hasSameProperties,
    readXMLObjectFromStream: readXMLObjectFromStream,
    logFileError: logFileError,
    logFileInfo: logFileInfo,
    checkAlgoliaFolder: checkAlgoliaFolder
};
