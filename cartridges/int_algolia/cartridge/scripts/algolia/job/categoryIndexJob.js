"use strict";

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
 * @param {dw.content.MediaFile} MediaFile - image
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
    var jobHelper = require('*/cartridge/scripts/helper/jobHelper');
    var categoryModelXML = <category></category>;

    jobHelper.appendObjToXML(categoryModelXML, obj);

    xmlStreamWriter.writeCharacters('\n');
    xmlStreamWriter.writeRaw(categoryModelXML.toXMLString());
    xmlStreamWriter.writeCharacters('\n');
    return null;
}

/**
 * Converts a given category from dw.catalog.Category to plain object
 * @param {dw.catalog.Category} category - A single category
 * @returns {string} category ID
 */
function prepareListOfCategories(siteLocales, listOfCategories, category, parentId) {
    if (!category.custom || !category.custom.showInMenu) {
        return null;
    }
    var categoryId = category.ID;
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
            if (subcategory.hasOnlineProducts() || subcategory.hasOnlineSubCategories()) {
                converted = prepareListOfCategories(siteLocales, listOfCategories, subcategory, categoryId);
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
 * Create new Product Snapshot file 
 * @param {dw.io.File} snapshotFile - Snapshot file object
 * @returns {boolean} - successful of create file
 */
function createCategoriesSnapshotFile(snapshotFile, listOfCategories) {
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter');

    var snapshotFileWriter = new FileWriter(snapshotFile, "UTF-8");
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

    //TODO: error handler
    return true;
}

/**
 * Job for create Categories Snapshot file and 
 * file for update Algolia Category Index
 * @returns {boolean} - successful Job run
 */
function runCategoryExport() {
    var siteRootCategory = catalogMgr.getSiteCatalog().getRoot();
    var currentSite = Site.getCurrent();
    var siteLocales = currentSite.getAllowedLocales();
    var topLevelCategories = siteRootCategory.hasOnlineSubCategories() ?
            siteRootCategory.getOnlineSubCategories().iterator() : null;
    var listOfCategories = [];

    var File = require('dw/io/File');
    var FileReader = require('dw/io/FileReader');
    var XMLStreamReader = require('dw/io/XMLStreamReader');
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter'); // XMLStreamWriter/XMLIndentingStreamWriter

    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

    while(topLevelCategories.hasNext()) {
        var category = topLevelCategories.next();
        prepareListOfCategories(siteLocales, listOfCategories, category);
    }

    var snapshotFile = new File(algoliaConstants.SNAPSHOT_CATEGORIES_FILE_NAME);
    var updateFile = new File(algoliaConstants.UPDATE_CATEGORIES_FILE_NAME);
    if (!snapshotFile.exists()) {
        createCategoriesSnapshotFile(snapshotFile, listOfCategories);
        if(updateFile.exists()) {
            updateFile.remove();
        }
        snapshotFile.copyTo(updateFile);
        return true;
    };

    var snapshotFileReader = new FileReader(snapshotFile, "UTF-8");
    var snapshotXmlReader = new XMLStreamReader(snapshotFileReader);

    // Open XML Update for Algolia file to write
    var updateFileWriter = new FileWriter(updateFile, "UTF-8");
    var updateXmlWriter = new XMLStreamWriter(updateFileWriter); 
    updateXmlWriter.writeStartDocument();
    updateXmlWriter.writeStartElement('categories');

    while (snapshotXmlReader.hasNext()) {
        var categorySnapshotXML = readXMLObjectFromStream(snapshotXmlReader, 'category');
        if (categorySnapshotXML) {
            var categorySnapshot = jobHelper.xmlToObject(categorySnapshotXML).category;
            var categoryUpdate;
            var indexOfcategoryFromList = listOfCategories.map(function(e) { return e.id; }).indexOf(categorySnapshot.id);

            if (indexOfcategoryFromList > -1) {
                // compare if was updated
                if (typeof categorySnapshot.description.locales == 'string') {	// TODO: recheck the code for locale checking
                    categorySnapshot.description.locales = {};
                }
                if (JSON.stringify(categorySnapshot) != JSON.stringify(listOfCategories[indexOfcategoryFromList])) {
                    categoryUpdate = listOfCategories[indexOfcategoryFromList];
                }
            } else {	// save to updateXmlWriter that product is deleted
                categoryUpdate = {
                    topic : 'categories/delete',
                    resource_type : 'category',
                    resource_id : categorySnapshot.id
                }
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

    // render new snapshot and add new products to updates

    // Open XML New temporary Snapshot file to write
    var newSnapshotFile = new File(algoliaConstants.TMP_SNAPSHOT_CATEGORIES_FILE_NAME);
    var snapshotFileWriter = new FileWriter(newSnapshotFile, "UTF-8");
    var snapshotXmlWriter = new XMLStreamWriter(snapshotFileWriter); 
    snapshotXmlWriter.writeStartDocument();
    snapshotXmlWriter.writeStartElement('categories');

    for (var i in listOfCategories) {
        if (listOfCategories[i].hasOwnProperty('checked') && listOfCategories[i].checked) {
            delete listOfCategories[i].checked;
        } else {
            writeObjectToXMLStream(updateXmlWriter, listOfCategories[i]);
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

    // Delete old snapshot file and rename a new one
    try {
        snapshotFile.remove();
        newSnapshotFile.renameTo(snapshotFile);
    } catch (error) {
        jobHelper.logFileError(snapshotFile.fullPath, 'Error rewrite file', error);
        return false;
    };
    return true;
}

module.exports.execute = runCategoryExport;
