const GlobalMock = require('../../../../../mocks/global');
global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

const mockSetJobInfo = jest.fn();
const mockSendMultiIndexBatch = jest.fn().mockReturnValue({ ok: true });
jest.mock('*/cartridge/scripts/algoliaIndexingAPI', () => {
    return {
        setJobInfo: mockSetJobInfo,
        sendMultiIndexBatch: mockSendMultiIndexBatch,
    }
}, {virtual: true});
jest.mock('*/cartridge/scripts/algolia/helper/reindexHelper', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/reindexHelper');
    return {
        sendRetryableBatch: originalModule.sendRetryableBatch,
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
});

describe('process', () => {
    test('default', () => {
        job.beforeStep(parameters, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({
            jobID: 'TestJobID',
            stepID: 'TestStepID',
            indexingMethod: 'fullRecordUpdate'
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
            indexingMethod: 'fullRecordUpdate'
        });
        var algoliaOperations = job.process({productID: '25592581M', available: true});
        expect(algoliaOperations).toMatchSnapshot();
    });

    test('variation-group-level indexing', () => {
        global.customPreferences['Algolia_RecordModel'] = 'variation-group-level';
        mockLocalesForIndexing = ['fr']
        job.beforeStep(parameters, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({
            jobID: 'TestJobID',
            stepID: 'TestStepID',
            indexingMethod: 'fullRecordUpdate'
        });
        var algoliaOperations = job.process({productID: '25592581M', available: true});
        expect(algoliaOperations).toMatchSnapshot();
    });
    test('variation-group-level indexing - out of stock', () => {
        global.customPreferences['Algolia_RecordModel'] = 'variation-group-level';
        mockLocalesForIndexing = ['fr']
        algoliaLocalizedProduct.__setThreshold(7); // Default mock variant has an ATS of 6
        job.beforeStep(parameters, stepExecution);
        expect(mockSetJobInfo).toHaveBeenCalledWith({
            jobID: 'TestJobID',
            stepID: 'TestStepID',
            indexingMethod: 'fullRecordUpdate'
        });
        var algoliaOperations = job.process({productID: '25592581M', available: true});
        expect(algoliaOperations).toMatchSnapshot();
    });
});

test('send', () => {
    job.beforeStep(parameters, stepExecution);

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
