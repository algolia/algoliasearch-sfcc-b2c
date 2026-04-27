const GlobalMock = require('../../../../../mocks/global');
global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

const mockSetJobInfo = jest.fn();
const mockSendMultiIndexBatch = jest.fn().mockReturnValue({ ok: true });
jest.mock('*/cartridge/scripts/algoliaIndexingAPI', () => {
    return {
        setJobInfo: mockSetJobInfo,
        sendMultiIndexBatch: mockSendMultiIndexBatch,
        pushByIndexName: jest.fn(),
    }
}, {virtual: true});
const mockGroupRecordsForIngestionAPI = jest.fn();
const mockSendGroupedIngestionAPIRecords = jest.fn();
jest.mock('*/cartridge/scripts/algolia/helper/requestHelper', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/requestHelper');
    return {
        sendRetryableBatch: originalModule.sendRetryableBatch,
        groupRecordsForIngestionAPI: mockGroupRecordsForIngestionAPI,
        sendGroupedIngestionAPIRecords: mockSendGroupedIngestionAPIRecords,
    }
}, {virtual: true});

let mockLocalesForIndexing;
jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaData');
    return {
        ...originalModule,
        getSetOfArray: function (id) {
            switch (id) {
                case 'AdditionalAttributes':
                    return ['url', 'UPC', 'searchable', 'variant', 'color', 'refinementColor', 'size', 'refinementSize', 'brand', 'online', 'pageDescription', 'pageKeywords',
                        'pageTitle', 'short_description', 'name', 'long_description', 'image_groups'];
                case 'LocalesForIndexing':
                    return mockLocalesForIndexing;
                default:
                    return [];
            }
        },
        getAlgoliaSitePreferences: jest.fn(),
    }
}, {virtual: true});

const parameters = {
    consumer: 'algolia',
    deltaExportJobName: 'productDeltaExport',
    indexingMethod: 'fullRecordUpdate',
    failureThresholdPercentage: 5,
};

const stepExecution = {
    getJobExecution: () => {
        return {
            getJobID: () => 'TestJobID',
        }
    },
    getStepID: () => 'TestStepID',
};

const algoliaLocalizedProduct = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedProduct');
const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/steps/algoliaProductDeltaIndex');

beforeEach(() => {
    mockLocalesForIndexing = [];
    mockGroupRecordsForIngestionAPI.mockReset();
    mockSendGroupedIngestionAPIRecords.mockReset();
    delete global.customPreferences['Algolia_IndexingAPI'];
    delete global.customPreferences['Algolia_AnalyticsRegion'];
});

describe('beforeStep', () => {
    test('locales for indexing', () => {
        job.beforeStep(parameters, stepExecution);
        expect(job.__getLocalesForIndexing()).toStrictEqual(['default', 'fr', 'en']);

        mockLocalesForIndexing = ['fr'];
        job.beforeStep(parameters, stepExecution);
        expect(job.__getLocalesForIndexing()).toStrictEqual(['fr']);

        mockLocalesForIndexing = ['fr_FR'];
        expect(() =>  job.beforeStep(parameters, stepExecution))
            .toThrow(new Error('Locale "fr_FR" is not enabled on Name of the Test-Site'));

        // Job-step level overrides the global custom preference
        mockLocalesForIndexing = ['fr'];
        job.beforeStep({ localesForIndexing: 'en, fr', ...parameters }, stepExecution);
        expect(job.__getLocalesForIndexing()).toStrictEqual(['en', 'fr']);
    });

    test('Ingestion API with invalid AnalyticsRegion throws', () => {
        global.customPreferences['Algolia_IndexingAPI'] = 'ingestion-api';
        global.customPreferences['Algolia_AnalyticsRegion'] = 'invalid';
        expect(() => job.beforeStep(parameters, stepExecution))
            .toThrow('You need to define a valid Analytics region');
    });

    test('Ingestion API with missing AnalyticsRegion throws', () => {
        global.customPreferences['Algolia_IndexingAPI'] = 'ingestion-api';
        expect(() => job.beforeStep(parameters, stepExecution))
            .toThrow('You need to define a valid Analytics region');
    });

    test('Ingestion API with valid AnalyticsRegion does not throw', () => {
        global.customPreferences['Algolia_IndexingAPI'] = 'ingestion-api';
        global.customPreferences['Algolia_AnalyticsRegion'] = 'us';
        expect(() => job.beforeStep(parameters, stepExecution)).not.toThrow();
    });
});

