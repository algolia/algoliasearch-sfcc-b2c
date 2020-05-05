'use strict';

// TODO: Remove from production
// Limit number of products processling
// 0 - no limit
var PROCESSING_PRODUCT_LIMIT = 0;

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

    for (var property in algoliaProduct) {
        if (property !== 'id') {
            this.options.data[property] = algoliaProduct[property];
        };
    }
}

/**
 * Write Object to XMlStreamWriter
 * @param {dw.io.XMLStreamWriter} xmlStreamWriter - XML Stream Writer
 * @param {Object} obj - name of node XML object
 * @returns {null} - XML Object or null
 */
function writeObjectToXMLStream(xmlStreamWriter, obj) {
    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');

    var productModelXML = new XML('<product></product>');
    jobHelper.appendObjToXML(productModelXML, obj);

    xmlStreamWriter.writeCharacters('\n');
    xmlStreamWriter.writeRaw(productModelXML.toXMLString());
    xmlStreamWriter.writeCharacters('\n');
    return null;
}

/**
 * Job for create Product Snapshot file and
 * file for update Algolia Product Index
 * @param {Object} parameters - job paraneters
 * @returns {boolean} - successful Job run
 */
function runProductExport(parameters) {
    var ProductMgr = require('dw/catalog/ProductMgr');
    var File = require('dw/io/File');
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter');

    var AlgoliaProduct = require('*/cartridge/scripts/algolia/model/algoliaProduct');
    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');
    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    var fileReadIterator = require('*/cartridge/scripts/algolia/helper/fileReadIterator');

    var counterProductsTotal = 0;
    var counterProductsForUpdate = 0;
    var productLogData = algoliaData.getLogData('LastProductSyncLog');
    productLogData.processedDate = algoliaData.getLocalDataTime(new Date());
    productLogData.processedError = true;
    productLogData.processedErrorMessage = '';
    productLogData.processedRecords = 0;
    productLogData.processedToUpdateRecords = 0;

    // Open XML New temporary Snapshot file to write
    var newSnapshotFile = null;
    var snapshotFileWriter = null;
    var snapshotXmlWriter = null;

    try {
        newSnapshotFile = new File(algoliaConstants.TMP_SNAPSHOT_PRODUCTS_FILE_NAME);
        snapshotFileWriter = new FileWriter(newSnapshotFile, 'UTF-8');
        snapshotXmlWriter = new XMLStreamWriter(snapshotFileWriter);
        snapshotXmlWriter.writeStartDocument();
        snapshotXmlWriter.writeStartElement('products');
    } catch (error) {
        jobHelper.logFileError(newSnapshotFile.fullPath, 'Error open Snapshot file to write', error);
        return false;
    }

    // Open Delta XML file to write
    var updateFile = null;
    var updateFileWriter = null;
    var updateXmlWriter = null;
    try {
        updateFile = new File(algoliaConstants.UPDATE_PRODUCTS_FILE_NAME);
        updateFileWriter = new FileWriter(updateFile, 'UTF-8');
        updateXmlWriter = new XMLStreamWriter(updateFileWriter);
        updateXmlWriter.writeStartDocument();
        updateXmlWriter.writeStartElement('products');
    } catch (error) {
        jobHelper.logFileError(updateFile.fullPath, 'Error open Delta file to write', error);
        productLogData.processedErrorMessage = 'Error open Delta file to write';
        algoliaData.setLogData('LastProductSyncLog', productLogData);
        return false;
    }

    // Open XML Snapshot file to read
    var snapshotReadIterator = null;
    var snapshotFile = new File(algoliaConstants.SNAPSHOT_PRODUCTS_FILE_NAME);
    if (snapshotFile.exists()) {
        if (!empty(parameters.init) && parameters.init.toLowerCase() === 'true') {
            try {
                snapshotFile.remove();
            } catch (error) {
                jobHelper.logFileError(snapshotFile.fullPath, 'Error remove file', error);
                productLogData.processedErrorMessage = 'Error remove file';
                algoliaData.setLogData('LastProductSyncLog', productLogData);
                return false;
            }
        } else {
            snapshotReadIterator = fileReadIterator.create(algoliaConstants.SNAPSHOT_PRODUCTS_FILE_NAME, 'product');
            if (empty(snapshotReadIterator)) {
                productLogData.processedErrorMessage = 'Error open Snapshot file or read';
                algoliaData.setLogData('LastProductSyncLog', productLogData);
                return false;
            }
        }
    }

    var productsIterator = ProductMgr.queryAllSiteProductsSorted();
    var newProductModel = productsIterator.hasNext() ? new AlgoliaProduct(productsIterator.next()) : null;
    var snapshotToUpdate = true;
    var productSnapshot = snapshotReadIterator && snapshotReadIterator.hasNext() ? snapshotReadIterator.next() : null;

    var limitCounter = 0;

    while (newProductModel || productSnapshot) {
        var productUpdate = null;

        // Write product to Snapshot file
        if (snapshotToUpdate && newProductModel) {
            try {
                writeObjectToXMLStream(snapshotXmlWriter, newProductModel);
            } catch (error) {
                jobHelper.logFileError(newSnapshotFile.fullPath, 'Error write to file', error);
                productLogData.processedErrorMessage = 'Error write to file';
                algoliaData.setLogData('LastProductSyncLog', productLogData);
                return false;
            }
            snapshotToUpdate = false;
            counterProductsTotal += 1;
        }

        if (newProductModel && !productSnapshot) {
            // Add product to delta
            productUpdate = new UpdateProductModel(newProductModel);
            newProductModel = productsIterator.hasNext() ? new AlgoliaProduct(productsIterator.next()) : null;
            snapshotToUpdate = true;
        }

        if (!newProductModel && productSnapshot) {
            // Remove product from delta
            productUpdate = {
                topic: 'products/delete',
                resource_type: 'product',
                resource_id: productSnapshot.id
            };
            productSnapshot = snapshotReadIterator && snapshotReadIterator.hasNext() ? snapshotReadIterator.next() : null;
        }

        if (newProductModel && productSnapshot) {
            if (newProductModel.id === productSnapshot.id) {
                // Update product to delta
                if (jobHelper.hasSameProperties(productSnapshot, newProductModel)) {
                    var deltaObject = jobHelper.objectCompare(productSnapshot, newProductModel);
                    // Partial product update
                    if (deltaObject) {
                        deltaObject.id = newProductModel.id;
                        productUpdate = new UpdateProductModel(deltaObject);
                        productUpdate.options.partial = true;
                    }
                } else {
                    // Rewrite product сompletely
                    productUpdate = new UpdateProductModel(newProductModel);
                }
                productSnapshot = snapshotReadIterator && snapshotReadIterator.hasNext() ? snapshotReadIterator.next() : null;
                newProductModel = productsIterator.hasNext() ? new AlgoliaProduct(productsIterator.next()) : null;
                snapshotToUpdate = true;
            } else if (newProductModel.id < productSnapshot.id) {
                // Add product to delta
                productUpdate = new UpdateProductModel(newProductModel);
                newProductModel = productsIterator.hasNext() ? new AlgoliaProduct(productsIterator.next()) : null;
                snapshotToUpdate = true;
            } else {
                // Remove product from delta
                productUpdate = {
                    topic: 'products/delete',
                    resource_type: 'product',
                    resource_id: productSnapshot.id
                };
                productSnapshot = snapshotReadIterator && snapshotReadIterator.hasNext() ? snapshotReadIterator.next() : null;
            }
        }

        // Write delta to file
        if (productUpdate) {
            try {
                writeObjectToXMLStream(updateXmlWriter, productUpdate);
            } catch (error) {
                jobHelper.logFileError(updateFile.fullPath, 'Error write to file', error);
                productLogData.processedErrorMessage = 'Error write to file';
                algoliaData.setLogData('LastProductSyncLog', productLogData);
                return false;
            }
            counterProductsForUpdate += 1;
        }

        // TODO: remove from productiond
        limitCounter += 1;
        if (PROCESSING_PRODUCT_LIMIT > 0 && limitCounter >= PROCESSING_PRODUCT_LIMIT) break;
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
    if (snapshotReadIterator) {
        snapshotReadIterator.close();
    }

    productsIterator.close();

    jobHelper.logFileInfo(snapshotFile.fullPath, 'Processed ' + counterProductsTotal + ' records');
    jobHelper.logFileInfo(updateFile.fullPath, 'Records for update' + counterProductsForUpdate + 'records');

    productLogData.processedDate = algoliaData.getLocalDataTime(new Date());
    productLogData.processedError = false;
    productLogData.processedErrorMessage = '';
    productLogData.processedRecords = counterProductsTotal;
    productLogData.processedToUpdateRecords = counterProductsForUpdate;
    algoliaData.setLogData('LastProductSyncLog', productLogData);

    return true;
}

module.exports.execute = runProductExport;
