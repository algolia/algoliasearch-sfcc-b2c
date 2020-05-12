'use strict';

var catalogMgr = require('dw/catalog/CatalogMgr');
var URLUtils = require('dw/web/URLUtils');
var Site = require('dw/system/Site');

/**
 * forEach method for dw.util.Collection subclass instances
 * @param {dw.util.Collection} collection - Collection subclass instance to map over
 * @param {Function} callback - Callback function for each item
 * @param {Object} [scope] - Optional execution scope to pass to callback
 * @returns {void}
 */
function forEach(collection, callback, scope) {
    var iterator = collection.iterator();
    var index = 0;
    var item = null;
    while (iterator.hasNext()) {
        item = iterator.next();
        if (scope) {
            callback.call(scope, item, index, collection);
        } else {
            callback(item, index, collection);
        }
        index++;
    }
}

/**
 * UpdateCategoryModel class that represents an object for Algolia index request
 * @param {Object} algoliaCategory - Algolia Category Object
 * @constructor
 */
function UpdateCategoryModel(algoliaCategory) {
    this.topic = 'categories/index';
    this.resource_type = 'category';
    this.resource_id = algoliaCategory.id;
    this.options = {
        data: {}
    };

    for (var property in algoliaCategory) {
        if (property !== 'id') {
            this.options.data[property] = algoliaCategory[property];
        }
    }
}

/**
 * Get category url
 * @param {dw.catalog.Category} category - Current category
 * @returns {string} - Url of the category
 */
function getCategoryUrl(category) {
    return category.custom && 'alternativeUrl' in category.custom && category.custom.alternativeUrl
        ? (category.custom.alternativeUrl.toString()).replace(/&amp;/g, '&')
        : URLUtils.https('Search-Show', 'cgid', category.getID()).toString();
}

/**
 * Get image url
 * @param {dw.content.MediaFile} image - MediaFile
 * @returns {string} - Url of the image
 */
function getImageUrl(image) {
    return image ? image.getHttpsURL().toString() : null;
}

/**
 * Write Object to XMlStreamWriter
 * @param {dw.io.XMLStreamWriter} xmlStreamWriter - XML Stream Writer
 * @param {Object} obj - name of node XML object
 * @returns {null} - XML Object or null
 */
function writeObjectToXMLStream(xmlStreamWriter, obj) {
    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    var categoryModelXML = new XML('<category></category>');

    jobHelper.appendObjToXML(categoryModelXML, obj);

    xmlStreamWriter.writeCharacters('\n');
    xmlStreamWriter.writeRaw(categoryModelXML.toXMLString());
    xmlStreamWriter.writeCharacters('\n');
    return null;
}

/**
 * Converts a given category from dw.catalog.Category to plain object
 * @param {Array} siteLocales - array of available locales
 * @param {Array} listOfCategories - array of categories
 * @param {dw.catalog.Category} category - A single category
 * @param {string} catalogId - ID of site catalog
 * @param {string} parentId - ID of parent category
 * @returns {string} category ID
 */
function prepareListOfCategories(siteLocales, listOfCategories, category, catalogId, parentId) {
    var categoryId = catalogId + '/' + category.ID;
    var result = {
        id: categoryId,
        url: {},
        name: {},
        description: {}
    };
    for (var loc in siteLocales) {
        var localeName = siteLocales[loc];
        request.setLocale(localeName);

        result.url[localeName] = getCategoryUrl(category);
        result.name[localeName] = category.getDisplayName();
        if (category.getDescription()) {
            result.description[localeName] = category.getDescription();
        }
    }
    if (parentId) {
        result.parent_category_id = parentId;
    }
    var image = getImageUrl(category.getImage());
    if (image) {
        result.image = image;
    }
    var thumbnail = getImageUrl(category.getThumbnail());
    if (thumbnail) {
        result.thumbnail = getImageUrl(category.getThumbnail());
    }

    var subCategories = category.hasOnlineSubCategories() ?
        category.getOnlineSubCategories() : null;

    if (subCategories) {
        forEach(subCategories, function (subcategory) {
            var converted = null;
            if (subcategory.custom && subcategory.custom.showInMenu &&
                    (subcategory.hasOnlineProducts() || subcategory.hasOnlineSubCategories())) {
                converted = prepareListOfCategories(siteLocales, listOfCategories, subcategory, catalogId, categoryId);
            }
            if (converted) {
                if (!result.subCategories) {
                    result.subCategories = [];
                }
                result.subCategories.push(converted);
            }
        });
    }
    listOfCategories.push(result);

    return categoryId;
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
        if (xmlStreamReader.next() == XMLStreamConstants.START_ELEMENT) {
            var localElementName = xmlStreamReader.getLocalName();
            if (localElementName == modeName) {
                result = xmlStreamReader.readXMLObject();
                break;
            }
        }
    }
    return result;
}

/**
 * Create new Category Snapshot file
 * @param {dw.io.File} snapshotFile - Snapshot file object
 * @param {Array} listOfCategories - array of categories
 * @returns {boolean} - successful of create file
 */
function createCategoriesSnapshotFile(snapshotFile, listOfCategories) {
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter');

    var snapshotFileWriter = new FileWriter(snapshotFile, 'UTF-8');
    var xlsw = new XMLStreamWriter(snapshotFileWriter);

    xlsw.writeStartDocument();
    xlsw.writeStartElement('categories');

    for (var i in listOfCategories) {
        writeObjectToXMLStream(xlsw, listOfCategories[i]);
    }

    // Close XML Reindex file
    xlsw.writeEndElement();
    xlsw.writeEndDocument();
    xlsw.close();
    snapshotFileWriter.close();

    // TODO: error handler
    return true;
}

