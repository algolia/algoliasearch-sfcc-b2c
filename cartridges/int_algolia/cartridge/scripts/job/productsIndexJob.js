"use strict";

/**
 * UpdateProductModel class that represents an Algolia ProductModel
 * for update product properties
 * @param {Object} algoliaProduct - Algolia Product Model
 * @constructor
 */
function UpdateProductModel(algoliaProduct) {
    this.topic = 'products/update';
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
 * Write Object to XMlStreamWriter
 * @param {dw.io.XMLStreamWriter} xmlStreamWriter - XML Stream Writer 
 * @param {Object} obj - name of node XML object
 * @returns {null} - XML Object or null
 */
function writeObjectToXMLStream(xmlStreamWriter, obj) {
    var jobHelper = require('*/cartridge/scripts/helper/jobHelper');
    /*
    if (obj.id >= '11736753M') {
        obj.id = obj.id + '-1';
    }
    */

    var productModelXML = <product></product>; 
    jobHelper.appendObjToXML(productModelXML, obj);

    xmlStreamWriter.writeCharacters('\n');
    xmlStreamWriter.writeRaw(productModelXML.toXMLString());
    xmlStreamWriter.writeCharacters('\n');
    return null;
}

/**
 * Create new Product Snapshot file 
 * @param {dw.io.File} snapshotFile - Snapshot file object
 * @returns {boolean} - successful of create file
 */
function createProductSnapshotFile(snapshotFile) {
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter');
    var ProductMgr = require('dw/catalog/ProductMgr');
    var AlgoliaProduct = require('*/cartridge/scripts/model/algoliaProduct');

    var counterProducts = 0; // TODO: remove on production

    var snapshotFileWriter = new FileWriter(snapshotFile, "UTF-8");
    var xlsw = new XMLStreamWriter(snapshotFileWriter); 

    var productsIterator = ProductMgr.queryAllSiteProductsSorted(); // queryAllSiteProducts/queryAllSiteProductsSorted

    xlsw.writeStartDocument();
    xlsw.writeStartElement('products');

    while(productsIterator.hasNext()) {
        var product = productsIterator.next();
        var newProductModel = new AlgoliaProduct(product);
        writeObjectToXMLStream(xlsw, newProductModel)

        //if (++counterProducts > 10) break; // TODO: remove
    }

    // Close XML Reindex file
    xlsw.writeEndElement();
    xlsw.writeEndDocument();
    xlsw.close();
    snapshotFileWriter.close();

    productsIterator.close();
    
    //TODO: error handler
    return true;
}

/**
 * Job for create Product Snapshot file and 
 * file for update Algolia Product Index
 * @returns {boolean} - successful Job run
 */
function runProductExport() {
    const SNAPSHOT_PRODUCTS_FILE_NAME = '/TEMP/product.xml';
    const TMP_SNAPSHOT_PRODUCTS_FILE_NAME = '/TEMP/product_tmp.xml';
    const UPDATE_PRODUCTS_FILE_NAME = '/TEMP/product_update.xml';

    var ProductMgr = require('dw/catalog/ProductMgr');
    var File = require('dw/io/File');
    var FileReader = require('dw/io/FileReader');
    var XMLStreamReader = require('dw/io/XMLStreamReader');
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter'); // XMLStreamWriter/XMLIndentingStreamWriter

    var AlgoliaProduct = require('*/cartridge/scripts/model/algoliaProduct');
    var jobHelper = require('*/cartridge/scripts/helper/jobHelper');

    var snapshotFile = new File(SNAPSHOT_PRODUCTS_FILE_NAME);
    if (!snapshotFile.exists()) {
        createProductSnapshotFile(snapshotFile);
        return true;
    };

    var counterProducts = 0;
    
    // Open XML Snapshot file to read
    var snapshotFileReader = new FileReader(snapshotFile, "UTF-8");
    var snapshotXmlReader = new XMLStreamReader(snapshotFileReader);
    
    // Open XML New temporary Snapshot file to write
    var newSnapshotFile = new File(TMP_SNAPSHOT_PRODUCTS_FILE_NAME);
    var snapshotFileWriter = new FileWriter(newSnapshotFile, "UTF-8");
    var snapshotXmlWriter = new XMLStreamWriter(snapshotFileWriter); 
    snapshotXmlWriter.writeStartDocument();
    snapshotXmlWriter.writeStartElement('products');

    // Open XML Update for Algolia file to write
    var updateFile = new File(UPDATE_PRODUCTS_FILE_NAME);
    var updateFileWriter = new FileWriter(updateFile, "UTF-8");
    var updateXmlWriter = new XMLStreamWriter(updateFileWriter); 
    updateXmlWriter.writeStartDocument();
    updateXmlWriter.writeStartElement('products');

    var productsIterator = ProductMgr.queryAllSiteProductsSorted(); // queryAllSiteProducts/queryAllSiteProductsSorted
    var productSnapshotXML = readXMLObjectFromStream(snapshotXmlReader, 'product');
    
    while(productsIterator.hasNext()) {
        var product = productsIterator.next();
        var newProductModel = new AlgoliaProduct(product);
        
        if (productSnapshotXML) {
            var productUpdate = null;
            var productSnapshot = jobHelper.xmlToObject(productSnapshotXML);

            if (newProductModel.id == productSnapshot.product.id) {
                // Update product to delta
                var deltaObject = jobHelper.objectCompare(productSnapshot.product, newProductModel);
                if (deltaObject) {
                    deltaObject.id = newProductModel.id;
                    productUpdate = new UpdateProductModel(deltaObject);
                }
                productSnapshotXML = readXMLObjectFromStream(snapshotXmlReader, 'product');
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
            writeObjectToXMLStream(updateXmlWriter, productUpdate);
        }

        // Write product to new snapshot file
        writeObjectToXMLStream(snapshotXmlWriter, newProductModel);

        //if (++counterProducts > 10) break; // TODO: remove from productiond
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
    
    productsIterator.close();

    // Delete old snapshot file and rename a new one
    snapshotFile.remove();
    newSnapshotFile.renameTo(snapshotFile);

    //TODO: Send data to Algilia endpoint

    //TODO: error handler 
    return true;
}

module.exports.execute = runProductExport;
