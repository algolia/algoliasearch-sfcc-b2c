'use strict';

var ArrayList = require('dw/util/ArrayList');
var ProductMgr = require('dw/catalog/ProductMgr');
var Site = require('dw/system/Site');
var File = require('dw/io/File'); // eslint-disable-line no-redeclare
var logger;

// job step parameters
var paramConsumer, paramDeltaExportJobName, paramAttributeListOverride, paramIndexingMethod, paramFailureThresholdPercentage, paramLocalesForIndexing;
var recordModel;

// Algolia requires
var algoliaData, AlgoliaLocalizedProduct, algoliaProductConfig, algoliaIndexingAPI, productFilter, CPObjectIterator, AlgoliaJobReport;
var fileHelper, jobHelper, reindexHelper;

// logging-related variables and constants
var jobReport;

var l0_deltaExportDir, l1_processingDir, l1_completedDir, l1_failedDir;
var changedProducts = [], changedProductsIterator;
var deltaExportZips, siteLocales, attributesToSend;
var masterAttributes = [], variantAttributes = [];
var nonLocalizedAttributes = [], nonLocalizedMasterAttributes = [];
var attributesComputedFromBaseProduct = [];

var extendedProductAttributesConfig;

var baseIndexingOperation; // 'addObject' or 'partialUpdateObject', depending on the step parameter 'indexingMethod'
const deleteIndexingOperation = 'deleteObject';
var fullRecordUpdate = false;

const RECORD_MODEL_TYPE = {
    MASTER_LEVEL: 'master-level',
    VARIANT_LEVEL: 'variant-level',
    ATTRIBUTE_SLICED: 'attribute-sliced',
}

// Algolia preferences
var ALGOLIA_IN_STOCK_THRESHOLD;
var INDEX_OUT_OF_STOCK;
var variationAttributeForAttributeSlicedRecordModel; // e.g. "color"

/*
 * Rough algorithm of chunk-oriented script module execution:
 *
 *  counter = 0
 *  beforeStep() - executed before starting the job step, initialization
 *    repeat until counter reaches getTotalCount() {
 *         create new thread {
 *             beforeChunk() - executed before each chunk
 *             read() - repeat until chunkSize, each run reads one product
 *             process() - repeat until chunkSize, each run processes one product
 *             write() - executed one time, sends all products from the chunk at once
 *             counter += chunkSize
 *             afterChunk() - executed after each chunk
 *         }
 *     }
 *     afterStep() - executed after the job step finishes
 */