/**
 * Job for create Categories Snapshot file and
 * file for update Algolia Category Index
 * @param {Object} parameters - job parameters
 * @returns {boolean} - successful Job run
 */
function runCategoryExport(parameters) {
    var siteCatalog = catalogMgr.getSiteCatalog();
    var siteCatalogId = siteCatalog.getID();
    var siteRootCategory = siteCatalog.getRoot();
    var currentSite = Site.getCurrent();
    var siteLocales = currentSite.getAllowedLocales();
    var topLevelCategories = siteRootCategory.hasOnlineSubCategories() ?
            siteRootCategory.getOnlineSubCategories().iterator() : null;
    var listOfCategories = [];

    var File = require('dw/io/File');
    var FileReader = require('dw/io/FileReader');
    var XMLStreamReader = require('dw/io/XMLStreamReader');
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter');

    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');
    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

    while (topLevelCategories.hasNext()) {
        var category = topLevelCategories.next();
        if (category.custom && category.custom.showInMenu &&
                (category.hasOnlineProducts() || category.hasOnlineSubCategories())) {
            prepareListOfCategories(siteLocales, listOfCategories, category, siteCatalogId);
        }
    }

    var snapshotFile = new File(algoliaConstants.SNAPSHOT_CATEGORIES_FILE_NAME);
    var updateFile = new File(algoliaConstants.UPDATE_CATEGORIES_FILE_NAME);

    var categoryLogData = algoliaData.getLogData('LastCategorySyncLog');
    categoryLogData.processedDate = algoliaData.getLocalDateTime(new Date());
    categoryLogData.processedError = true;
    categoryLogData.processedErrorMessage = '';
    categoryLogData.processedRecords = 0;
    categoryLogData.processedToUpdateRecords = 0;

    var initCall = false;
    if (!empty(parameters.init) && parameters.init.toLowerCase() == 'true') {
        initCall = true;
        try {
            snapshotFile.remove();
        } catch (error) {
            jobHelper.logFileError(snapshotFile.fullPath, 'Error remove snapshot file', error);
            categoryLogData.processedErrorMessage = 'Error remove shapnshot file';
            algoliaData.setLogData('LastCategorySyncLog', categoryLogData);
            return false;
        }
    }
    if (!snapshotFile.exists()) {
        createCategoriesSnapshotFile(snapshotFile, listOfCategories);
        if (updateFile.exists()) {
            updateFile.remove();
        }
    }

    var snapshotFileReader = new FileReader(snapshotFile, 'UTF-8');
    var snapshotXmlReader = new XMLStreamReader(snapshotFileReader);

    // Open XML Update for Algolia file to write
    var updateFileWriter = new FileWriter(updateFile, 'UTF-8');
    var updateXmlWriter = new XMLStreamWriter(updateFileWriter);
    updateXmlWriter.writeStartDocument();
    updateXmlWriter.writeStartElement('categories');

    while (snapshotXmlReader.hasNext()) {
        var categorySnapshotXML = readXMLObjectFromStream(snapshotXmlReader, 'category');
        if (categorySnapshotXML) {
            var categorySnapshot = jobHelper.xmlToObject(categorySnapshotXML).category;
            var categoryUpdate;
            var indexOfcategoryFromList = listOfCategories.map(function (e) { return e.id; }).indexOf(categorySnapshot.id);

            if (indexOfcategoryFromList > -1) {
                // check empty attributes
                if (!('description' in categorySnapshot)) {
                    categorySnapshot.description = {};
                }
                // compare if was updated
                var categoryFromList = listOfCategories[indexOfcategoryFromList];
                var deltaObject = jobHelper.objectCompare(categorySnapshot, categoryFromList);
                if (deltaObject || initCall) {
                    categoryUpdate = new UpdateCategoryModel(categoryFromList);
                }
            } else { // save to updateXmlWriter that category is deleted
                categoryUpdate = {
                    topic: 'categories/delete',
                    resource_type: 'category',
                    resource_id: categorySnapshot.id
                };
            }

            if (categoryUpdate) {
                writeObjectToXMLStream(updateXmlWriter, categoryUpdate);
                categoryUpdate = false;
            }
            // mark as checked after added to file
            if (indexOfcategoryFromList > -1) {
                listOfCategories[indexOfcategoryFromList].checked = true;
            }
        }
    }

    // render new snapshot and add new categories to updates

    // Open XML New temporary Snapshot file to write
    var newSnapshotFile = new File(algoliaConstants.TMP_SNAPSHOT_CATEGORIES_FILE_NAME);
    var snapshotFileWriter = new FileWriter(newSnapshotFile, 'UTF-8');
    var snapshotXmlWriter = new XMLStreamWriter(snapshotFileWriter);
    snapshotXmlWriter.writeStartDocument();
    snapshotXmlWriter.writeStartElement('categories');

    for (var i in listOfCategories) {
        if (listOfCategories[i].hasOwnProperty('checked') && listOfCategories[i].checked) {
            delete listOfCategories[i].checked;
        } else {
            var categoryUpdate = new UpdateCategoryModel(listOfCategories[i]);
            writeObjectToXMLStream(updateXmlWriter, categoryUpdate);
        }
        writeObjectToXMLStream(snapshotXmlWriter, listOfCategories[i]);
    }

    // Close XML Update file
    updateXmlWriter.writeEndElement();
    updateXmlWriter.writeEndDocument();
    updateXmlWriter.close();
    updateFileWriter.close();

    // Close XML new Snapshot file
    snapshotXmlWriter.writeEndElement();
    snapshotXmlWriter.writeEndDocument();
    snapshotXmlWriter.close();
    snapshotFileWriter.close();

    // Close XML Snapshot file
    snapshotXmlReader.close();
    snapshotFileReader.close();

    return true;
}

module.exports.execute = runCategoryExport;
