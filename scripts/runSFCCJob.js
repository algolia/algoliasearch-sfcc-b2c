// scripts/runSFCCJob.js
require('dotenv').config();
const sfcc = require('sfcc-ci');
const authenticate = require('./auth');

(async () => {
    try {
        const token = await authenticate();

        const instance = process.env.SANDBOX_HOST;
        const jobId = 'AlgoliaProductIndex_v2';

        // Run Job
        const jobExecution = await new Promise((resolve, reject) => {
            sfcc.job.run(instance, jobId, {}, token, (err, result) => {
                if (err) {
                    console.error('Job run error:', err);
                    console.error('Error details:', JSON.stringify(err, null, 2));
                    reject(err);
                } else {
                    console.log('Job started, result:', JSON.stringify(result, null, 2));
                    resolve(result);
                }
            });
        });

        console.log('Job execution object:', JSON.stringify(jobExecution, null, 2));

        const jobExecutionId = jobExecution.body.id;
        if (!jobExecutionId) {
            console.error('Job execution details:', JSON.stringify(jobExecution, null, 2));
            throw new Error('Failed to get job execution ID');
        }

        // Poll for Job Completion
        let attempts = 0;
        const maxAttempts = 15;
        const delay = 30000; // 30 seconds

        while (attempts < maxAttempts) {
            const status = await new Promise((resolve, reject) => {
                sfcc.job.status(instance, jobId, jobExecutionId, token, (err, result) => {
                    if (err) {
                        console.error('Job status error:', err);
                        console.error('Error details:', JSON.stringify(err, null, 2));
                        reject(err);
                    } else {
                        console.log('Job status result:', JSON.stringify(result, null, 2));
                        resolve(result);
                    }
                });
            });

            const execStatus = status.execution_status;
            const exitStatus = status.exit_status?.status;

            console.log(
                `Attempt ${attempts + 1}: Job execution status - ${execStatus}, exit status - ${exitStatus}`
            );

            if (execStatus === 'finished') {
                if (exitStatus === 'ok') {
                    console.log('Job completed successfully.');
                    process.exit(0);
                } else {
                    throw new Error(`Job failed with exit status: ${exitStatus}`);
                }
            }

            attempts++;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        throw new Error('Timeout waiting for job completion.');
    } catch (error) {
        console.error('Job execution error:', error);
        process.exit(1);
    }
})();

