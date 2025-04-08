'use strict';

var algoliaLogger = require('dw/system/Logger').getLogger('algolia');

/**
 * Function to convert array to XML object
 * @param {Array} arr Array
 * @returns {Object} XML Object
 */
function _arrayToXML(arr) {
    var result = new XML('<array></array>');

    arr.forEach(function (element, index) {
        var childXML = null;
        if (element instanceof Object) {
            childXML = new XML('<value id="' + index + '"></value>');
            appendObjToXML(childXML, element);
        } else {
            childXML = new XML('<value id="' + index + '">' + element + '</value>');
        }
        result.appendChild(childXML);
    });

    return result;
}

/**
 * Convert XML array object into JS array
 * @param {XML} xmlArray XML Object
 * @returns {Array} Array
 */
function _xmlToArray(xmlArray) {
    var child = xmlArray.elements();
    var result = [];
    var len = child.length();
    for (var i = 0; i < len; i += 1) {
        if (child[i].hasSimpleContent()) {
            result.push(child[i].toString());
        } else {
            result.push(xmlToObject(child[i].elements()));
        }
    }
    return result;
}

/**
 * Check if object is empty
 * @param {Object} obj Object
 * @returns {boolean} Whether object is empty
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
 * Function to clone an object
 * @param {Object} obj Object to clone
 * @returns {Object} Clone of object
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
 * @param {Object} compareObj Object to compare
 * @param {Object} baseObj Base object
 * @returns {Object} Object of differences
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
        } catch (error) { // eslint-disable-line no-unused-vars
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
 * Convert JS object to XML object and append to baseXML object
 * @param {XML} baseXML XML object to update
 * @param {Object} obj JS object
 * @returns {XML} Combined XML Object
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
 * @param {XML} xmlObj XML Object
 * @returns {Object} JS Object
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
 * @param {Object} compareObj Object to compare
 * @param {Object} baseObj Base object
 * @returns {boolean} Success
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
 * @param {Object} compareObj Second Object
 * @param {Object} baseObj First Object
 * @returns {Object} Object of differences
 */
function objectCompare(compareObj, baseObj) {
    var result = _compareTopLevelProperties(compareObj, baseObj);
    return _isEmptyObject(result) ? null : result;
}

/**
 * Read XML object from StreamReader
 * @param {dw.io.XMLStreamReader} xmlStreamReader XML Stream Reader
 * @param {string} modeName Name of node XML object
 * @returns {Object|null} XML Object or null
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
 * Return a logger object set for the 'algolia' category
 * @return {dw.system.Logger} The logger object
 */
function getAlgoliaLogger() {
    return algoliaLogger;
}

/**
 * Parse error message and write it to log
 * @param {string} errorMessage Error message
 */
function logError(errorMessage) {
    algoliaLogger.error('\nError: {0}', errorMessage);
}

/**
 * Parse error message and write it to log
 * @param {string} file File name where the IOError occurred
 * @param {string} errorMessage Error message
 * @param {Error} error IOError
 */
function logFileError(file, errorMessage, error) {
    algoliaLogger.error('\nFile: {0},\nError: {1},\nError: {2},',
        file,
        errorMessage,
        error.message
    );
}

/**
 * Write info to log
 * @param {string} message Info message
 */
function logInfo(message) {
    algoliaLogger.info('Message: {0}', message);
}

/**
 * Write info to log
 * @param {string} file File name where the IOError
 * @param {string} infoMessage Info message
 */
function logFileInfo(file, infoMessage) {
    algoliaLogger.info('\nFile: {0},\nMessage: {1}', file, infoMessage);
}

/**
 * Checks if the Algolia folder exists and creates it if not
 * @returns {boolean} Success Boolean
 */
