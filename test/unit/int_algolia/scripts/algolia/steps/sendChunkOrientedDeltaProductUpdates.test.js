const GlobalMock = require('../../../../../mocks/global');
const ProductMock = require('../../../../../mocks/dw/catalog/Product');

global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

const mockSetJobInfo = jest.fn();
const mockSendMultiIndicesBatch = jest.fn().mockReturnValue({ ok: true });
jest.mock('*/cartridge/scripts/algoliaIndexingAPI', () => {
    return {
        setJobInfo: mockSetJobInfo,
        sendMultiIndicesBatch: mockSendMultiIndicesBatch,
    }
}, {virtual: true});

const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/steps/sendChunkOrientedDeltaProductUpdates');
const stepExecution = {
    getJobExecution: () => {
        return {
            getJobID: () => 'SendDeltaTestJob',
        }
    },
    getStepID: () => 'sendDeltaTestStep',
}

test('process', () => {
    job.beforeStep({ resourceType: 'test', consumer: 'algolia', deltaExportJobName: 'productDeltaExport' }, stepExecution);
    expect(mockSetJobInfo).toHaveBeenCalledWith({ jobID: 'SendDeltaTestJob', stepID: 'sendDeltaTestStep' });

    var algoliaOperations = job.process({ productID: '701644031206M', available: true });
    expect(algoliaOperations).toMatchSnapshot();
});

test('send', () => {
    job.beforeStep({ resourceType: 'test', consumer: 'algolia', deltaExportJobName: 'productDeltaExport' }, stepExecution);

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

    expect(mockSendMultiIndicesBatch).toHaveBeenCalledWith(algoliaOperationsChunk.flat());
});
