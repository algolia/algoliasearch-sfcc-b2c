"use strict";

/**
 * Convert JS Object to XML Object and apprnd to baseXML Object
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
        }
    }
};

/**
 * Convert XML Object to JS Object
 * @param {XML} xmlObj - XML Object
 * @returns {Object} - JS Object
 */
function xmlToObject(xmlObj) {
    var result = {};
    var lengthChildren = xmlObj.length();
    
    for (var i = 0; i < lengthChildren; i++) {
        var property = xmlObj[i].name().localName;
        if(xmlObj[i].hasSimpleContent()) {
            result[property] = xmlObj[i].toString();
        } else {
            // Convert to Array
            var child = xmlObj[i].elements();
            var childProperty = child[0].name().localName;
            var childAttribute =  child[0].attribute('id');
            if (childProperty == 'value' && childAttribute.length() > 0 ) {
                result[property] = [];
                var len = xmlObj[i][childProperty].length();
                for (var k = 0; k < len; k++) {
                    if(child[k].hasSimpleContent()) {
                        result[property].push(child[k].toString());
                    } else {
                        result[property].push(xmlToObject(child[k].elements()));
                    }
                }
            }
            else {
                result[property] = xmlToObject(xmlObj[i].elements());
            }
        }
    }
    return result;
}

/**
 * Compares two objects and creates a new one with properties whose values differ.
 * Values of vompareObj are written to the new object
 * @param {Object} baseObj - first Object 
 * @param {Object} compareObj - second Object
 * @returns {Object} - object of differents
 */
function objectCompare(baseObj, compareObj) {
    var result = null;
    for (var property in compareObj) {
        if (compareObj[property] instanceof Array) {
            // Compare Arrays            
            var arrBaseObj = compareObj[property];
            var arrCompareObj = baseObj[property];
            if ((arrBaseObj instanceof Array) && arrBaseObj.length === arrCompareObj.length) {
                for (var i = 0; i < arrCompareObj.length; i++) {
                    if(!empty(objectCompare({ value: arrBaseObj[i] }, { value: arrCompareObj[i] }))) {
                        if (!result) {result = {}};
                        result[property] = compareObj[property];
                        break;
                    }
                }
            } else {
                result[property] = compareObj[property];
            }
        } else if (compareObj[property] instanceof Object) {
            // Compare Objects
            var obj = objectCompare(baseObj[property], compareObj[property]);
            if (obj) {
                if (!result) {result = {}};
                result[property] = obj;
            }
        } else {
            // Compare primitives
            if(baseObj[property] !== compareObj[property]) {
                if (!result) {result = {}};
                result[property] = compareObj[property];
            }
        }
    }
    return result;
}

module.exports.appendObjToXML = appendObjToXML;
module.exports.xmlToObject = xmlToObject;
module.exports.objectCompare = objectCompare;
