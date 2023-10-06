const AlgoliaJobLog = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/AlgoliaJobLog');
const Calendar = require('dw/util/Calendar');
const StringUtils = require('dw/util/StringUtils');

describe('AlgoliaJobLog', () => {
    let algoliaJobLog;

    beforeEach(() => {
        algoliaJobLog = new AlgoliaJobLog('jobID', 'jobType');
    });

    describe('writeToCustomObject', () => {
        it('should create a custom object with the correct properties', () => {
            const CustomObjectMgr = require('dw/object/CustomObjectMgr');
            const Transaction = require('dw/system/Transaction');
            const System = require('dw/system/System');

            const customObjectID = 'jobID__' + StringUtils.formatCalendar(System.getCalendar(), 'yyMMddHHmmss');

            const algoliaJobLogCO = {
                custom: {
                    jobID: 'jobID',
                    jobType: 'jobType',
                    processedDate: null,
                    processedError: false,
                    processedErrorMessage: '',
                    processedRecords: 0,
                    processedRecordsToUpdate: 0,
                    sendDate: null,
                    sendError: false,
                    sendErrorMessage: '',
                    sentChunks: 0,
                    sentRecords: 0,
                    failedChunks: 0,
                    failedRecords: 0,
                },
            };

            const createCustomObjectSpy = jest.spyOn(CustomObjectMgr, 'createCustomObject').mockReturnValue(algoliaJobLogCO);
            const wrapSpy = jest.spyOn(Transaction, 'wrap').mockImplementation((callback) => callback());

            const result = algoliaJobLog.writeToCustomObject();

            expect(createCustomObjectSpy).toHaveBeenCalledWith('AlgoliaJobLog', customObjectID);
            expect(algoliaJobLogCO.custom.jobID).toBe('jobID');
            expect(algoliaJobLogCO.custom.jobType).toBe('jobType');
            expect(algoliaJobLogCO.custom.processedDate).toBeNull();
            expect(algoliaJobLogCO.custom.processedError).toBe(false);
            expect(algoliaJobLogCO.custom.processedErrorMessage).toBe('');
            expect(algoliaJobLogCO.custom.processedRecords).toBe(0);
            expect(algoliaJobLogCO.custom.processedRecordsToUpdate).toBe(0);
            expect(algoliaJobLogCO.custom.sendDate).toBeNull();
            expect(algoliaJobLogCO.custom.sendError).toBe(false);
            expect(algoliaJobLogCO.custom.sendErrorMessage).toBe('');
            expect(algoliaJobLogCO.custom.sentChunks).toBe(0);
            expect(algoliaJobLogCO.custom.sentRecords).toBe(0);
            expect(algoliaJobLogCO.custom.failedChunks).toBe(0);
            expect(algoliaJobLogCO.custom.failedRecords).toBe(0);
            expect(result).toBe(true);

            createCustomObjectSpy.mockRestore();
            wrapSpy.mockRestore();
        });

        it('should return false if an error occurs', () => {
            const CustomObjectMgr = require('dw/object/CustomObjectMgr');
            const Transaction = require('dw/system/Transaction');
            const System = require('dw/system/System');

            const customObjectID = 'jobID__' + StringUtils.formatCalendar(System.getCalendar(), 'yyMMddHHmmss');

            const createCustomObjectSpy = jest.spyOn(CustomObjectMgr, 'createCustomObject').mockImplementation(() => {
                throw new Error('Error creating custom object');
            });
            const wrapSpy = jest.spyOn(Transaction, 'wrap').mockImplementation((callback) => callback());

            const result = algoliaJobLog.writeToCustomObject();

            expect(createCustomObjectSpy).toHaveBeenCalledWith('AlgoliaJobLog', customObjectID);
            expect(result).toBe(false);

            createCustomObjectSpy.mockRestore();
            wrapSpy.mockRestore();
        });
    });

    describe('formatCustomObject', () => {
        it('should format the custom object into the AlgoliaJobLog instance', () => {
            const customObject = {
                custom: {
                    jobID: 'jobID',
                    jobType: 'jobType',
                    processedDate: new Date(),
                    processedError: true,
                    processedErrorMessage: 'Error processing records',
                    processedRecords: 10.0,
                    processedRecordsToUpdate: 5.0,
                    sendDate: new Date(),
                    sendError: true,
                    sentChunks: 2.0,
                    sentRecords: 20.0,
                    failedChunks: 1.0,
                    failedRecords: 5.0,
                },
            };

            const result = algoliaJobLog.formatCustomObject(customObject);

            expect(result.jobID).toBe('jobID');
            expect(result.jobType).toBe('jobType');
            expect(result.processedDate).toStrictEqual(customObject.custom.processedDate);
            expect(result.processedError).toBe(true);
            expect(result.processedErrorMessage).toBe('Error processing records');
            expect(result.processedRecords).toBe("10");
            expect(result.processedRecordsToUpdate).toBe("5");
            expect(result.sendDate).toStrictEqual(customObject.custom.sendDate);
            expect(result.sendError).toBe(true);
            expect(result.sentChunks).toBe("2");
            expect(result.sentRecords).toBe("20");
            expect(result.failedChunks).toBe("1");
            expect(result.failedRecords).toBe("5");
        });
    });
});
