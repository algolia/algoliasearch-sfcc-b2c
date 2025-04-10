'use strict';

let Logger = require('dw/system/Logger');
let Status = require('dw/system/Status');

let jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
let algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
let reindexHelper = require('*/cartridge/scripts/algolia/helper/reindexHelper');
let productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');
let AlgoliaLocalizedProduct = require('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct');

let orderHelper = require('*/cartridge/scripts/algolia/helper/orderHelper');
let isInStoreStock = productFilter.isInStoreStock;
let generateAlgoliaOperations = orderHelper.generateAlgoliaOperations;

let RECORD_MODEL_TYPE = {
    MASTER_LEVEL: 'master-level',
    VARIANT_LEVEL: 'variant-level'
};

/**
 * Creates the necessary configuration for a product based on the record model type.
 * 
 * @param {dw.catalog.Product} product - The product to create config for.
 * @param {string} recordModel - The type of record model.
 * @returns {Object} Configuration object to pass to generateAlgoliaOperations.
 */
function createProductConfig(product, recordModel) {
    let attributesConfig = jobHelper.getAttributes();
    let productConfig = {};
    
    if (recordModel === RECORD_MODEL_TYPE.MASTER_LEVEL && product.master) {
        // Master product configuration
        productConfig.baseModel = new AlgoliaLocalizedProduct({
            product: product,
            locale: 'default',
            attributeList: attributesConfig.nonLocalizedMasterAttributes
        });
        productConfig.variantAttributes = attributesConfig.variantAttributes;
        productConfig.attributeList = attributesConfig.masterAttributes;
    } else if (recordModel === RECORD_MODEL_TYPE.MASTER_LEVEL && !product.master) {
        // Variant product, but we're using master-level indexing
        let masterProduct = product.masterProduct;
        productConfig.baseModel = new AlgoliaLocalizedProduct({
            product: masterProduct,
            locale: 'default',
            attributeList: attributesConfig.nonLocalizedMasterAttributes
        });
        productConfig.variantAttributes = attributesConfig.variantAttributes;
        productConfig.attributeList = attributesConfig.masterAttributes;
    } else {
        // Variant-level indexing for variant product
        productConfig.baseModel = new AlgoliaLocalizedProduct({
            product: product,
            locale: 'default',
            attributeList: attributesConfig.variantAttributes
        });
    }
    
    return productConfig;
}

/**
 * Hook function that executes after an order is created (POST).
 *
 * @param {dw.order.Order} order - The newly created order instance.
 * @returns {dw.system.Status} Status
 */
exports.afterPOST = function (order) {
    let ALGOLIA_IN_STOCK_THRESHOLD = algoliaData.getPreference('InStockThreshold');
    let RECORD_MODEL = algoliaData.getPreference('RecordModel');
    let additionalAttributes = algoliaData.getSetOfArray('AdditionalAttributes');

    try {
        let algoliaOperations = [];
        let shipments = order.getShipments();

        for (let i = 0; i < shipments.length; i++) {
            let shipment = shipments[i];
            
            if (shipment.custom.shipmentType === 'instore') {
                algoliaOperations = algoliaOperations.concat(
                    handleInStorePickupShipment(
                        shipment,
                        ALGOLIA_IN_STOCK_THRESHOLD,
                        additionalAttributes,
                        RECORD_MODEL
                    )
                );
            } else {
                algoliaOperations = algoliaOperations.concat(
                    handleStandardShipment(
                        shipment,
                        ALGOLIA_IN_STOCK_THRESHOLD,
                        additionalAttributes,
                        RECORD_MODEL
                    )
                );
            }
        }

        if (algoliaOperations.length > 0) {
            reindexHelper.sendRetryableBatch(algoliaOperations);
        }
    } catch (error) {
        Logger.error(
            'Error in afterPOST hook for Order: ' + order.orderNo +
            ', Message: ' + error.message +
            ', Stack: ' + error.stack
        );
    }

    return new Status(Status.OK);
};

/**
 * Handles logic for updating Algolia records for an in-store pickup shipment.
 *
 * @param {dw.order.Shipment} shipment - The shipment object to process.
 * @param {number} threshold - The in-stock threshold preference.
 * @param {Array} additionalAttributes - A list of additional attributes to manage.
 * @param {string} recordModel - The type of record model (master-level or variant-level).
 * @returns {Array} An array of Algolia operations to be executed.
 */