/**
 * before-step-function (steptypes.json)
 * Any returns from this function result in skipping to the afterStep() function (omitting read-process-writealtogether)
 * with the "success" parameter passed to it set to false.
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
exports.beforeStep = function(parameters, stepExecution) {
    algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
    AlgoliaLocalizedProduct = require('*/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
    algoliaProductConfig = require('*/cartridge/scripts/algolia/lib/algoliaProductConfig');
    jobHelper = require('*/cartridge/scripts/algolia/helper/jobHelper');
    fileHelper = require('*/cartridge/scripts/algolia/helper/fileHelper');
    reindexHelper = require('*/cartridge/scripts/algolia/helper/reindexHelper');
    algoliaIndexingAPI = require('*/cartridge/scripts/algoliaIndexingAPI');
    logger = jobHelper.getAlgoliaLogger();
    productFilter = require('*/cartridge/scripts/algolia/filters/productFilter');

    CPObjectIterator = require('*/cartridge/scripts/algolia/helper/CPObjectIterator');
    AlgoliaJobReport = require('*/cartridge/scripts/algolia/helper/AlgoliaJobReport');

    // Algolia preferences
    ALGOLIA_IN_STOCK_THRESHOLD = algoliaData.getPreference('InStockThreshold');
    INDEX_OUT_OF_STOCK = algoliaData.getPreference('IndexOutOfStock');
    recordModel = algoliaData.getPreference('RecordModel'); // 'variant-level' || 'master-level' || 'attribute-sliced'
    variationAttributeForAttributeSlicedRecordModel = algoliaData.getPreference('AttributeSlicedRecordModel_GroupingAttribute');

    // throw an error if no "Grouping attribute for the Attribute-sliced record model" is defined when using the "Attribute-sliced" record model
    if (recordModel === RECORD_MODEL_TYPE.ATTRIBUTE_SLICED_MASTER_LEVEL && empty(variationAttributeForAttributeSlicedRecordModel)) {
        throw new Error('You need to define a grouping attribute for the Attribute-sliced record model in the Algolia BM module!');
    }

    try {
        extendedProductAttributesConfig = require('*/cartridge/configuration/productAttributesConfig.js');
        logger.info('Configuration file "productAttributesConfig.js" loaded')
    } catch (e) { // eslint-disable-line no-unused-vars
        extendedProductAttributesConfig = {};
    }

    /* --- initializing custom object logging --- */
    jobReport = new AlgoliaJobReport(stepExecution.getJobExecution().getJobID(), 'product');
    jobReport.startTime = new Date();

    /* --- parameters --- */
    paramConsumer = parameters.consumer.trim();
    paramDeltaExportJobName = parameters.deltaExportJobName.trim();
    paramAttributeListOverride = algoliaData.csvStringToArray(parameters.attributeListOverride); // attributeListOverride - pass it along to sending method
    paramIndexingMethod = parameters.indexingMethod || 'fullRecordUpdate'; // 'fullRecordUpdate' (default) or 'partialRecordUpdate'
    paramFailureThresholdPercentage = parameters.failureThresholdPercentage || 0;
    paramLocalesForIndexing = algoliaData.csvStringToArray(parameters.localesForIndexing);

    /* --- B2C delta job parameters --- */
    logger.info('consumer parameter: ' + paramConsumer);
    logger.info('deltaExportJobName parameter: ' + paramDeltaExportJobName);


    /* --- attributeListOverride parameter --- */
    if (empty(paramAttributeListOverride)) {
        variantAttributes = algoliaProductConfig.defaultVariantAttributes_v2.slice();
        masterAttributes = algoliaProductConfig.defaultMasterAttributes_v2.slice();
        attributesToSend = algoliaProductConfig.defaultAttributes_v2.slice();
        const additionalAttributes = algoliaData.getSetOfArray('AdditionalAttributes');
        additionalAttributes.map(function(attribute) {
            if (attributesToSend.indexOf(attribute) < 0) {
                attributesToSend.push(attribute);
            }
        });
    } else {
        attributesToSend = paramAttributeListOverride;
    }
    logger.info('attributeListOverride parameter: ' + paramAttributeListOverride);
    logger.info('Actual attributes to be sent: ' + JSON.stringify(attributesToSend));


    /* --- indexingMethod parameter --- */
    switch (paramIndexingMethod) {
        case 'partialRecordUpdate':
            baseIndexingOperation = 'partialUpdateObject';
            break;
        case 'fullRecordUpdate':
        default:
            baseIndexingOperation = 'addObject';
            fullRecordUpdate = true;
            break;
    }
    logger.info('indexingMethod parameter: ' + paramIndexingMethod);
    logger.info('Record model: ' + recordModel);


    /* --- categorize attributes (master/variant, non-localized, shared) --- */
    attributesToSend.forEach(function(attribute) {
        var attributeConfig = extendedProductAttributesConfig[attribute] ||
            algoliaProductConfig.attributeConfig_v2[attribute] ||
            jobHelper.getDefaultAttributeConfig(attribute);

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

    logger.info('Non-localized attributes: ' + JSON.stringify(nonLocalizedAttributes));
    logger.info('Attributes computed from base product and shared with siblings: ' + JSON.stringify(attributesComputedFromBaseProduct));

    if (recordModel === RECORD_MODEL_TYPE.MASTER_LEVEL || recordModel === RECORD_MODEL_TYPE.ATTRIBUTE_SLICED) {
        logger.info('Master attributes: ' + JSON.stringify(masterAttributes));
        logger.info('Non-localized master attributes: ' + JSON.stringify(nonLocalizedMasterAttributes));
        logger.info('Variant attributes: ' + JSON.stringify(variantAttributes));
    }

    /* --- site locales --- */
    siteLocales = Site.getCurrent().getAllowedLocales();
    logger.info('localesForIndexing parameter: ' + paramLocalesForIndexing);
    const localesForIndexing = paramLocalesForIndexing.length > 0 ?
        paramLocalesForIndexing :
        algoliaData.getSetOfArray('LocalesForIndexing');
    localesForIndexing.forEach(function(locale) {
        if (siteLocales.indexOf(locale) < 0) {
            throw new Error('Locale "' + locale + '" is not enabled on ' + Site.getCurrent().getName());
        }
    })
    if (localesForIndexing.length > 0) {
        siteLocales = new ArrayList(localesForIndexing);
    }
    logger.info('Will index ' + siteLocales.size() + ' locales for ' + Site.getCurrent().getName() + ': ' + siteLocales.toArray());
    jobReport.siteLocales = siteLocales.size();


    algoliaIndexingAPI.setJobInfo({
        jobID: stepExecution.getJobExecution().getJobID(),
        stepID: stepExecution.getStepID(),
        indexingMethod: paramIndexingMethod,
    });

    logger.info('failureThresholdPercentage parameter: ' + paramFailureThresholdPercentage);
    logger.info('Starting Delta export extraction...');

    // ----------------------------- Extracting productIDs from the output of the Delta Export -----------------------------


    var algoliaConstants = require('*/cartridge/scripts/algolia/lib/algoliaConstants');

    // creating working folder (same as the delta export output folder) - if there were no previous changes, the delta export job step won't create it
    l0_deltaExportDir = new File(algoliaConstants.ALGOLIA_DELTA_EXPORT_BASE_FOLDER + paramConsumer + '/' + paramDeltaExportJobName); // Impex/src/platform/outbox/algolia/productDeltaExport

    // return OK if the folder doesn't exist, this means that the CatalogDeltaExport job step finished OK but didn't have any output (there were no changes)
    if (!l0_deltaExportDir.exists()) {
        logger.info('Export directory does not exist (' + l0_deltaExportDir.getFullPath() +
            '). There haven\'t been any changes to the catalog yet or the "consumer" and "deltaExportJobName" parameters do not match for both job steps.')
        return; // return with an empty changedProducts object
    }

    // list all the delta export zips in the folder
    deltaExportZips = fileHelper.getDeltaExportZipList(l0_deltaExportDir);

    // if there are no files to process, there's no point in continuing
    if (empty(deltaExportZips)) {
        logger.info('No delta exports found at ' + l0_deltaExportDir.getFullPath());
        return; // return with an empty changedProducts object
    }
    logger.info('Delta exports found: ' + deltaExportZips);

    // creating empty temporary "_processing" dir
    l1_processingDir = new File(l0_deltaExportDir, '_processing');
    if (l1_processingDir.exists()) {
        fileHelper.removeFolderRecursively(l1_processingDir);
    }
    l1_processingDir.mkdir();

    // creating "_completed" dir
    l1_completedDir = new File(l0_deltaExportDir, '_completed');
    l1_completedDir.mkdir(); // creating "_completed" folder -- does no harm if it already exists

    l1_failedDir = new File(l0_deltaExportDir, '_failed');
    l1_failedDir.mkdir();

    // process each export zip one by one
    deltaExportZips.forEach(function(filename) {
        logger.info('Processing ' + filename + '...');
        var currentZipFile = new File(l0_deltaExportDir, filename); // 000001.zip, 000002.zip, etc.

        // this will create a structure like so: "l0_deltaExportDir/_processing/000001.zip/ebff9c4e-ac8c-4954-8303-8e68ec8b190d/catalogs/...
        var l2_tempZipDir = new File(l1_processingDir, filename);
        if (l2_tempZipDir.mkdir()) { // mkdir() returns a success boolean
            currentZipFile.unzip(l2_tempZipDir);
        }

        // there's a folder with a UUID as a name one level down, we need to open that
        var l3_uuidDir = fileHelper.getFirstChildFolder(l2_tempZipDir); // _processing/000001.zip/ebff9c4e-ac8c-4954-8303-8e68ec8b190d/

        // UUID-named folder has "catalogs" in it, open that
        var l4_catalogsDir = new File(l3_uuidDir, 'catalogs'); // _processing/000001.zip/ebff9c4e-ac8c-4954-8303-8e68ec8b190d/catalogs/

        // -------------------- processing catalog XMLs --------------------

        if (l4_catalogsDir.exists() && l4_catalogsDir.isDirectory()) {

            // getting child catalog folders, there can be more than one - folder name is the ID of the catalog
            var l5_catalogDirList = fileHelper.getChildFolders(l4_catalogsDir);

            // processing catalog.xml files in each folder
            l5_catalogDirList.forEach(function(l5_catalogDir) {

                let catalogFile = new File(l5_catalogDir, 'catalog.xml');

                // adding productsIDs from the XML to the list of changed productIDs
                let result = jobHelper.updateCPObjectFromXML(catalogFile, changedProducts, 'catalog');

                if (result.success) {
                    jobReport.processedItems += result.nrProductsRead;
                } else {
                    // Mark the job in error if an error occurred while reading from any of the delta export zips
                    jobReport.error = true;
                    jobReport.errorMessage = result.errorMessage;
                }
            });
        }

        // cleanup: removing unzipped files that are already processed, along with their parent dirs
        // this removes `l4_catalogsDir`, `version.txt` from `l3_uuidDir`, `l3_uuidDir` and `l2_tempZipDir` itself
        fileHelper.removeFolderRecursively(l2_tempZipDir);
    });

    // cleanup - removing "_processing" dir
    fileHelper.removeFolderRecursively(l1_processingDir);

    if (!jobReport.error) {
        changedProductsIterator = new CPObjectIterator(changedProducts);
        logger.info(jobReport.processedItems + ' updated products found. Starting indexing...');
    } else {
        logger.info('Moving the Delta export files to the "' + l1_failedDir.getName() + '" directory...')
        fileHelper.moveDeltaExportFiles(deltaExportZips, l0_deltaExportDir, l1_failedDir);
    }
}

/**
 * total-count-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {number} total number of products
 */
// eslint-disable-next-line no-unused-vars
exports.getTotalCount = function(parameters, stepExecution) {
    return jobHelper.getObjectsArrayLength(changedProducts);
}

/**
 * read-function (steptypes.json)
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {string} productID
 */
// eslint-disable-next-line no-unused-vars
exports.read = function(parameters, stepExecution) {
    let cpObject;
    if (changedProductsIterator && (cpObject = changedProductsIterator.next()) !== null) {
        return cpObject;
    }
}

/**
 * process-function (steptypes.json)
 * @param {Object} cpObj an object containing the productID and the availability of the product
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 * @returns {Array} an array that contains one AlgoliaOperation per locale:
 *                  [ "action": "addObject", "indexName": "sfcc_products_en_US", body: { "id": "008884303989M", "name": "Fitted Shirt" },
 *                    "action": "addObject", "indexName": "sfcc_products_fr_FR", body: { "id": "008884303989M", "name": "Chemise ajustée" } ]
 */
// eslint-disable-next-line no-unused-vars
exports.process = function(cpObj, parameters, stepExecution) {
    var product = ProductMgr.getProduct(cpObj.productID);

    let algoliaOperations = [];
    let processedVariantsToSend = 0;

    /* --- MAIN LOGIC --- */

    if (!empty(product) && cpObj.available && product.isAssignedToSiteCatalog()) {
        if (recordModel === RECORD_MODEL_TYPE.MASTER_LEVEL) {
            if (product.isVariant()) {
                // This variant will be processed when we handle its master product, skip it for now.
                return [];
            }
            if (product.master) {
                let inStock = productFilter.isInStock(product, ALGOLIA_IN_STOCK_THRESHOLD);

                if ((inStock || INDEX_OUT_OF_STOCK) &&
                    productFilter.isOnline(product) &&
                    productFilter.isSearchable(product) &&
                    productFilter.hasOnlineCategory(product)) {
                    let baseModel = new AlgoliaLocalizedProduct({ product: product, locale: 'default', attributeList: nonLocalizedMasterAttributes });
                    for (let l = 0; l < siteLocales.size(); ++l) {
                        let locale = siteLocales.get(l);
                        let indexName = algoliaData.calculateIndexName('products', locale);
                        let localizedMaster = new AlgoliaLocalizedProduct({
                            product: product,
                            locale: locale,
                            attributeList: masterAttributes,
                            variantAttributes: variantAttributes,
                            baseModel: baseModel,
                        });
                        processedVariantsToSend = localizedMaster.variants ? localizedMaster.variants.length : 0;
                        algoliaOperations.push(new jobHelper.AlgoliaOperation(baseIndexingOperation, localizedMaster, indexName));
                    }
                    jobReport.processedItemsToSend += processedVariantsToSend;
                } else {
                    // => product is out-of-stock and IndexOutOfStock=false, or fails filter criteria => must delete from Algolia
                    for (let l = 0; l < siteLocales.size(); l++) {
                        let locale = siteLocales.get(l);
                        let indexName = algoliaData.calculateIndexName('products', locale);
                        algoliaOperations.push(new jobHelper.AlgoliaOperation(deleteIndexingOperation, { objectID: cpObj.productID }, indexName));
                    }
                    jobReport.processedItemsToSend++;
                }

                jobReport.recordsToSend += algoliaOperations.length;
                return algoliaOperations;
            }
        } else if (recordModel === RECORD_MODEL_TYPE.ATTRIBUTE_SLICED) {
            if (product.isVariant()) {
                // This variant will be processed when we handle its master product, skip it for now.
                return [];
            }

            if (product.master) {
                let variationModel = product.getVariationModel();
                let variationAttribute = variationModel.getProductVariationAttribute(variationAttributeForAttributeSlicedRecordModel);

                // masters that DON'T have the specified variation attribute -- treat them as regular masters
                if (!variationAttribute) {
                    logger.info('Specified variation attribute "' + variationAttributeForAttributeSlicedRecordModel + '" not found for master product "' + product.ID + '", falling back to master-type record.');

                    let inStock = productFilter.isInStock(product, ALGOLIA_IN_STOCK_THRESHOLD);

                    if ((inStock || INDEX_OUT_OF_STOCK) &&
                        productFilter.isOnline(product) &&
                        productFilter.isSearchable(product) &&
                        productFilter.hasOnlineCategory(product)) {
                        let baseModel = new AlgoliaLocalizedProduct({ product: product, locale: 'default', attributeList: nonLocalizedMasterAttributes });
                        for (let l = 0; l < siteLocales.size(); ++l) {
                            let locale = siteLocales.get(l);
                            let indexName = algoliaData.calculateIndexName('products', locale);
                            let localizedMaster = new AlgoliaLocalizedProduct({
                                product: product,
                                locale: locale,
                                attributeList: masterAttributes,
                                variantAttributes: variantAttributes,
                                baseModel: baseModel,
                            });
                            processedVariantsToSend = localizedMaster.variants ? localizedMaster.variants.length : 0;
                            algoliaOperations.push(new jobHelper.AlgoliaOperation(baseIndexingOperation, localizedMaster, indexName));
                        }
                        jobReport.processedItemsToSend += processedVariantsToSend;
                    } else {
                        // => product is out-of-stock and IndexOutOfStock=false, or fails filter criteria => must delete from Algolia
                        for (let l = 0; l < siteLocales.size(); l++) {
                            let locale = siteLocales.get(l);
                            let indexName = algoliaData.calculateIndexName('products', locale);
                            algoliaOperations.push(new jobHelper.AlgoliaOperation(deleteIndexingOperation, { objectID: cpObj.productID }, indexName));
                        }
                        jobReport.processedItemsToSend++;
                    }

                    jobReport.recordsToSend += algoliaOperations.length;
                    return algoliaOperations;
                }

                // masters that have the specified variation attribute
                let recordsPerLocale = jobHelper.generateAttributeSlicedRecords({
                    locales: siteLocales,
                    baseProduct: product,
                    baseProductAttributes: masterAttributes,
                    variantAttributes: variantAttributes,
                    nonLocalizedAttributes: nonLocalizedAttributes,
                    attributesComputedFromBaseProduct: attributesComputedFromBaseProduct,
                    variationAttributeID: variationAttributeForAttributeSlicedRecordModel,
                });

                for (let l = 0; l < siteLocales.size(); ++l) {
                    let locale = siteLocales.get(l);
                    let indexName = algoliaData.calculateIndexName('products', locale);
                    let attributeSlicedRecords = recordsPerLocale[locale];
                    attributeSlicedRecords.forEach(function (record) {
                        if (INDEX_OUT_OF_STOCK || (record.variants && (record.variants.length > 0))) {
                            processedVariantsToSend += record.variants ? record.variants.length : 0;
                            algoliaOperations.push(
                                new jobHelper.AlgoliaOperation(baseIndexingOperation, record, indexName)
                            );
                        } else {
                            // No variants to index - delete the custom variation group record from Algolia
                            logger.info('No more variants in stock for custom variation group ' + record.objectID + ' - will be removed from Algolia index');
                            algoliaOperations.push(
                                new jobHelper.AlgoliaOperation(deleteIndexingOperation, { objectID: record.objectID }, indexName)
                            );
                        }
                    });
                }
                jobReport.processedItemsToSend += processedVariantsToSend;
                jobReport.recordsToSend += algoliaOperations.length;
                return algoliaOperations;
            }

        // VARIANT_LEVEL model, handling products that have common attributes
        } else if (attributesComputedFromBaseProduct.length > 0) {
            // When there are attributes shared in all variants (such as 'colorVariations')
            // we work with the master products. This permits to fetch those attributes only once.
            if (product.isVariant()) {
                // This variant will be processed when we handle its master product, skip it for now.
                return [];
            }

            let recordsPerLocale = jobHelper.generateVariantRecords({
                masterProduct: product,
                locales: siteLocales,
                attributeList: attributesToSend,
                nonLocalizedAttributes: nonLocalizedAttributes,
                attributesComputedFromBaseProduct: attributesComputedFromBaseProduct,
                fullRecordUpdate: fullRecordUpdate,
            });

            for (let l = 0; l < siteLocales.size(); ++l) {
                let locale = siteLocales.get(l);
                let indexName = algoliaData.calculateIndexName('products', locale);
                let records = recordsPerLocale[locale];
                processedVariantsToSend = records.length;

                records.forEach(function (record) {
                    if (INDEX_OUT_OF_STOCK || record.in_stock) {
                        algoliaOperations.push(new jobHelper.AlgoliaOperation(baseIndexingOperation, record, indexName));
                    } else {
                        algoliaOperations.push(new jobHelper.AlgoliaOperation(deleteIndexingOperation, { objectID: record.objectID }, indexName));
                    }
                });

                // Check if we need a delete operation because of product filter because delta jobs are record updates not a full reindex
                let variants = product.variants;
                if (variants && variants.size() > 0) {
                    for (let v = 0; v < variants.size(); ++v) {
                        let variant = variants[v];
                        if (!productFilter.isInclude(variant)) {
                            algoliaOperations.push(new jobHelper.AlgoliaOperation(deleteIndexingOperation, { objectID: variant.getID() }, indexName));
                        }
                    }
                }

                jobReport.processedItemsToSend += processedVariantsToSend;
            }
        }

        // VARIANT_LEVEL indexing logic, masters and their variants are already processed by this point.
        // This block also processes all products not handled above for the other models
        // (MASTER_LEVEL and ATTRIBUTE_SLICED) that are not masters or variants: simple products, option products, product sets, bundles

        let inStock = productFilter.isInStock(product, ALGOLIA_IN_STOCK_THRESHOLD);
        if (productFilter.isInclude(product) && (inStock || INDEX_OUT_OF_STOCK)) {

            // Pre-fetch a partial model containing all non-localized attributes, to avoid re-fetching them for each locale
            let baseModel = new AlgoliaLocalizedProduct({
                product: product,
                locale: 'default',
                attributeList: nonLocalizedAttributes,
                fullRecordUpdate: fullRecordUpdate
            });

            for (let l = 0; l < siteLocales.size(); l++) {
                let locale = siteLocales.get(l);
                let indexName = algoliaData.calculateIndexName('products', locale);

                let localizedProduct;

                if (recordModel === RECORD_MODEL_TYPE.VARIANT_LEVEL) {

                    // for variant-level indexing, generate a flat record where all attributes are at the root level
                    localizedProduct = new AlgoliaLocalizedProduct({
                        product: product,
                        locale: locale,
                        attributeList: attributesToSend,
                        baseModel: baseModel,
                        fullRecordUpdate: fullRecordUpdate
                    });

                } else {
                    // for MASTER_LEVEL and ATTRIBUTE_SLICED, generate records for simple products where variant attributes are pushed to the first and only object of the `variants` array
                    localizedProduct = new AlgoliaLocalizedProduct({
                        product: product,
                        locale: locale,
                        attributeList: masterAttributes,
                        variantAttributes: variantAttributes,
                        baseModel: baseModel,
                        fullRecordUpdate: fullRecordUpdate,
                    });
                }

                algoliaOperations.push(new jobHelper.AlgoliaOperation(baseIndexingOperation, localizedProduct, indexName));
            }
            jobReport.processedItemsToSend++;
        } else {
            // => product or not in stock or fails filter criteria (offline, not searchable, no online categories) => must delete from Algolia
            for (let l = 0; l < siteLocales.size(); l++) {
                let locale = siteLocales.get(l);
                let indexName = algoliaData.calculateIndexName('products', locale);
                algoliaOperations.push(new jobHelper.AlgoliaOperation(deleteIndexingOperation, { objectID: cpObj.productID }, indexName));
            }
            jobReport.processedItemsToSend++;
        }
    } else {
        for (let l = 0; l < siteLocales.size(); l++) {
            let locale = siteLocales.get(l);
            let localeIndexName = algoliaData.calculateIndexName('products', locale);
            algoliaOperations.push(new jobHelper.AlgoliaOperation(deleteIndexingOperation, { objectID: cpObj.productID }, localeIndexName));
        }
        jobReport.processedItemsToSend++;
    }

    jobReport.recordsToSend += algoliaOperations.length; // number of records to be sent to Algolia (one per locale per product)
    return algoliaOperations;
}

/**
 * write-function (steptypes.json)
 * Any returns from this function result in the "success" parameter of "afterStep()" to become false.
 * @param {dw.util.List} algoliaOperations a List containing ${chunkSize} of Algolia operations ready to be sent
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
// eslint-disable-next-line no-unused-vars
exports.send = function(algoliaOperations, parameters, stepExecution) {
    // algoliaOperations contains all returned Algolia operations from process() as a List of arrays
    var algoliaOperationsArray = algoliaOperations.toArray();
    var productCount = algoliaOperationsArray.length;

    var batch = [];
    for (let i = 0; i < productCount; i++) {
        // the array returned by process() is converted to a dw.util.List
        batch = batch.concat(algoliaOperationsArray[i].toArray());
    }

    var retryableBatchRes = reindexHelper.sendRetryableBatch(batch);
    var result = retryableBatchRes.result;
    jobReport.recordsFailed += retryableBatchRes.failedRecords;

    if (result.ok) {
        jobReport.recordsSent += batch.length;
        jobReport.chunksSent++;
    } else {
        jobReport.recordsFailed += batch.length;
        jobReport.chunksFailed++;
    }
}

/**
 * after-step-function (steptypes.json)
 * @param {boolean} success any prior return statements and errors will result in this parameter becoming false
 * @param {dw.util.HashMap} parameters job step parameters
 * @param {dw.job.JobStepExecution} stepExecution contains information about the job step
 */
// eslint-disable-next-line no-unused-vars
exports.afterStep = function(success, parameters, stepExecution) {
    // An exit status cannot be defined for a chunk-oriented script module.
    // Chunk modules always finish with either OK or ERROR.
    // "success" conveys whether an error occurred in any previous chunks or not.
    // Any prior return statements will set success to false (even if it returns Status.OK).

    if (!jobReport.error) {
        const failurePercentage = +((jobReport.recordsFailed / jobReport.recordsToSend * 100).toFixed(2)) || 0;

        if (failurePercentage > paramFailureThresholdPercentage) {
            jobReport.error = true;
            jobReport.errorMessage = 'The percentage of records that failed to be indexed (' + failurePercentage + '%) exceeds the failureThresholdPercentage (' +
                paramFailureThresholdPercentage + '%). Check the logs for details.';
        } else if (jobReport.chunksFailed > 0) {
            jobReport.error = true;
            jobReport.errorMessage = 'Some chunks failed to be sent, check the logs for details.';
        } else if (success) {
            jobReport.error = false;
            jobReport.errorMessage = '';

            // cleanup: after the products have successfully been sent, move the delta zips from which the productIDs have successfully been extracted and the corresponding products sent to "_completed"
            if (!empty(deltaExportZips)) {
                logger.info('Moving the Delta export files to the "_completed" directory...')
                fileHelper.moveDeltaExportFiles(deltaExportZips, l0_deltaExportDir, l1_completedDir);
            }
        } else {
            jobReport.error = true;
            jobReport.errorMessage = 'An error occurred while sending data. Please see the error log for more details.';
        }
    }

    logger.info('Number of productIDs read from B2C delta zips: {0}', jobReport.processedItems);
    logger.info('Number of products marked for sending: {0}', jobReport.processedItemsToSend);
    logger.info('Number of locales configured for the site: {0}', jobReport.siteLocales);
    logger.info('Records sent: {0}; Records failed: {1}', jobReport.recordsSent, jobReport.recordsFailed);
    logger.info('Chunks sent: {0}; Chunks failed: {1}', jobReport.chunksSent, jobReport.chunksFailed);

    jobReport.endTime = new Date();
    jobReport.writeToCustomObject();

    if (!jobReport.error) {
        logger.info('Indexing completed successfully.');
    } else {
        // Showing the job in ERROR in the history
        throw new Error(jobReport.errorMessage);
    }
}

// For testing
exports.__getJobReport = function() {
    return jobReport;
}
exports.__getLocalesForIndexing = function() {
    return siteLocales.toArray();
}
