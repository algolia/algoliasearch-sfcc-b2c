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

jest.mock('*/cartridge/scripts/algolia/helper/objectHelper', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/objectHelper');
    return {
        getAttributeValue: originalModule.getAttributeValue,
        safelyGetCustomAttribute: originalModule.safelyGetCustomAttribute,
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

const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/steps/algoliaProductDeltaIndex');

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
