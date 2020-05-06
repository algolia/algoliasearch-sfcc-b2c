'use strict';

/**
 * Convert JS Object to XML Object and append to baseXML Object
 * @param {XML} baseXML - XML Object for update
 * @param {Object} obj - JS Object
 */
function appendObjToXML(baseXML, obj) {
    for (var property in obj) {
        if (obj[property] instanceof Array) {
            var arr = obj[property];
            baseXML[property] = '';
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] instanceof Object) {
                    var childXML = <value id={i}></value>;
                    appendObjToXML(childXML, arr[i]);
                } else {
                    var childXML = <value id={i}>{arr[i]}</value>;
                }
                baseXML[property].appendChild(childXML);
            }
        } else if (obj[property] instanceof Object) {
            appendObjToXML(baseXML[property], obj[property]);
        } else {
            baseXML[property] = obj[property];
            // Store value type to XML attribute
            if (typeof obj[property] === 'number') { baseXML[property].@type = 'number'; }
            if (typeof obj[property] === 'boolean') { baseXML[property].@type = 'boolean'; }
        }
    }
}

/**
 * Convert XML Object to JS Object
 * @param {XML} xmlObj - XML Object
 * @returns {Object} - JS Object
 */
function xmlToObject(xmlObj) {
    if (empty(xmlObj)) { return null; }
    var result = {};
    var lengthChildren = xmlObj.length();

    for (var i = 0; i < lengthChildren; i += 1) {
        var property = xmlObj[i].name().localName;
        if (xmlObj[i].hasSimpleContent()) {
            result[property] = xmlObj[i].toString();
            if (result[property].toLowerCase() === 'null') {
                result[property] = null;
            } else {
                // Restore value type from XML attribute
                var attribute = xmlObj[i].@type.toString();
                if (attribute === 'number') { result[property] = parseFloat(result[property]); }
                if (attribute === 'boolean') { result[property] = result[property].toLowerCase() === 'true'; }
            }
        } else {
            // Convert to Array
            var child = xmlObj[i].elements();
            var childProperty = child[0].name().localName;
            var childAttribute = child[0].attribute('id');
            if (childProperty === 'value' && childAttribute.length() > 0) {
                result[property] = [];
                var len = xmlObj[i][childProperty].length();
                for (var k = 0; k < len; k += 1) {
                    if (child[k].hasSimpleContent()) {
                        result[property].push(child[k].toString());
                    } else {
                        result[property].push(xmlToObject(child[k].elements()));
                    }
                }
            } else {
                result[property] = xmlToObject(xmlObj[i].elements());
            }
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
        for(var prop in obj) {
            if(obj.hasOwnProperty(prop))
                return false;
        }
        return true;
    } else {
        return empty(obj);
    }
}

/**
 * Function returns true if the baseObj Object contains properties of the compareObj Object
 * @param {Object} compareObj - second Object
 * @param {Object} baseObj - first Object
 * @returns {boolean} - success
 */
function hasSameProperties(compareObj, baseObj) {
    for (var property in compareObj) {
        if ( ! baseObj.hasOwnProperty(property)) {
            return false;
        }
    }
    return true;
}

/**
 * Function creates a new object that contains the properties
 * of the compareObj that are not in the baseObj
 * If objects are equals, returns empty Object
 * @param {Object} baseObj - first Object
 * @param {Object} compareObj - second Object
 * @returns {Object} - object of differents
 */
function subtractObject(baseObj, compareObj) {
    var result = {};

    // if both x and y are null or undefined and exactly the same
    if (baseObj === compareObj) return result;

    // if they are not strictly equal, they both need to be Objects
    if (!(baseObj instanceof Object) && (compareObj instanceof Object)) {
        return compareObj;
    }

    for (var property in compareObj) {
        // if base Object don't have property add to result one.
        if (compareObj[property] instanceof Array) {
            // Compare Arrays            
            var arrBaseObj = baseObj[property];
            var arrCompareObj = compareObj[property];
            if ((arrBaseObj instanceof Array) && arrBaseObj.length === arrCompareObj.length) {
                for (var i = 0; i < arrCompareObj.length; i++) {
                    if (!isEmptyObject(subtractObject({ value: arrBaseObj[i] }, { value: arrCompareObj[i] }))) {
                        result[property] = arrCompareObj.slice();
                        break;
                    }
                }
            } else {
                result[property] = arrCompareObj.slice();
            }
        } else if (compareObj[property] instanceof Object) {
            // Compare Objects
            var obj = subtractObject(baseObj[property], compareObj[property]);
            if (!isEmptyObject(obj)) {
                result[property] = obj;
            }
        } else {
            // Compare primitives
            if (baseObj[property] !== compareObj[property]) {
                result[property] = compareObj[property];
            }
        }
    }
    return result;
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
    
    // Handle Array
    if (obj instanceof Array) {
        var copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = cloneObject(obj[i]);
        }
        return copy;
    }
    
    // Handle Object
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = cloneObject(obj[attr]);
        }
        return copy;
    }
    
    return null;
}

/**
 * Function creates a new object that contains the top level properties of the compareObj
 * that are not in the baseObj. If objects are equals, returns empty Object
 * @param {Object} baseObj - first Object
 * @param {Object} compareObj - second Object
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

    for (var property in baseObj) {
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
    //var result = subtractObject(compareObj, baseObj);
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
    logger.info('\nFile: {0},\nMassage: {1}',
        file,
        infoMessage);

    return null;
}

module.exports = {
    appendObjToXML: appendObjToXML,
    xmlToObject: xmlToObject,
    objectCompare: objectCompare,
    hasSameProperties: hasSameProperties,
    readXMLObjectFromStream: readXMLObjectFromStream,
    logFileError: logFileError,
    logFileInfo: logFileInfo
};