describe('process', () => {
    test('default', () => {
        job.beforeStep(parameters, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({
            jobID: 'TestJobID',
            stepID: 'TestStepID',
            indexingMethod: 'fullRecordUpdate',
            indexingAPI: 'search-api'
        });
        var algoliaOperations = job.process({productID: '701644031206M', available: true});
        expect(algoliaOperations).toMatchSnapshot();
    });

    test('master-level indexing', () => {
        global.customPreferences['Algolia_RecordModel'] = 'master-level';
        job.beforeStep(parameters, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({
            jobID: 'TestJobID',
            stepID: 'TestStepID',
            indexingMethod: 'fullRecordUpdate',
            indexingAPI: 'search-api'
        });
        var algoliaOperations = job.process({productID: '25592581M', available: true});
        expect(algoliaOperations).toMatchSnapshot();
    });

    test('attribute-sliced indexing', () => {
        global.customPreferences['Algolia_RecordModel'] = 'attribute-sliced';
        global.customPreferences['Algolia_AttributeSlicedRecordModel_GroupingAttribute'] = 'color';
        mockLocalesForIndexing = ['fr']
        job.beforeStep(parameters, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({
            jobID: 'TestJobID',
            stepID: 'TestStepID',
            indexingMethod: 'fullRecordUpdate',
            indexingAPI: 'search-api'
        });
        var algoliaOperations = job.process({productID: '25592581M', available: true});
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('attribute-sliced indexing - out of stock', () => {
        global.customPreferences['Algolia_RecordModel'] = 'attribute-sliced';
        mockLocalesForIndexing = ['fr']
        algoliaLocalizedProduct.__setThreshold(7); // Default mock variant has an ATS of 6
        job.beforeStep(parameters, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({
            jobID: 'TestJobID',
            stepID: 'TestStepID',
            indexingMethod: 'fullRecordUpdate',
            indexingAPI: 'search-api'
        });
        var algoliaOperations = job.process({productID: '25592581M', available: true});
        expect(algoliaOperations).toMatchSnapshot();
    });
});

describe('send', () => {
    function makeChunk(count) {
        const algoliaOperationsChunk = [];
        for (let i = 0; i < count; ++i) {
            const ops = [
                { action: 'addObject', indexName: 'test_en', body: { id: String(i) } },
                { action: 'addObject', indexName: 'test_fr', body: { id: String(i) } },
            ];
            ops.toArray = function () { return ops; };
            algoliaOperationsChunk.push(ops);
        }
        algoliaOperationsChunk.toArray = function () { return algoliaOperationsChunk; };
        return algoliaOperationsChunk;
    }

    test('Search API - sends multi-index batch', () => {
        job.beforeStep(parameters, stepExecution);
        job.__setIndexingAPI(job.__INDEXING_APIS.SEARCH_API);

        const chunk = makeChunk(3);
        job.send(chunk);

        expect(mockSendMultiIndexBatch).toHaveBeenCalledWith(chunk.flat());
    });

    test('Ingestion API - calls groupRecordsForIngestionAPI and sendGroupedIngestionAPIRecords', () => {
        job.beforeStep(parameters, stepExecution);
        job.__setIndexingAPI(job.__INDEXING_APIS.INGESTION_API);

        const grouped = { 'test_en': { 'addObject': [{ id: '0' }, { id: '1' }] } };
        mockGroupRecordsForIngestionAPI.mockReturnValue(grouped);
        mockSendGroupedIngestionAPIRecords.mockReturnValue({
            result: { ok: true, object: { body: {} } },
            failedRecords: 0,
            sentRecords: 4,
        });

        const chunk = makeChunk(2);
        job.send(chunk);

        expect(mockGroupRecordsForIngestionAPI).toHaveBeenCalledWith(chunk.flat());
        expect(mockSendGroupedIngestionAPIRecords).toHaveBeenCalledWith(grouped);
        expect(job.__getJobReport().recordsSent).toBe(4);
        expect(job.__getJobReport().chunksSent).toBeGreaterThan(0);
    });

    // Parity with the Search API: chunksSent++ whenever the transport accepted any records;
    // failureThresholdPercentage in afterStep owns the overall pass/fail decision.
    test('Ingestion API - partial failure counts the chunk as sent, not failed', () => {
        job.beforeStep(parameters, stepExecution);
        job.__setIndexingAPI(job.__INDEXING_APIS.INGESTION_API);

        mockGroupRecordsForIngestionAPI.mockReturnValue({});
        mockSendGroupedIngestionAPIRecords.mockReturnValue({
            result: { ok: false },
            failedRecords: 2,
            sentRecords: 2,
        });

        const chunk = makeChunk(2);
        job.send(chunk);

        expect(job.__getJobReport().recordsFailed).toBe(2);
        expect(job.__getJobReport().recordsSent).toBe(2);
        expect(job.__getJobReport().chunksSent).toBe(1);
        expect(job.__getJobReport().chunksFailed).toBe(0);
    });

    test('Ingestion API - does not pass indexingMethod (no fullCatalogReindex in delta)', () => {
        job.beforeStep(parameters, stepExecution);
        job.__setIndexingAPI(job.__INDEXING_APIS.INGESTION_API);

        mockGroupRecordsForIngestionAPI.mockReturnValue({});
        mockSendGroupedIngestionAPIRecords.mockReturnValue({
            result: { ok: true, object: { body: {} } },
            failedRecords: 0,
            sentRecords: 2,
        });

        job.send(makeChunk(1));

        expect(mockSendGroupedIngestionAPIRecords).toHaveBeenCalledWith({});
    });
});

describe('afterStep', () => {
    beforeAll(() => {
        job.beforeStep(parameters, stepExecution);
    });

    describe('partialRecordUpdate', () => {
        test('failurePercentage <= failureThresholdPercentage', () => {
            job.__getJobReport().recordsFailed = 5;
            job.__getJobReport().recordsToSend = 100;
            job.afterStep(true);
            expect(job.__getJobReport().error).toBe(false);
        });
        test('failurePercentage > failureThresholdPercentage', () => {
            job.__getJobReport().recordsFailed = 6;
            job.__getJobReport().recordsToSend = 100;
            const expectedErrorMsg = 'The percentage of records that failed to be indexed (6%) exceeds the failureThresholdPercentage (5%). Check the logs for details.';
            expect(() => job.afterStep(true)).toThrow(new Error(expectedErrorMsg));
            expect(job.__getJobReport().error).toBe(true);
            expect(job.__getJobReport().errorMessage).toBe(expectedErrorMsg);
        });
    })
});
