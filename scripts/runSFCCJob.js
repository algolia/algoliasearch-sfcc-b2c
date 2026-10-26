const { executeJob, waitForJob } = require('@salesforce/b2c-tooling-sdk/operations/jobs');
const { getInstance } = require('./sfccInstance');

const JOB_ID = 'AlgoliaProductIndex_v2';
const POLL_INTERVAL_SECONDS = 15;
const JOB_TIMEOUT_SECONDS = 375;

async function runSFCCJob() {
    try {
        const instance = await getInstance();

        // If the job is already running, executeJob waits for that execution to finish and
        // then starts a new one, so the new run picks up the latest site preferences
        const jobExecution = await executeJob(instance, JOB_ID);
        console.info('Started %s (execution id: %s).', JOB_ID, jobExecution.id);

        await waitForJob(instance, JOB_ID, jobExecution.id, {
            pollIntervalSeconds: POLL_INTERVAL_SECONDS,
            timeoutSeconds: JOB_TIMEOUT_SECONDS,
            onPoll: (pollInfo) => console.info('Job execution status - %s (%ds)',
                pollInfo.status, pollInfo.elapsedSeconds),
        });

        console.log('Job completed successfully.');
    } catch (error) {
        console.error('SFCC Job error:', error);
        throw error;
    }
}

module.exports = runSFCCJob;

if (require.main === module) {
    runSFCCJob().catch((error) => {
        console.error('Error when running directly:', error);
        process.exit(1);
    });
}