function checkAlgoliaFolder() {
    var File = require('dw/io/File');
    var algoliaFolderName = require('*/cartridge/scripts/algolia/lib/algoliaConstants').ALGOLIA_FILES_FOLDER;
    var result = false;
    try {
        var algoliaFolder = new File(algoliaFolderName);
        result = algoliaFolder.exists() ? true : algoliaFolder.mkdirs();
    } catch (error) {
        logFileError(algoliaFolderName, 'Error creating directory path', error);
        result = false;
    }
    return result;
}

/**
 * UpdateProductModel class that represents an Algolia ProductModel
 * for update product properties
 * @param {Object} algoliaProduct Algolia Product Model
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
    for (var i = 0; i < keys.length; ++i) {
        if (keys[i] !== 'id') {
            this.options.data[keys[i]] = algoliaProduct[keys[i]];
        }
    }
}

/**
 * Operation class that represents an Algolia batch operation: https://www.algolia.com/doc/rest-api/search/#batch-write-operations
 * @param {string} action - Operation to perform: addObject, partialUpdateObject, deleteObject, ...
 * @param {Object} algoliaObject - Algolia object to index
 * @param {string} indexName - The index to target
 * @constructor
 */
function AlgoliaOperation(action, algoliaObject, indexName) {
    this.action = action;
    if (indexName) {
        this.indexName = indexName;
    }
    this.body = {};

    var keys = Object.keys(algoliaObject);
    for (var i = 0; i < keys.length; ++i) {
        this.body[keys[i]] = algoliaObject[keys[i]];
    }
}

/**
 * Constructs a model for products that are to be deleted from the Algolia index
 * @param {string} productID productID
 * @returns {Object} The object to be sent to Algolia
 * @constructor
 */
function DeleteProductModel(productID) {
    return {
        topic: 'products/delete',
        resource_type: 'product',
        resource_id: productID
    }
}

/**
 * Write Object to XMlStreamWriter
 * @param {dw.io.XMLStreamWriter} xmlStreamWriter XML Stream Writer
 * @param {Object} obj Name of node XML object
 * @returns {null} XML Object or null
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
 * @param {dw.util.SeekableIterator} productsIterator Product SeekableIterator
 * @returns {Object} Algolia Product Model
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

// ----------------------------- helpers used by algoliaProductDeltaIndex.js -----------------------------

/**
 * Updates or adds a key-value pair to the last object in the array that has less than 2000 properties.
 * If the key already exists in any object, it updates the value for that key.
 * If the key doesn't exist, it adds the key-value pair to the last object or
 * if the last object is full, creates a new object and adds the key-value pair to it.
 * @param {Array} objectsArray The array of objects to update or add key-value pairs to.
 * @param {string} key The key to check or add.
 * @param {*} value The value to update or add.
 */
function _updateOrAddValue(objectsArray, key, value) {
    const jsObjectSizeQuota = 2000;

    // if there are no objects in the array or if the last object is full, add a new empty object to the array
    if (objectsArray.length === 0 || Object.keys(objectsArray[objectsArray.length - 1]).length === jsObjectSizeQuota) {
        objectsArray.push({});
    }

    // if key already exists, update it with the new value...
    for (var i = 0; i < objectsArray.length; i++) {
        var object = objectsArray[i];

        // eslint-disable-next-line no-prototype-builtins
        if (object.hasOwnProperty(key)) {
            object[key] = value;
            return; // exit the function after updating the value
        }
    }

    // ...otherwise add the key-value pair to the last object
    var lastObject = objectsArray[objectsArray.length - 1];
    lastObject[key] = value;
}

/**
 * Returns whether the supplied array of objects is empty.
 * It is considered empty if it contains no objects that contain any key-value pairs,
 * so if it's either an empty array or an array with one empty object element.
 * @param {Array} objectsArray The array of objects to check, array is filled up sequentially and densely
 * @returns {boolean} Whether the structure is empty
 */
function isObjectsArrayEmpty(objectsArray) {
    if (empty(objectsArray)) {
        return true;
    }

    // array has at least one element
    var lastObject = objectsArray[objectsArray.length - 1];
    if (empty(lastObject)) {
        return true;
    }

    return false;
}

