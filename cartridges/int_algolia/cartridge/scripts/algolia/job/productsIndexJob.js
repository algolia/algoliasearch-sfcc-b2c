"use strict";

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
        data : {}
    }

    for (var property in algoliaProduct) {
        if (property !== 'id') {
            this.options.data[property] = algoliaProduct[property];
        };
    }
};

/**
 * Write Object to XMlStreamWriter
 * @param {dw.io.XMLStreamWriter} xmlStreamWriter - XML Stream Writer 
 * @param {Object} obj - name of node XML object
 * @returns {null} - XML Object or null
 */
function writeObjectToXMLStream(xmlStreamWriter, obj) {
    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');

    var productModelXML = <product></product>; 
    jobHelper.appendObjToXML(productModelXML, obj);

    xmlStreamWriter.writeCharacters('\n');
    xmlStreamWriter.writeRaw(productModelXML.toXMLString());
    xmlStreamWriter.writeCharacters('\n');
    return null;
}

/**
 * Job for create Product Snapshot file and 
 * file for update Algolia Product Index
 * @param {Object} parameters
 * @returns {boolean} - successful Job run
 */
function runProductExport(parameters) {
    var ProductMgr = require('dw/catalog/ProductMgr');
    var File = require('dw/io/File');
    var FileReader = require('dw/io/FileReader');
    var XMLStreamReader = require('dw/io/XMLStreamReader');
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter');

    var AlgoliaProduct = require('*/cartridge/scripts/algolia/model/algoliaProduct');
    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');
    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

    var counterProductsTotal = 0;
    var counterProductsForUpdate = 0;
    var date = new Date();
    var productLogData = algoliaData.getLogData('LastProductSyncLog');
    productLogData.processedDate = date.toISOString();
    productLogData.processedError = true;
    productLogData.processedErrorMessage = '';
    productLogData.processedRecords = 0;
    productLogData.processedToUpdateRecords = 0;
    
    // Open XML New temporary Snapshot file to write
    try {
        var newSnapshotFile = new File(algoliaConstants.TMP_SNAPSHOT_PRODUCTS_FILE_NAME);
        var snapshotFileWriter = new FileWriter(newSnapshotFile, "UTF-8");
        var snapshotXmlWriter = new XMLStreamWriter(snapshotFileWriter); 
        snapshotXmlWriter.writeStartDocument();
        snapshotXmlWriter.writeStartElement('products');
    } catch (error) {
        jobHelper.logFileError(newSnapshotFile.fullPath, 'Error open file or write', error);
        return false;
    }

    // Open XML Update for Algolia file to write
    try {
        var updateFile = new File(algoliaConstants.UPDATE_PRODUCTS_FILE_NAME);
        var updateFileWriter = new FileWriter(updateFile, "UTF-8");
        var updateXmlWriter = new XMLStreamWriter(updateFileWriter); 
        updateXmlWriter.writeStartDocument();
        updateXmlWriter.writeStartElement('products');
    } catch (error) {
        jobHelper.logFileError(updateFile.fullPath, 'Error open file or write', error);
        productLogData.processedErrorMessage = 'Error open file or write';
        algoliaData.setLogData('LastProductSyncLog', productLogData);
        return false;
    }

    // Open XML Snapshot file to read
    var isInitAlgolia = true;
    var productSnapshotXML = null;
    var snapshotFile = new File(algoliaConstants.SNAPSHOT_PRODUCTS_FILE_NAME);
    if (snapshotFile.exists()) {
        if (!empty(parameters.init) && parameters.init.toLowerCase() == 'true') {
            try {
                snapshotFile.remove();
            } catch (error) {
                jobHelper.logFileError(snapshotFile.fullPath, 'Error remove file', error);
                productLogData.processedErrorMessage = 'Error remove file';
                algoliaData.setLogData('LastProductSyncLog', productLogData);        
                return false;
            };
        } else {
            try {
                isInitAlgolia = false;
                var snapshotFileReader = new FileReader(snapshotFile, "UTF-8");
                var snapshotXmlReader = new XMLStreamReader(snapshotFileReader);
                productSnapshotXML = isInitAlgolia ? null : jobHelper.readXMLObjectFromStream(snapshotXmlReader, 'product');
            } catch (error) {
                jobHelper.logFileError(snapshotFile.fullPath, 'Error open file or read', error);
                productLogData.processedErrorMessage = 'Error open file or read';
                algoliaData.setLogData('LastProductSyncLog', productLogData);        
                return false;
            };
        }
    }
    
    var productsIterator = ProductMgr.queryAllSiteProductsSorted();
    
    while(productsIterator.hasNext()) {
        var product = productsIterator.next();
        var newProductModel = new AlgoliaProduct(product);
        
        if (!isInitAlgolia && productSnapshotXML) {
            var productUpdate = null;
            var productSnapshot = jobHelper.xmlToObject(productSnapshotXML);

            if (newProductModel.id == productSnapshot.product.id) {
                // Update product to delta
                var deltaObject = jobHelper.objectCompare(productSnapshot.product, newProductModel);
                if (deltaObject) {
                    deltaObject.id = newProductModel.id;
                    productUpdate = new UpdateProductModel(deltaObject);
                };

                try {
                    productSnapshotXML = jobHelper.readXMLObjectFromStream(snapshotXmlReader, 'product');
                } catch (error) {
                    jobHelper.logFileError(snapshotFile.fullPath, 'Error read from file', error);
                    productLogData.processedErrorMessage = 'Error read from file';
                    algoliaData.setLogData('LastProductSyncLog', productLogData);        
                    return false;
                };

            } else if (product.ID < productSnapshot.product.id) {
                // Add product to delta
                productUpdate = new UpdateProductModel(newProductModel);
            } else {
                // Remove product to delta
                productUpdate = {
                    topic : 'products/delete',
                    resource_type : 'product',
                    resource_id : newProductModel.id
                };
            }
        } else {
            // Add product to delta
            productUpdate = new UpdateProductModel(newProductModel);
        };

        // Write to Update XML file
        if (productUpdate) {
            try {
                writeObjectToXMLStream(updateXmlWriter, productUpdate);
            } catch (error) {
                jobHelper.logFileError(updateFile.fullPath, 'Error write to file', error);
                productLogData.processedErrorMessage = 'Error write to file';
                algoliaData.setLogData('LastProductSyncLog', productLogData);        
            return false;
            };
            counterProductsForUpdate += 1;
        }

        // Write product to new snapshot file
        try {
            writeObjectToXMLStream(snapshotXmlWriter, newProductModel);
        } catch (error) {
            jobHelper.logFileError(newSnapshotFile.fullPath, 'Error write to file', error);
            productLogData.processedErrorMessage = 'Error write to file';
            algoliaData.setLogData('LastProductSyncLog', productLogData);        
        return false;
        };

        // TODO: remove from productiond
        counterProductsTotal += 1;
        if (PROCESSING_PRODUCT_LIMIT > 0 && counterProductsTotal >= PROCESSING_PRODUCT_LIMIT) break;
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
    if (!isInitAlgolia) {
        snapshotXmlReader.close();
        snapshotFileReader.close();
    };

    productsIterator.close();

    /*
    // Delete old snapshot file and rename a new one
    try {
        snapshotFile.remove();
        newSnapshotFile.renameTo(snapshotFile);
    } catch (error) {
        jobHelper.logFileError(snapshotFile.fullPath, 'Error rewrite file', error);
        return false;
    };
    */

    jobHelper.logFileInfo(snapshotFile.fullPath, 'Processed ' + counterProductsTotal + ' records');
    jobHelper.logFileInfo(updateFile.fullPath, 'Records for update' + counterProductsForUpdate + 'records');

    var date = new Date();
    productLogData.processedDate = date.toISOString(),
    productLogData.processedError = false,
    productLogData.processedErrorMessage = '',
    productLogData.processedRecords = counterProductsTotal,
    productLogData.processedToUpdateRecords = counterProductsForUpdate
    algoliaData.setLogData('LastProductSyncLog', productLogData);        

    return true;
}

module.exports.execute = runProductExport;
