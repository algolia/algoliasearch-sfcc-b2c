const GlobalMock = require('../../../../../mocks/global');
const ProductMock = require('../../../../../mocks/dw/catalog/Product');

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

const parameters = {
    consumer: 'algolia',
    deltaExportJobName: 'productDeltaExport',
    indexingMethod: 'fullRecordUpdate',
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

test('process', () => {
    job.beforeStep(parameters, stepExecution);
    expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'TestJobID', stepID: 'TestStepID', indexingMethod: 'fullRecordUpdate' });
    var algoliaOperations = job.process({ productID: '701644031206M', available: true });
    expect(algoliaOperations).toMatchSnapshot();
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