function handleInStorePickupShipment(shipment, threshold, additionalAttributes, recordModel) {
    let algoliaOperations = [];
    let plis = shipment.getProductLineItems();

    for (let j = 0; j < plis.length; j++) {
        let pli = plis[j];
        let product = pli.product;
        let storeId = shipment.custom.fromStoreId;

        let inStoreStock = isInStoreStock(product, storeId, threshold);
        if (!inStoreStock && additionalAttributes.indexOf('storeAvailability') > -1) {
            if (recordModel === RECORD_MODEL_TYPE.MASTER_LEVEL) {
                let masterProduct = product.masterProduct;
                let productConfig = createProductConfig(masterProduct, recordModel);

                productConfig.attributeList = ['variants'];
                productConfig.product = masterProduct;

                let productOps = generateAlgoliaOperations(productConfig);
                algoliaOperations = algoliaOperations.concat(productOps);
            } else {
                let productConfig = createProductConfig(product, recordModel);
                productConfig.attributeList = ['storeAvailability'];
                productConfig.product = product;
                let productOps = generateAlgoliaOperations(productConfig);
                algoliaOperations = algoliaOperations.concat(productOps);
            }
        }
    }
    return algoliaOperations;
}

/**
 * Handles logic for updating Algolia records for a standard shipment.
 *
 * @param {dw.order.Shipment} shipment - The shipment object to process.
 * @param {number} threshold - The in-stock threshold preference.
 * @param {Array} additionalAttributes - A list of additional attributes to manage.
 * @param {string} recordModel - The type of record model (master-level or variant-level).
 * @returns {Array} An array of Algolia operations to be executed.
 */
function handleStandardShipment(shipment, threshold, additionalAttributes, recordModel) {
    let algoliaOperations = [];
    let plis = shipment.getProductLineItems();

    for (let j = 0; j < plis.length; j++) {
        let pli = plis[j];
        let product = pli.product;

        let isInStock = productFilter.isInStock(product, threshold);
        if (!isInStock) {
            let indexOutOfStock = algoliaData.getPreference('IndexOutOfStock');

            if (indexOutOfStock) {
                if (recordModel === RECORD_MODEL_TYPE.MASTER_LEVEL) {
                    let masterProduct = product.masterProduct;
                    let attrArray = ['variants'];
                    if (additionalAttributes.indexOf('in_stock') > -1) {
                        attrArray.push('in_stock');
                    }
                    
                    let productConfig = createProductConfig(masterProduct, recordModel);
                    productConfig.attributeList = attrArray;
                    productConfig.product = masterProduct;

                    let productOps = generateAlgoliaOperations(productConfig);
                    algoliaOperations = algoliaOperations.concat(productOps);
                } else {
                    let productConfig = createProductConfig(product, recordModel);
                    productConfig.attributeList = ['in_stock'];
                    productConfig.product = product;

                    let productOps = generateAlgoliaOperations(productConfig);
                    algoliaOperations = algoliaOperations.concat(productOps);
                }
            } else {
                let baseProduct = product;
                let attrArray = ['in_stock', 'variants'];
                if (recordModel === RECORD_MODEL_TYPE.MASTER_LEVEL) {
                    baseProduct = product.masterProduct;
                    attrArray = ['variants'];
                }
                let productConfig = createProductConfig(baseProduct, recordModel);
                productConfig.attributeList = attrArray;
                productConfig.product = baseProduct;

                let productOps = generateAlgoliaOperations(productConfig);

                if (recordModel === RECORD_MODEL_TYPE.MASTER_LEVEL) {
                    let isMasterInStock = productFilter.isInStock(baseProduct, threshold);
                    if (!isMasterInStock) {
                        productOps.forEach(function(productOp) {
                            algoliaOperations = algoliaOperations.concat(
                                new jobHelper.AlgoliaOperation(
                                    'deleteObject',
                                    { objectID: productOp.body.objectID },
                                    productOp.indexName
                                )
                            );
                        });
                    } else {
                        algoliaOperations = algoliaOperations.concat(productOps);
                    }
                } else {
                    productOps.forEach(function(productOp) {
                        algoliaOperations = algoliaOperations.concat(
                            new jobHelper.AlgoliaOperation(
                                'deleteObject',
                                { objectID: productOp.body.objectID },
                                productOp.indexName
                            )
                        );
                    });
                }
            }
        }
    }
    return algoliaOperations;
}
