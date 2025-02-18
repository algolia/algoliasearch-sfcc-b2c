require('dotenv').config();
const sfcc = require('sfcc-ci');
const authenticate = require('./auth');

async function runSFCCJob() {
    try {
        const token = await authenticate();

        const instance = process.env.SANDBOX_HOST;
        const jobId = 'AlgoliaProductIndex_v2';

        // Run Job
        let jobExecution;
        try {
            jobExecution = await new Promise((resolve, reject) => {
                sfcc.job.run(instance, jobId, {}, token, (err, result) => {
                    if (err) {
                        console.error('Job run error:', err);
                        console.error('Error details:', JSON.stringify(err, null, 2));
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
        } catch (error) {
            // Check if the job is already running
            if (error.message && error.message.includes('JobAlreadyRunningException')) {
                console.log('Job is already running. Will monitor its status...');
                // Get the list of running jobs to find our job's execution ID
                jobExecution = await new Promise((resolve, reject) => {
                    sfcc.job.list(instance, token, (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log('Current jobs:', JSON.stringify(result, null, 2));
                            // The result might be wrapped in a body property
                            const jobs = result.body || result;
                            const runningJob = jobs.find(job => 
                                job.job_id === jobId && 
                                job.status !== 'finished' && 
                                job.status !== 'failed'
                            );
                            if (runningJob) {
                                resolve({ body: { id: runningJob.job_execution_id } });
                            } else {
                                reject(new Error('Could not find running job'));
                            }
                        }
                    });
                });
            } else {
                throw error;
            }
        }

        const jobExecutionId = jobExecution?.body?.id;
        if (!jobExecutionId) {
            console.error('Job execution details:', JSON.stringify(jobExecution, null, 2));
            throw new Error('Failed to get job execution ID');
        }

        // Poll for Job Completion
        let attempts = 0;
        const maxAttempts = 15;
        const delay = 15000; // 15 seconds

        while (attempts < maxAttempts) {
            attempts++;

            const status = await new Promise((resolve, reject) => {
                sfcc.job.status(instance, jobId, jobExecutionId, token, (err, result) => {
                    if (err) {
                        console.error('Job status error:', err);
                        console.error('Error details:', JSON.stringify(err, null, 2));
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });

            const execStatus = status?.status;
            console.log(`Attempt ${attempts}: Job execution status - ${execStatus}`);

            if (execStatus === 'OK') {
                console.log('Job completed successfully.');
                return;
            } else if (execStatus === 'failed' || execStatus === 'error') {
                throw new Error('Job execution failed.');
            }

            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        throw new Error('Job did not complete within the maximum number of attempts.');
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