/**
 * Returns the total number of properties in an array of objects
 * @param {Array} objectsArray The array of objects to check
 * @returns {number} The number of properties in an array of objects
 */
function getObjectsArrayLength(objectsArray) {
    let length = 0;
    if (empty(objectsArray) || !Array.isArray(objectsArray)) {
        return length;
    }

    for (let i = 0; i < objectsArray.length; i++) {
        length += Object.keys(objectsArray[i]).length;
    }

    return length;
}

/**
 * Retrieves the IDs of the products which have changed since the last update
 * (an attribute of the product's, its inventory levels or its price)
 * from the supplied XML and adds them to the changedProducts structure.
 * @param {dw.io.File} xmlFile The path to the XML file.
 * @param {Array} changedProducts An array of objects containing the changed products
 * @param {string} resourceType Type of export file: "catalog" | "inventory" | "pricebook"
 * @returns {Object} The result object containing `success` (boolean) and `nrProductsRead` (number)
 */
function updateCPObjectFromXML(xmlFile, changedProducts, resourceType) {
    var XMLStreamReader = require('dw/io/XMLStreamReader');
    var XMLStreamConstants = require('dw/io/XMLStreamConstants');
    var FileReader = require('dw/io/FileReader');
    var resultObj = {
        nrProductsRead: 0,
        success: false,
        errorMessage: ''
    };

    try {
        if (xmlFile.exists()) {
            var fileReader = new FileReader(xmlFile);
            var xmlStreamReader = new XMLStreamReader(fileReader);

            switch (resourceType) {
                case 'catalog':
                    while (xmlStreamReader.hasNext()) {
                        let xmlEvent = xmlStreamReader.next();

                        if (xmlEvent === XMLStreamConstants.START_ELEMENT) {
                            if (xmlStreamReader.getLocalName() === 'product') { // <product> start element
                                let productID = xmlStreamReader.getAttributeValue(null, 'product-id'); // <product product-id="">
                                var mode = xmlStreamReader.getAttributeValue(null, 'mode'); // <product mode="delete">
                                var isAvailable = mode !== 'delete';

                                // adding new productID to structure or updating it if key already exists
                                _updateOrAddValue(changedProducts, productID, isAvailable);

                                resultObj.nrProductsRead++;
                            }
                        }

                        if (xmlEvent === XMLStreamConstants.END_ELEMENT && xmlStreamReader.getLocalName() === 'catalog') { // </catalog>
                            resultObj.success = true;
                        }
                    }
                    break;
                case 'inventory':
                    while (xmlStreamReader.hasNext()) {
                        let xmlEvent = xmlStreamReader.next();

                        if (xmlEvent === XMLStreamConstants.START_ELEMENT) {

                            if (xmlStreamReader.getLocalName() === 'record') { // <record> start element
                                let productID = xmlStreamReader.getAttributeValue(null, 'product-id'); // <record product-id="">

                                // adding new productID to structure or updating it if key already exists, always true
                                _updateOrAddValue(changedProducts, productID, true);

                                resultObj.nrProductsRead++;
                            }
                        }

                        if (xmlEvent === XMLStreamConstants.END_ELEMENT && xmlStreamReader.getLocalName() === 'inventory') { // </inventory>
                            resultObj.success = true;
                        }
                    }
                    break;
                case 'pricebook':
                    while (xmlStreamReader.hasNext()) {
                        var xmlEvent = xmlStreamReader.next();

                        if (xmlEvent === XMLStreamConstants.START_ELEMENT) {
                            if (xmlStreamReader.getLocalName() === 'price-table') { // <price-table> start element
                                var productID = xmlStreamReader.getAttributeValue(null, 'product-id'); // <price-table product-id="">

                                // adding new productID to structure or updating it if key already exists, always true
                                _updateOrAddValue(changedProducts, productID, true);

                                resultObj.nrProductsRead++;
                            }
                        }

                        if (xmlEvent === XMLStreamConstants.END_ELEMENT && xmlStreamReader.getLocalName() === 'pricebooks') { // </pricebooks>
                            resultObj.success = true;
                        }
                    }
                    break;
            }

            xmlStreamReader.close();
        }
    } catch (error) {
        algoliaLogger.error('Error while reading from file: ' + xmlFile.getFullPath());
        algoliaLogger.error(error);
        resultObj.success = false;
        resultObj.errorMessage =
            'Error while reading from file: ' + xmlFile.getFullPath() + '\n' +
            error.message + '\n' +
            'If your product attributes have special characters such as emojis, you must enable "Filter Invalid XML Characters during Export" in Administration >  Global Preferences >  Import & Export';
        return resultObj;
    }

    return resultObj;
}

