const GlobalMock = require('../../../../../mocks/global');
const MasterVariantMock = require('../../../../../mocks/dw/catalog/MasterProduct');
const VariantMock = require('../../../../../mocks/dw/catalog/Variant');
const ProductMgrMock = require('dw/catalog/ProductMgr');

const imagesMocks = require('../../../../../mocks/data/images');

global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

jest.mock('*/cartridge/scripts/algolia/helper/logHelper', () => {}, {virtual: true});
const mockDeleteTemporaryIndices = jest.fn();
const mockCopySettingsFromProdIndices = jest.fn();
const mockMoveTemporaryIndices = jest.fn();
const mockFinishAtomicReindex = jest.fn();
jest.mock('*/cartridge/scripts/algolia/helper/reindexHelper', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/reindexHelper');
    return {
        sendRetryableBatch: originalModule.sendRetryableBatch,
        deleteTemporaryIndices: mockDeleteTemporaryIndices,
        copySettingsFromProdIndices: mockCopySettingsFromProdIndices,
        moveTemporaryIndices: mockMoveTemporaryIndices,
        finishAtomicReindex: mockFinishAtomicReindex,
        waitForTasks: jest.fn(),
    };
}, {virtual: true});

jest.mock('*/cartridge/scripts/services/algoliaIndexingService', () => {}, {virtual: true});

const mockSetJobInfo = jest.fn();
const mockSendMultiIndexBatch = jest.fn().mockReturnValue({
    ok: true,
    object: {
        body: {
            taskID: {
                test_index_fr: 42,
                test_index_en: 51,
            }
        }
    }
});
jest.mock('*/cartridge/scripts/algoliaIndexingAPI', () => {
    return {
        setJobInfo: mockSetJobInfo,
        sendMultiIndexBatch: mockSendMultiIndexBatch,
    }
}, {virtual: true});

let mockAdditionalAttributes;
let mockLocalesForIndexing;
jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaData');
    return {
        ...originalModule,
        getSetOfArray: function (id) {
            switch (id) {
                case 'AdditionalAttributes':
                    return mockAdditionalAttributes;
                case 'LocalesForIndexing':
                    return mockLocalesForIndexing;
                default:
                    return [];
            }
        },
    }
}, {virtual: true});

const stepExecution = {
    getJobExecution: () => {
        return {
            getJobID: () => 'TestJobID',
        }
    },
    getStepID: () => 'TestStepID',
};

const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/steps/algoliaProductIndex');
const collectionHelper = require('../../../../../mocks/helpers/collectionHelper');

beforeEach(() => {
    global.customPreferences['Algolia_RecordModel'] = 'variant-level';
    mockAdditionalAttributes = ['url', 'UPC', 'searchable', 'variant', 'color', 'refinementColor', 'size', 'refinementSize', 'brand', 'online', 'pageDescription', 'pageKeywords',
        'pageTitle', 'short_description', 'name', 'long_description', 'image_groups'];
    mockLocalesForIndexing = [];
});

describe('beforeStep', () => {
    test('defaultAttributes', () => {
        mockAdditionalAttributes = [];
        job.beforeStep({}, stepExecution);
        expect(job.__getAttributesToSend()).toStrictEqual(['name', 'categoryPageId',
            '__primary_category', 'in_stock', 'price', 'image_groups', 'url']);
    });
    test('no duplicated attributes', () => {
        mockAdditionalAttributes = ['name'];
        job.beforeStep({}, stepExecution);
        expect(job.__getAttributesToSend()).toStrictEqual(['name', 'categoryPageId',
            '__primary_category', 'in_stock', 'price', 'image_groups', 'url']);
    });
    test('locales for indexing', () => {
        job.beforeStep({}, stepExecution);
        expect(job.__getLocalesForIndexing()).toStrictEqual(['default', 'fr', 'en']);

        mockLocalesForIndexing = ['fr'];
        job.beforeStep({}, stepExecution);
        expect(job.__getLocalesForIndexing()).toStrictEqual(['fr']);

        mockLocalesForIndexing = ['fr_FR'];
        expect(() =>  job.beforeStep({}, stepExecution))
            .toThrow(new Error('Locale "fr_FR" is not enabled on Name of the Test-Site'));

        // Job-step level overrides the global custom preference
        mockLocalesForIndexing = ['fr'];
        job.beforeStep({ localesForIndexing: 'en, fr' }, stepExecution);
        expect(job.__getLocalesForIndexing()).toStrictEqual(['en', 'fr']);
    });
});

