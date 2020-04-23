"use strict";

const PROCESSING_PRODUCT_LIMIT = 2; // TODO: Remove from production

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
 * @returns {boolean} - successful Job run
 */
function runProductExport() {
    var ProductMgr = require('dw/catalog/ProductMgr');
    var File = require('dw/io/File');
    var FileReader = require('dw/io/FileReader');
    var XMLStreamReader = require('dw/io/XMLStreamReader');
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter'); // XMLStreamWriter/XMLIndentingStreamWriter

    var AlgoliaProduct = require('*/cartridge/scripts/algolia/model/algoliaProduct');
    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

    var isInitAlgolia = true;

    var counterProducts = 0; // TODO: remove from productiond
    
    // Open XML Snapshot file to read
    var snapshotFile = new File(algoliaConstants.SNAPSHOT_PRODUCTS_FILE_NAME);
    if (snapshotFile.exists()) {
        isInitAlgolia = false;
        var snapshotFileReader = new FileReader(snapshotFile, "UTF-8");
        var snapshotXmlReader = new XMLStreamReader(snapshotFileReader);
    };
    
    // Open XML New temporary Snapshot file to write
    var newSnapshotFile = new File(algoliaConstants.TMP_SNAPSHOT_PRODUCTS_FILE_NAME);
    var snapshotFileWriter = new FileWriter(newSnapshotFile, "UTF-8");
    var snapshotXmlWriter = new XMLStreamWriter(snapshotFileWriter); 
    snapshotXmlWriter.writeStartDocument();
    snapshotXmlWriter.writeStartElement('products');

    // Open XML Update for Algolia file to write
    var updateFile = new File(algoliaConstants.UPDATE_PRODUCTS_FILE_NAME);
    var updateFileWriter = new FileWriter(updateFile, "UTF-8");
    var updateXmlWriter = new XMLStreamWriter(updateFileWriter); 
    updateXmlWriter.writeStartDocument();
    updateXmlWriter.writeStartElement('products');

    var productsIterator = ProductMgr.queryAllSiteProductsSorted();
    var productSnapshotXML = isInitAlgolia ? null : jobHelper.readXMLObjectFromStream(snapshotXmlReader, 'product');
    
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
                }
                productSnapshotXML = jobHelper.readXMLObjectFromStream(snapshotXmlReader, 'product');
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

        // TODO: remove from productiond
        counterProducts += 1;
        if (PROCESSING_PRODUCT_LIMIT > 0 && counterProducts >= PROCESSING_PRODUCT_LIMIT) break;
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

    // Delete old snapshot file and rename a new one
    snapshotFile.remove();
    newSnapshotFile.renameTo(snapshotFile);

    //TODO: Send data to Algilia endpoint

    //TODO: error handler 
    return true;
}

module.exports.execute = runProductExport;
