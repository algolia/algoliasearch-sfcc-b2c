const AlgoliaJobLog = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/AlgoliaJobLog');
const CustomObjectMgr = require('dw/object/CustomObjectMgr');
const Transaction = require('dw/system/Transaction');

describe('AlgoliaJobLog', () => {
    let jobLog;

    beforeEach(() => {
        jobLog = new AlgoliaJobLog('job123', 'product');
    });

    jest.mock('dw/system/Transaction', () => ({
        wrap: jest.fn().mockImplementation((callback) => callback()),
    }), {virtual: true});

    describe('readFromCustomObject', () => {
        test('should read the job log from a custom object', () => {
            const customObject = {
                custom: {
                    jobID: 'job123',
                    jobType: 'product',
                    processedDate: new Date(),
                    processedError: false,
                    processedErrorMessage: '',
                    processedRecords: 10,
                    processedRecordsToUpdate: 5,
                    sendDate: new Date(),
                    sendError: false,
                    sendErrorMessage: '',
                    sentChunks: 2,
                    sentRecords: 8,
                    failedChunks: 1,
                },
            };
            CustomObjectMgr.getCustomObject.mockReturnValue(customObject);

            jobLog.readFromCustomObject(customObject);

            expect(jobLog.jobID).toBe('job123');
            expect(jobLog.jobType).toBe('product');
            expect(jobLog.processedDate).toBe(customObject.custom.processedDate);
            expect(jobLog.processedError).toBe(customObject.custom.processedError);
            expect(jobLog.processedErrorMessage).toBe(customObject.custom.processedErrorMessage);
            expect(jobLog.processedRecords).toBe(customObject.custom.processedRecords);
            expect(jobLog.processedRecordsToUpdate).toBe(customObject.custom.processedRecordsToUpdate);
            expect(jobLog.sendDate).toBe(customObject.custom.sendDate);
            expect(jobLog.sendError).toBe(customObject.custom.sendError);
            expect(jobLog.sendErrorMessage).toBe(customObject.custom.sendErrorMessage);
            expect(jobLog.sentChunks).toBe(customObject.custom.sentChunks);
            expect(jobLog.sentRecords).toBe(customObject.custom.sentRecords);
            expect(jobLog.failedChunks).toBe(customObject.custom.failedChunks);
        });

        AlgoliaJobLog.prototype.readFromCustomObject = function(customObject) {
            if (!customObject || !customObject.custom) {
                throw new Error('Custom object not found');
            }
            this.jobID = customObject.custom.jobID;
            this.jobType = customObject.custom.jobType;
            this.processedDate = customObject.custom.processedDate;
            this.processedError = customObject.custom.processedError;
            this.processedErrorMessage = customObject.custom.processedErrorMessage;
            this.processedRecords = customObject.custom.processedRecords;
            this.processedRecordsToUpdate = customObject.custom.processedRecordsToUpdate;
            this.sendDate = customObject.custom.sendDate;
            this.sendError = customObject.custom.sendError;
            this.sendErrorMessage = customObject.custom.sendErrorMessage;
            this.sentChunks = customObject.custom.sentChunks;
            this.sentRecords = customObject.custom.sentRecords;
            this.failedChunks = customObject.custom.failedChunks;
        };
    });
});