describe('process', () => {
    test('default', () => {
        job.beforeStep({}, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID', indexingMethod: 'partialRecordUpdate' });
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();

        const variant = new VariantMock({ variationAttributes: { color: 'JJB52A0', size: '004' } });
        var algoliaOperations = job.process(variant);
        expect(algoliaOperations).toMatchSnapshot(); //  "action" should be "partialUpdateObject" when no indexingMethod is specified
    });
    test('partialRecordUpdate', () => {
        job.beforeStep({ indexingMethod: 'partialRecordUpdate' }, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID', indexingMethod: 'partialRecordUpdate' });
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();

        const variant = new VariantMock({ variationAttributes: { color: 'JJB52A0', size: '004' } });
        var algoliaOperations = job.process(variant);
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('fullRecordUpdate', () => {
        job.beforeStep({ indexingMethod: 'fullRecordUpdate' }, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID', indexingMethod: 'fullRecordUpdate' });
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();
        expect(mockDeleteTemporaryIndices).not.toHaveBeenCalled();

        const variant = new VariantMock({ variationAttributes: { color: 'JJB52A0', size: '004' } });
        var algoliaOperations = job.process(variant);
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('fullCatalogReindex', () => {
        job.beforeStep({ indexingMethod: 'fullCatalogReindex' }, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID', indexingMethod: 'fullCatalogReindex' });
        expect(mockDeleteTemporaryIndices).toHaveBeenCalledWith(
            'products',
            expect.arrayContaining(['default', 'fr', 'en'])
        );

        const variant = new VariantMock({ variationAttributes: { color: 'JJB52A0', size: '004' } });
        var algoliaOperations = job.process(variant);
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('colorVariations', () => {
        // Process a master product with two size variations on the same color variation
        mockAdditionalAttributes = ['colorVariations'];

        const masterProduct = new MasterVariantMock();
        const variantPinkSize4 = new VariantMock({
            ID: '701644031206M',
            variationAttributes: { color: 'JJB52A0', size: '004' },
            masterProduct,
        });
        const variantPinkSize6 = new VariantMock({
            ID: '701644031213M',
            variationAttributes: { color: 'JJB52A0', size: '006' },
            masterProduct,
        });
        masterProduct.variants = collectionHelper.createCollection([
            variantPinkSize4,
            variantPinkSize6,
        ]);

        job.beforeStep({ indexingMethod: 'fullCatalogReindex' }, stepExecution);

        const algoliaOperations = job.process(masterProduct);
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('master-level indexing', () => {
        global.customPreferences['Algolia_RecordModel'] = 'master-level';
        mockAdditionalAttributes = [];

        // Process a master product with two size variations on the same color variation
        const masterProduct = new MasterVariantMock();
        const variantPinkSize4 = new VariantMock({
            ID: '701644031206M',
            variationAttributes: { color: 'JJB52A0', size: '004' },
            masterProduct,
        });
        const variantPinkSize6 = new VariantMock({
            ID: '701644031213M',
            variationAttributes: { color: 'JJB52A0', size: '006' },
            masterProduct,
        });
        masterProduct.variants = collectionHelper.createCollection([
            variantPinkSize4,
            variantPinkSize6,
        ]);

        job.beforeStep({ indexingMethod: 'fullCatalogReindex' }, stepExecution);

        const algoliaOperations = job.process(masterProduct);
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('attribute-sliced indexing', () => {
        global.customPreferences['Algolia_RecordModel'] = 'attribute-sliced';
        global.customPreferences['Algolia_AttributeSlicedRecordModel_GroupingAttribute'] = 'color';
        mockAdditionalAttributes = [];
        mockLocalesForIndexing = ['en'];

        // Process a master product with two color variations and two size variations
        const masterProduct = new MasterVariantMock({
            variants: [
                new VariantMock({
                    ID: '701644031206M',
                    variationAttributes: { color: 'JJB52A0', size: '004' },
                }),
                new VariantMock({
                    ID: '701644031213M',
                    variationAttributes: { color: 'JJB52A0', size: '006' },
                }),
                new VariantMock({
                    ID: '701644031220M',
                    variationAttributes: { color: 'JJC05A0', size: '004' },
                    images: imagesMocks['JJC05A0'],
                }),
                new VariantMock({
                    ID: '701644031237M',
                    variationAttributes: { color: 'JJC05A0', size: '006' },
                    images: imagesMocks['JJC05A0'],
                })
            ]
        });

        job.beforeStep({ indexingMethod: 'fullCatalogReindex' }, stepExecution);

        const algoliaOperations = job.process(masterProduct);
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('attribute-sliced indexing - product without variation attribute', () => {
        global.customPreferences['Algolia_RecordModel'] = 'attribute-sliced';
        mockAdditionalAttributes = ['size'];
        mockLocalesForIndexing = ['en'];

        // Process a master product with two color variations and two size variations
        const masterProduct = new MasterVariantMock({
            variants: [
                new VariantMock({
                    ID: '701644031206M',
                    variationAttributes: { size: '004' },
                }),
                new VariantMock({
                    ID: '701644031213M',
                    variationAttributes: { size: '006' },
                }),
            ]
        });

        job.beforeStep({ indexingMethod: 'fullCatalogReindex' }, stepExecution);

        const algoliaOperations = job.process(masterProduct);
        expect(algoliaOperations).toMatchSnapshot();
    });
});

describe('send', () => {
    test('normal batch', () => {
        job.beforeStep({}, stepExecution);

        const algoliaOperationsChunk = [];
        for (let i = 0; i < 3; ++i) {
            const algoliaOperations = [
                { action: 'addObject', indexName: 'test_en', body: { id: `${i}` } },
                { action: 'addObject', indexName: 'test_fr', body: { id: `${i}` } },
            ];
            algoliaOperations.toArray = function () {
                return algoliaOperations;
            };
            algoliaOperationsChunk.push(algoliaOperations);
        }
        algoliaOperationsChunk.toArray = function () {
            return algoliaOperationsChunk;
        };

        job.send(algoliaOperationsChunk);

        expect(mockSendMultiIndexBatch).toHaveBeenCalledWith(algoliaOperationsChunk.flat());
    });

    test('empty batch', () => {
        job.beforeStep({}, stepExecution);

        const algoliaOperationsChunk = [];
        algoliaOperationsChunk.toArray = function () {
            return algoliaOperationsChunk;
        };
        job.send(algoliaOperationsChunk);

        expect(mockSendMultiIndexBatch).not.toHaveBeenCalled();
    });
});

describe('afterStep', () => {
    beforeAll(() => {
        job.__setLastIndexingTasks({ "test_index_fr": 42, "test_index_en": 51 });
    });

    describe('partialRecordUpdate', () => {
        test('failurePercentage <= failureThresholdPercentage', () => {
            job.beforeStep({ indexingMethod: 'partialRecordUpdate', failureThresholdPercentage: 5 }, stepExecution);
            job.__getJobReport().processedItems = ProductMgrMock.queryAllSiteProducts().count;
            job.__getJobReport().recordsFailed = 5;
            job.__getJobReport().recordsToSend = 100;
            job.afterStep(true);
            expect(mockFinishAtomicReindex).not.toHaveBeenCalled();
            expect(job.__getJobReport().error).toBe(false);
        });
        test('failurePercentage > failureThresholdPercentage', () => {
            job.beforeStep({ indexingMethod: 'partialRecordUpdate', failureThresholdPercentage: 5 }, stepExecution);
            job.__getJobReport().processedItems = ProductMgrMock.queryAllSiteProducts().count;
            job.__getJobReport().recordsFailed = 6;
            job.__getJobReport().recordsToSend = 100;
            const expectedErrorMsg = 'The percentage of records that failed to be indexed (6%) exceeds the failureThresholdPercentage (5%). Check the logs for details.';
            expect(() => job.afterStep(true)).toThrow(new Error(expectedErrorMsg));
            expect(mockFinishAtomicReindex).not.toHaveBeenCalled();
            expect(job.__getJobReport().error).toBe(true);
            expect(job.__getJobReport().errorMessage).toBe(expectedErrorMsg);
        });
    });
    describe('fullCatalogReindex', () => {
        test('failurePercentage <= failureThresholdPercentage', () => {
            job.beforeStep({ indexingMethod: 'fullCatalogReindex', failureThresholdPercentage: 5 }, stepExecution);
            job.__getJobReport().processedItems = ProductMgrMock.queryAllSiteProducts().count;
            job.__getJobReport().recordsFailed = 5;
            job.__getJobReport().recordsToSend = 100;
            job.afterStep(true);
            expect(mockFinishAtomicReindex).toHaveBeenCalledWith(
                'products',
                expect.arrayContaining(['default', 'fr', 'en']),
                {"test_index_fr": 42, "test_index_en": 51}
            );
            expect(job.__getJobReport().error).toBe(false);
        });
        test('failurePercentage > failureThresholdPercentage', () => {
            job.beforeStep({ indexingMethod: 'fullCatalogReindex', failureThresholdPercentage: 5 }, stepExecution);
            job.__getJobReport().processedItems = ProductMgrMock.queryAllSiteProducts().count;
            job.__getJobReport().recordsFailed = 6;
            job.__getJobReport().recordsToSend = 100;
            const expectedErrorMsg = 'The percentage of records that failed to be indexed (6%) exceeds the failureThresholdPercentage (5%). Check the logs for details. Temporary indices were not moved to production.';
            expect(() => job.afterStep(true)).toThrow(new Error(expectedErrorMsg));
            expect(mockFinishAtomicReindex).not.toHaveBeenCalled();
            expect(job.__getJobReport().error).toBe(true);
            expect(job.__getJobReport().errorMessage).toBe(expectedErrorMsg);
        });
        test('processedItems < products.count', () => {
            job.beforeStep({ indexingMethod: 'fullCatalogReindex' }, stepExecution);
            job.__getJobReport().processedItems = 1000;
            const expectedProcessedItems = ProductMgrMock.queryAllSiteProducts().count;
            const expectedErrorMsg = `Not all products were processed: 1000 / ${expectedProcessedItems}. Check the logs for details. Temporary indices were not moved to production.`;
            expect(() => job.afterStep(true)).toThrow(new Error(expectedErrorMsg));
            expect(mockFinishAtomicReindex).not.toHaveBeenCalled();
            expect(job.__getJobReport().error).toBe(true);
            expect(job.__getJobReport().errorMessage).toBe(expectedErrorMsg);
        });
    });
    test('job is marked as failed if error in the previous steps', () => {
        job.beforeStep({ indexingMethod: 'partialRecordUpdate' }, stepExecution);
        expect(() => job.afterStep(false)).toThrow();
        expect(mockFinishAtomicReindex).not.toHaveBeenCalled();
        expect(job.__getJobReport().error).toBe(true);
    });
});
