const GlobalMock = require('../../../../../mocks/global');
const mockContent = require('../../../../../mocks/dw/content/Content');
const mockContentSearchModel = require('../../../../../mocks/dw/content/ContentSearchModel');
const mockJobStepExecution = require('../../../../../mocks/dw/job/JobStepExecution');
const mockHashMap = require('../../../../../mocks/dw/util/HashMap');
const job = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/steps/algoliaContentIndex');

// Mocking global objects
global.empty = GlobalMock.empty;
global.request = new GlobalMock.RequestMock();

// Mock dependencies
jest.mock('dw/content/ContentSearchModel', () => mockContentSearchModel, {
    virtual: true
});
jest.mock('dw/job/JobStepExecution', () => {
    return {};
}, {
    virtual: true
});
jest.mock('dw/util/HashMap', () => mockHashMap, {
    virtual: true
});

// Additional mocks for your Algolia modules and other dependencies...
jest.mock('*/cartridge/scripts/algolia/model/algoliaLocalizedContent', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedContent');
}, {
    virtual: true
});

jest.mock('*/cartridge/scripts/algolia/lib/algoliaContentConfig', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaContentConfig');
}, {
    virtual: true
});

jest.mock('*/cartridge/scripts/algolia/helper/objectHelper', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/objectHelper');
}, {
    virtual: true
});

jest.mock('*/cartridge/scripts/algolia/helper/reindexHelper', () => {
    const originalModule = jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/reindexHelper');
    return {
        sendRetryableBatch: originalModule.sendRetryableBatch,
        deleteRetryableBatch: originalModule.deleteRetryableBatch,
        deleteTemporaryIndices: originalModule.deleteTemporaryIndices,
        waitForTasks: originalModule.waitForTasks,
        copySettingsFromProdIndices: originalModule.copySettingsFromProdIndices,
        finishAtomicReindex: originalModule.finishAtomicReindex,
    }
}, {
    virtual: true
});

jest.mock('dw/util/Bytes', () => {
    class BytesMock {
        constructor(string) {
            this.string = string;
        }

        getLength() {
            return new Blob([this.string]).size;
        }
    }

    return BytesMock;
}, {
    virtual: true
});

jest.mock('*/cartridge/scripts/algolia/lib/algoliaSplitter', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaSplitter');
}, {
    virtual: true
});

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
        deleteIndex: jest.fn().mockReturnValue({
            ok: true,
            object: {
                body: "OK"
            }
        }),
        waitTask: jest.fn().mockReturnValue({
            ok: true,
            object: {
                body: "OK"
            }
        }),
        getIndexSettings: jest.fn().mockReturnValue({
            ok: true,
            object: {
                body: "OK"
            }
        }),
        setIndexSettings: jest.fn().mockReturnValue({
            ok: true,
            object: {
                body: "OK"
            }
        }),
        moveIndex: jest.fn().mockReturnValue({
            ok: true,
            object: {
                body: "OK"
            }
        }),
    }
}, {
    virtual: true
});

describe('Algolia Content Indexing Tests', () => {
    let parameters = {
        'attributeList': '',
    };
    let stepExecution = new mockJobStepExecution();


    describe('beforeStep Function', () => {
        test('should initialize job report and set up Algolia API', () => {
            job.beforeStep(parameters, stepExecution);
            // Add assertions to check if the job report is initialized correctly
            expect(job.__getJobReport()).toBeDefined();
            expect(job.__getJobReport().jobID).toBe(stepExecution.getJobExecution().getJobID());
            expect(job.__getJobReport().jobType).toBe('content');

            // Check if jobReport startTime is set
            expect(job.__getJobReport().startTime).toBeInstanceOf(Date);

            // Check if Algolia API setup is done
            expect(mockSetJobInfo).toHaveBeenCalledWith(expect.objectContaining({
                jobID: expect.any(String),
                includedContent: expect.any(String),
            }));
        });
    });

    describe('process Function', () => {
        test('should generate Algolia operations for content', () => {
            const content = new mockContent();
            const algoliaOperations = job.process(content, parameters, stepExecution);
            expect(algoliaOperations).toEqual(
                [
                    {
                        action: 'addObject',
                        indexName: 'test_index___contents__default.tmp',
                        body: { objectID: 'mockContentID' }
                    },
                    {
                        action: 'addObject',
                        indexName: 'test_index___contents__fr.tmp',
                        body: { objectID: 'mockContentID' }
                    },
                    {
                        action: 'addObject',
                        indexName: 'test_index___contents__en.tmp',
                        body: { objectID: 'mockContentID' }
                    }
                ]
            );
        });
    });

    describe('send Function', () => {
        test('should send Algolia operations and handle results', () => {

            const algoliaOperationsChunk = [];
            for (let i = 0; i < 3; ++i) {
                const algoliaOperations = [{
                    action: 'addObject',
                    indexName: 'test_en',
                    body: {
                        id: `${i}`
                    }
                },
                {
                    action: 'addObject',
                    indexName: 'test_fr',
                    body: {
                        id: `${i}`
                    }
                }];
                algoliaOperations.toArray = function () {
                    return algoliaOperations;
                };
                algoliaOperationsChunk.push(algoliaOperations);
            }
            algoliaOperationsChunk.toArray = function () {
                return algoliaOperationsChunk;
            };

            job.send(algoliaOperationsChunk, parameters, stepExecution);
            // Add assertions to check if the operations are handled correctly
            expect(mockSendMultiIndexBatch).toHaveBeenCalledWith(algoliaOperationsChunk.flat());

        });
    });

    describe('afterStep Function', () => {
        test('should finalize job report and handle errors', () => {
            job.afterStep(true, parameters, stepExecution);

            var prereport = job.__getJobReport();

            // Check if jobReport endTime is set
            expect(prereport.endTime).toBeInstanceOf(Date);

            // Check if error is handled correctly
            expect(prereport.error).toBe(false);
            expect(prereport.errorMessage).toBe('');

            // Additional checks for handling Algolia indexing finalization
            // and appropriate logging

            // Test error scenario
            try {
                job.afterStep(false, parameters, stepExecution);
            } catch (e) {
                expect(e).toBeInstanceOf(Error);
                expect(e.message).toContain('An error occurred during the job. Please see the error log for more details.');
            }
        });

    });
});