/**
 * For a given master, generate all variant records with their 'colorVariations'
 * The colorVariations are built using the master's variation model
 *
 * @param {Object} parameters - model parameters
 * @param {dw.catalog.Product} parameters.masterProduct - A master product
 * @param {string} parameters.locales - The requested locales
 * @param {Array} parameters.attributeList - list of attributes to be fetched
 * @param {Array} parameters.nonLocalizedAttributes - list of non-localized attributes
 * @param {Array} parameters.attributesComputedFromBaseProduct - list of attributes computed from the masterProduct and shared in all variants
 * @param {Array} parameters.fullRecordUpdate - specify if the generated records are mean to replace entirely the existing ones
 * @returns {Object} An object containing, for each locale, an array of AlgoliaLocalizedProduct
 */
function generateVariantRecords(parameters) {
    const AlgoliaLocalizedProduct = require('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
    const productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');

    const attributesComputedFromBaseProduct = parameters.attributesComputedFromBaseProduct || [];
    const variants = parameters.masterProduct.getVariants();

    // Fetch shared attributes such as 'colorVariations' only once (for each locale), to set them later in each variant
    const sharedAttributesPerLocale = {};
    const algoliaRecordsPerLocale = {};
    for (let l = 0; l < parameters.locales.size(); ++l) {
        let locale = parameters.locales[l];
        sharedAttributesPerLocale[locale] = new AlgoliaLocalizedProduct({
            product: parameters.masterProduct,
            locale: locale,
            attributeList: attributesComputedFromBaseProduct,
        });
        algoliaRecordsPerLocale[locale] = [];
    }

    for (let v = 0; v < variants.size(); ++v) {
        var variant = variants[v];
        if (!productFilter.isInclude(variant)) {
            continue;
        }
        var baseModel = new AlgoliaLocalizedProduct({
            product: variant,
            locale: 'default',
            attributeList: parameters.nonLocalizedAttributes,
            fullRecordUpdate: parameters.fullRecordUpdate
        });
        for (let l = 0; l < parameters.locales.size(); ++l) {
            let locale = parameters.locales[l];
            // Add shared attributes in the base model
            attributesComputedFromBaseProduct.forEach(function(sharedAttribute) {
                baseModel[sharedAttribute] = sharedAttributesPerLocale[locale][sharedAttribute];
            });
            let localizedVariant = new AlgoliaLocalizedProduct({
                product: variant,
                locale: locale,
                attributeList: parameters.attributeList,
                baseModel: baseModel,
                fullRecordUpdate: parameters.fullRecordUpdate,
            });
            algoliaRecordsPerLocale[locale].push(localizedVariant);
        }
    }
    return algoliaRecordsPerLocale;
}


/**
 * Returns the default configuration for a given attribute.
 * You can override this behavior by adding a specific configuration for the attribute.
 * @param {string} attributeName - The name of the attribute to get the default configuration for.
 * @returns {Object} The default configuration object for the attribute.
 * @returns {string} return.attributeName - The name of the attribute.
 * @returns {boolean} return.localized - Indicates if the attribute is localized.
 * @returns {boolean} return.variantAttribute - Indicates if the attribute is a variant attribute.
 */
function getDefaultAttributeConfig(attributeName) {
    return {
        attribute: attributeName,
        localized: false,
        variantAttribute: true
    };
}

/**
 * Retrieves variant and master attribute configurations for a product.
 *
 * @returns {Object} An object with variant/master attribute arrays and base-product-computed attributes.
 */
function getAttributes() {
    let extendedProductAttributesConfig;
    let nonLocalizedAttributes = [];
    let nonLocalizedMasterAttributes = [];
    let attributesComputedFromBaseProduct = [];
    let algoliaProductConfig = require('*/cartridge/scripts/algolia/lib/algoliaProductConfig');
    let algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

    try {
        extendedProductAttributesConfig = require('*/cartridge/configuration/productAttributesConfig.js');
        algoliaLogger.info('Configuration file "productAttributesConfig.js" loaded');
    } catch (e) { // eslint-disable-line no-unused-vars
        extendedProductAttributesConfig = {};
    }

    let defaultAttributes = algoliaProductConfig.defaultAttributes_v2.slice();
    let variantAttributes = algoliaProductConfig.defaultVariantAttributes_v2.slice();
    let masterAttributes = algoliaProductConfig.defaultMasterAttributes_v2.slice();

    // Additional attributes from SFCC custom preferences
    let additionalAttributes = algoliaData.getSetOfArray('AdditionalAttributes');
    additionalAttributes.map(function(attribute) {
        if (defaultAttributes.indexOf(attribute) < 0) {
            defaultAttributes.push(attribute);
        }
    });

    defaultAttributes.forEach(function(attribute) {
        let attributeConfig = extendedProductAttributesConfig[attribute] ||
            algoliaProductConfig.attributeConfig_v2[attribute] ||
            getDefaultAttributeConfig(attribute);

        if (attributeConfig.variantAttribute) {
            variantAttributes.push(attribute);
        } else {
            masterAttributes.push(attribute);
        }

        if (attributeConfig.computedFromBaseProduct) {
            attributesComputedFromBaseProduct.push(attribute);
        } else if (!attributeConfig.localized) {
            nonLocalizedAttributes.push(attribute);
            if (!attributeConfig.variantAttribute) {
                nonLocalizedMasterAttributes.push(attribute);
            }
        }
    });

    return {
        variantAttributes: variantAttributes,
        masterAttributes: masterAttributes,
        attributesComputedFromBaseProduct: attributesComputedFromBaseProduct,
        nonLocalizedAttributes: nonLocalizedAttributes,
        nonLocalizedMasterAttributes: nonLocalizedMasterAttributes
    };
}

module.exports = {
    // productsIndexJob & categoryIndexJob
    appendObjToXML: appendObjToXML,
    xmlToObject: xmlToObject,
    objectCompare: objectCompare,
    hasSameProperties: hasSameProperties,
    readXMLObjectFromStream: readXMLObjectFromStream,
    getAlgoliaLogger: getAlgoliaLogger,
    logError: logError,
    logFileError: logFileError,
    logInfo: logInfo,
    logFileInfo: logFileInfo,
    checkAlgoliaFolder: checkAlgoliaFolder,

    AlgoliaOperation: AlgoliaOperation,
    UpdateProductModel: UpdateProductModel,
    DeleteProductModel: DeleteProductModel,
    writeObjectToXMLStream: writeObjectToXMLStream,
    getNextProductModel: getNextProductModel,

    generateVariantRecords: generateVariantRecords,

    // delta jobs
    isObjectsArrayEmpty: isObjectsArrayEmpty,
    getObjectsArrayLength: getObjectsArrayLength,
    updateCPObjectFromXML: updateCPObjectFromXML,

    getDefaultAttributeConfig: getDefaultAttributeConfig,
    getAttributes: getAttributes
};
