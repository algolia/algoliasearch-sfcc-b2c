'use strict';

/**
 * Job for create Product Snapshot file and
 * file for update Algolia Product Index
 * @param {Object} parameters - job paraneters
 * @returns {dw.system.Status} - successful Job run
 */
function runProductExport(parameters) {
    var Status = require('dw/system/Status');
    var ProductMgr = require('dw/catalog/ProductMgr');
    var File = require('dw/io/File');
    var FileWriter = require('dw/io/FileWriter');
    var XMLStreamWriter = require('dw/io/XMLIndentingStreamWriter');

    var jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');
    var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    var fileReadIterator = require('*/cartridge/scripts/algolia/helper/fileReadIterator');

    var counterProductsTotal = 0;
    var counterProductsForUpdate = 0;
    var productLogData = algoliaData.getLogData('LastProductSyncLog');
    productLogData.processedDate = algoliaData.getLocalDateTime(new Date());
    productLogData.processedError = true;
    productLogData.processedErrorMessage = '';
    productLogData.processedRecords = 0;
    productLogData.processedToUpdateRecords = 0;

    var status = new Status(Status.ERROR);
    if (!jobHelper.checkAlgoliaFolder()) {
        jobHelper.logFileError('No folder', 'Unable to create Algolia folder', status);
        return status;
    }

    if (!algoliaData.getPreference('Enable')) {
        jobHelper.logFileError('Disable', 'Algolia Cartridge Disabled', status);
        productLogData.processedErrorMessage = 'Algolia Cartridge Disabled';
        algoliaData.setLogData('LastProductSyncLog', productLogData);
        return status;
    }

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
        return new Status(Status.ERROR);
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
        snapshotFileWriter.close();
        snapshotXmlWriter.close();
        return new Status(Status.ERROR);
    }

    // Open XML Snapshot file to read
    var snapshotReadIterator = null;
    var snapshotFile = new File(algoliaConstants.SNAPSHOT_PRODUCTS_FILE_NAME);
    if (snapshotFile.exists()) {
        if (!empty(parameters.clearAndRebuild) && parameters.clearAndRebuild.toLowerCase() === 'true') {
            try {
                snapshotFile.remove();
            } catch (error) {
                jobHelper.logFileError(snapshotFile.fullPath, 'Error remove file', error);
                productLogData.processedErrorMessage = 'Error remove file';
                algoliaData.setLogData('LastProductSyncLog', productLogData);
                snapshotFileWriter.close();
                snapshotXmlWriter.close();
                updateFileWriter.close();
                updateXmlWriter.close();
                return new Status(Status.ERROR);
            }
        } else {
            snapshotReadIterator = fileReadIterator.create(algoliaConstants.SNAPSHOT_PRODUCTS_FILE_NAME, 'product');
            if (empty(snapshotReadIterator)) {
                productLogData.processedErrorMessage = 'Error open Snapshot file or read';
                algoliaData.setLogData('LastProductSyncLog', productLogData);
                snapshotFileWriter.close();
                snapshotXmlWriter.close();
                updateFileWriter.close();
                updateXmlWriter.close();
                return new Status(Status.ERROR);
            }
        }
    }

    var productsIterator = ProductMgr.queryAllSiteProductsSorted();
    var newProductModel = jobHelper.getNextProductModel(productsIterator);
    var snapshotToUpdate = true;
    var productSnapshot = snapshotReadIterator && snapshotReadIterator.hasNext() ? snapshotReadIterator.next() : null;

    while (newProductModel || productSnapshot) {
        var productUpdate = null;

        // Write product to Snapshot file
        if (snapshotToUpdate && newProductModel) {
            try {
                jobHelper.writeObjectToXMLStream(snapshotXmlWriter, newProductModel);
            } catch (error) {
                jobHelper.logFileError(newSnapshotFile.fullPath, 'Error write to file', error);
                productLogData.processedErrorMessage = 'Error write to file';
                algoliaData.setLogData('LastProductSyncLog', productLogData);
                snapshotFileWriter.close();
                snapshotXmlWriter.close();
                updateFileWriter.close();
                updateXmlWriter.close();
                productsIterator.close();
                if (snapshotReadIterator) {
                    snapshotReadIterator.close();
                }
                return new Status(Status.ERROR);
            }
            snapshotToUpdate = false;
            counterProductsTotal += 1;
        }

        if (newProductModel && !productSnapshot) {
            // Add product to delta
            productUpdate = new jobHelper.UpdateProductModel(newProductModel);
            newProductModel = jobHelper.getNextProductModel(productsIterator);
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
                        // Update primary category_id if categories has updated
                        if (Object.hasOwnProperty.call(deltaObject, 'categories')) {
                            deltaObject.primary_category_id = newProductModel.primary_category_id;
                        }
                        deltaObject.id = newProductModel.id;
                        productUpdate = new jobHelper.UpdateProductModel(deltaObject);
                        productUpdate.options.partial = true;
                    }
                } else {
                    // Rewrite product completely
                    productUpdate = new jobHelper.UpdateProductModel(newProductModel);
                }
                productSnapshot = snapshotReadIterator && snapshotReadIterator.hasNext() ? snapshotReadIterator.next() : null;
                newProductModel = jobHelper.getNextProductModel(productsIterator);
                snapshotToUpdate = true;
            } else if (newProductModel.id < productSnapshot.id) {
                // Add product to delta
                productUpdate = new jobHelper.UpdateProductModel(newProductModel);
                newProductModel = jobHelper.getNextProductModel(productsIterator);
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
                jobHelper.writeObjectToXMLStream(updateXmlWriter, productUpdate);
            } catch (error) {
                jobHelper.logFileError(updateFile.fullPath, 'Error write to file', error);
                productLogData.processedErrorMessage = 'Error write to file';
                algoliaData.setLogData('LastProductSyncLog', productLogData);
                snapshotFileWriter.close();
                snapshotXmlWriter.close();
                updateFileWriter.close();
                updateXmlWriter.close();
                productsIterator.close();
                if (snapshotReadIterator) {
                    snapshotReadIterator.close();
                }
                return new Status(Status.ERROR);
            }
            counterProductsForUpdate += 1;
        }
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
    jobHelper.logFileInfo(updateFile.fullPath, 'Records for update ' + counterProductsForUpdate + ' records');

    productLogData.processedDate = algoliaData.getLocalDateTime(new Date());
    productLogData.processedError = false;
    productLogData.processedErrorMessage = '';
    productLogData.processedRecords = counterProductsTotal;
    productLogData.processedToUpdateRecords = counterProductsForUpdate;
    algoliaData.setLogData('LastProductSyncLog', productLogData);

    return new Status(Status.OK);
}

module.exports.execute = runProductExport;
