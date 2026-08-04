const CustomObjectMgr = require('dw/object/CustomObjectMgr');
const AlgoliaJobReport = require('*/cartridge/scripts/algolia/helper/AlgoliaJobReport');
const BMHelper = require('../../../../../cartridges/bm_algolia/cartridge/scripts/helper/BMHelper');

/**
 * Builds the BM deep link the mocked URLUtils/CSRFProtection produce for a job ID.
 * @param {string} jobID the job ID
 * @returns {string} the expected link
 */
function expectedBMLink(jobID) {
    return 'https://test.commercecloud.salesforce.com/on/demandware.store/Sites-Algolia_SFRA-Site/default/ViewApplication-BM?csrf_token=csrfToken#/?job#editor!id!' +
        jobID + '!config!' + jobID + '!domain!Sites!tab!schedule-and-history';
}

describe('getLatestCOReportsByJob', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return false if AlgoliaJobReport custom object type does not exist', () => {
        CustomObjectMgr.getAllCustomObjects.mockImplementation(() => {
            throw new Error('Custom object type does not exist');
        });

        const result = BMHelper.getLatestCOReportsByJob();

        expect(result).toBe(false);
        expect(CustomObjectMgr.getAllCustomObjects).toHaveBeenCalledWith('AlgoliaJobReport');
    });

    it('should return an array of formatted AlgoliaJobReport objects grouped by job ID', () => {
        const allJobReports = [
            { custom: { jobID: 'job1' }, creationDate: new Date('2023-01-01') },
            { custom: { jobID: 'job1' }, creationDate: new Date('2023-01-02') },
            { custom: { jobID: 'job1' }, creationDate: new Date('2023-01-03') },
            { custom: { jobID: 'job2' }, creationDate: new Date('2023-01-01') },
            { custom: { jobID: 'job2' }, creationDate: new Date('2023-01-02') },
            { custom: { jobID: 'job3' }, creationDate: new Date('2023-01-01') },
        ];
        CustomObjectMgr.getAllCustomObjects.mockReturnValue({
            asList: () => ({ toArray: () => allJobReports }),
        });

        CustomObjectMgr.queryCustomObjects.mockImplementation((type, query, sort, jobID) => {
            if (jobID === 'job1') {
                return {
                    asList: () => ({ toArray: () => allJobReports.slice(0, 3) }),
                };
            }
            if (jobID === 'job2') {
                return {
                    asList: () => ({ toArray: () => allJobReports.slice(3, 5) }),
                };
            }
            if (jobID === 'job3') {
                return {
                    asList: () => ({ toArray: () => allJobReports.slice(5, 6) }),
                };
            }
            return {
                asList: () => ({ toArray: () => [] }),
            };
        });

        // every formatted report carries the deep link of its job, precomputed by the helper
        const job1Reports = [
            { custom: { jobID: 'job1' }, creationDate: new Date('2023-01-01'), bmLink: expectedBMLink('job1') },
            { custom: { jobID: 'job1' }, creationDate: new Date('2023-01-02'), bmLink: expectedBMLink('job1') },
            { custom: { jobID: 'job1' }, creationDate: new Date('2023-01-03'), bmLink: expectedBMLink('job1') },
        ];
        const job2Reports = [
            { custom: { jobID: 'job2' }, creationDate: new Date('2023-01-01'), bmLink: expectedBMLink('job2') },
            { custom: { jobID: 'job2' }, creationDate: new Date('2023-01-02'), bmLink: expectedBMLink('job2') },
        ];
        const job3Reports = [
            { custom: { jobID: 'job3' }, creationDate: new Date('2023-01-01'), bmLink: expectedBMLink('job3') },
        ];
        AlgoliaJobReport.prototype.formatCustomObject = jest.fn((report) => report);

        const result = BMHelper.getLatestCOReportsByJob();

        expect(result).toEqual([
            job1Reports,
            job2Reports,
            job3Reports,
        ]);
        expect(CustomObjectMgr.getAllCustomObjects).toHaveBeenCalledWith('AlgoliaJobReport');
        expect(CustomObjectMgr.queryCustomObjects).toHaveBeenCalledTimes(3);
        expect(CustomObjectMgr.queryCustomObjects).toHaveBeenNthCalledWith(1, 'AlgoliaJobReport', 'custom.jobID = {0} ', 'creationDate desc', 'job1');
        expect(CustomObjectMgr.queryCustomObjects).toHaveBeenNthCalledWith(2, 'AlgoliaJobReport', 'custom.jobID = {0} ', 'creationDate desc', 'job2');
        expect(CustomObjectMgr.queryCustomObjects).toHaveBeenNthCalledWith(3, 'AlgoliaJobReport', 'custom.jobID = {0} ', 'creationDate desc', 'job3');
        expect(AlgoliaJobReport.prototype.formatCustomObject).toHaveBeenCalledTimes(6);
        expect(AlgoliaJobReport.prototype.formatCustomObject).toHaveBeenNthCalledWith(1, job1Reports[0]);
        expect(AlgoliaJobReport.prototype.formatCustomObject).toHaveBeenNthCalledWith(2, job1Reports[1]);
        expect(AlgoliaJobReport.prototype.formatCustomObject).toHaveBeenNthCalledWith(3, job1Reports[2]);
        expect(AlgoliaJobReport.prototype.formatCustomObject).toHaveBeenNthCalledWith(4, job2Reports[0]);
        expect(AlgoliaJobReport.prototype.formatCustomObject).toHaveBeenNthCalledWith(5, job2Reports[1]);
        expect(AlgoliaJobReport.prototype.formatCustomObject).toHaveBeenNthCalledWith(6, job3Reports[0]);
    });

    it('should return an empty array if there are no AlgoliaJobReport objects', () => {
        CustomObjectMgr.getAllCustomObjects.mockReturnValue({
            asList: () => ({ toArray: () => [] }),
        });

        const result = BMHelper.getLatestCOReportsByJob();

        expect(result).toEqual([]);
        expect(CustomObjectMgr.getAllCustomObjects).toHaveBeenCalledWith('AlgoliaJobReport');
        expect(CustomObjectMgr.queryCustomObjects).not.toHaveBeenCalled();
        expect(AlgoliaJobReport.prototype.formatCustomObject).not.toHaveBeenCalled();
    });
});

describe('getJobBMLink', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return the Business Manager link for a job', () => {
        const result = BMHelper.getJobBMLink('AlgoliaProductIndex_v2');

        expect(result).toBe(expectedBMLink('AlgoliaProductIndex_v2'));
    });

    it('should return an empty string when the link cannot be built', () => {
        const CSRFProtection = require('dw/web/CSRFProtection');
        jest.spyOn(CSRFProtection, 'generateToken').mockImplementation(() => {
            throw new Error('No request context');
        });

        expect(BMHelper.getJobBMLink('AlgoliaProductIndex_v2')).toBe('');
    });
});
