const AlgoliaJobReport = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/AlgoliaJobReport');

describe('AlgoliaJobReport', () => {
    let jobReport;

    beforeEach(() => {
        jobReport = new AlgoliaJobReport('job-id', 'product');
    });

    describe('writeToCustomObject', () => {
        it('should write the job report to a custom object', () => {
            const CustomObjectMgr = require('dw/object/CustomObjectMgr');
            const Transaction = require('dw/system/Transaction');
            const System = require('dw/system/System');
            const StringUtils = require('dw/util/StringUtils');

            const customObjectID = 'job-id__' + StringUtils.formatCalendar(System.getCalendar(), 'yyMMdd-HHmmss');

            const createCustomObjectSpy = jest.spyOn(CustomObjectMgr, 'createCustomObject');
            const transactionWrapSpy = jest.spyOn(Transaction, 'wrap');

            const result = jobReport.writeToCustomObject();

            expect(result).toBe(true);
            expect(createCustomObjectSpy).toHaveBeenCalledWith('AlgoliaJobReport', customObjectID);
            expect(transactionWrapSpy).toHaveBeenCalled();

            createCustomObjectSpy.mockRestore();
            transactionWrapSpy.mockRestore();
        });

        it('should return false if an error occurs', () => {
            const CustomObjectMgr = require('dw/object/CustomObjectMgr');
            const Transaction = require('dw/system/Transaction');
            const System = require('dw/system/System');
            const StringUtils = require('dw/util/StringUtils');

            const customObjectID = 'job-id__' + StringUtils.formatCalendar(System.getCalendar(), 'yyMMdd-HHmmss');

            const createCustomObjectSpy = jest.spyOn(CustomObjectMgr, 'createCustomObject').mockImplementation(() => {
                throw new Error('Failed to create custom object');
            });
            const transactionWrapSpy = jest.spyOn(Transaction, 'wrap');

            const result = jobReport.writeToCustomObject();

            expect(result).toBe(false);
            expect(createCustomObjectSpy).toHaveBeenCalledWith('AlgoliaJobReport', customObjectID);
            expect(transactionWrapSpy).toHaveBeenCalled();

            createCustomObjectSpy.mockRestore();
            transactionWrapSpy.mockRestore();
        });
    });

    describe('formatCustomObject', () => {
        it('should format the job report from a custom object', () => {
            const customObject = {
                custom: {
                    jobID: 'job-id',
                    jobType: 'product',
                    startTime: new Date(),
                    endTime: new Date(),
                    processedItems: 10,
                    processedItemsToSend: 5,
                    siteLocales: 2,
                    recordsToSend: 20,
                    recordsSent: 15,
                    recordsFailed: 5,
                    chunksSent: 3,
                    chunksFailed: 1,
                    error: false,
                    errorMessage: '',
                },
            };

            const result = jobReport.formatCustomObject(customObject);

            expect(result.jobID).toBe('job-id');
            expect(result.jobType).toBe('product');
            expect(result.startTime).toBeDefined();
            expect(result.endTime).toBeDefined();
            expect(result.processedItems).toBe('10');
            expect(result.processedItemsToSend).toBe('5');
            expect(result.siteLocales).toBe('2');
            expect(result.recordsToSend).toBe('20');
            expect(result.recordsSent).toBe('15');
            expect(result.recordsFailed).toBe('5');
            expect(result.chunksSent).toBe('3');
            expect(result.chunksFailed).toBe('1');
            expect(result.error).toBe(false);
            expect(result.errorMessage).toBe('');
        });
    });
});
