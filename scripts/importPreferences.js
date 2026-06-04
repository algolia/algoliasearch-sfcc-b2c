require('dotenv').config();
const sfcc = require('sfcc-ci');
const authenticate = require('./auth');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

/**
 * Polls an SFCC job execution until it completes.
 * @param {string} instance - The SFCC instance host.
 * @param {string} jobId - The job ID to poll.
 * @param {string} executionId - The job execution ID to poll.
 * @param {string} token - The OAuth token to use for authentication.
 * @returns {Promise<void>} Resolves when the execution status is 'OK', rejects on error or timeout.
 */
function waitForJobCompletion(instance, jobId, executionId, token) {
    const maxAttempts = 60;
    const delay = 5000; // 5 seconds

    return new Promise((resolve, reject) => {
        let attempts = 0;

        function poll() {
            attempts++;
            sfcc.job.status(instance, jobId, executionId, token, (err, status) => {
                if (err) {
                    reject(err);
                    return;
                }

                const execStatus = status && status.status;
                console.log('Attempt %d: %s execution status - %s', attempts, jobId, execStatus);

                if (execStatus === 'OK') {
                    resolve();
                    return;
                }

                if (execStatus === 'ERROR' || execStatus === 'error' || execStatus === 'failed') {
                    reject(new Error(`${jobId} (execution ${executionId}) finished with status ${execStatus}.`));
                    return;
                }

                if (attempts >= maxAttempts) {
                    reject(new Error(`${jobId} (execution ${executionId}) did not complete within ${maxAttempts} attempts.`));
                    return;
                }

                setTimeout(poll, delay);
            });
        }

        poll();
    });
}

async function importPreferences() {
    try {
        const token = await authenticate();
        const instance = process.env.SANDBOX_HOST;

        // "site_import" directory
        const siteImportDir = path.resolve(__dirname, '../site_import');
        const sitesDir = path.join(siteImportDir, 'sites');
        const refArchDir = path.join(sitesDir, 'RefArch');
        const metaDir = path.join(siteImportDir, 'meta');
        var recordModel, indexPrefix, additionalAttributes;
        if (process.env.RECORD_MODEL === 'master-level') { 
            recordModel = 'master-level';
            indexPrefix = process.env.INDEX_PREFIX;
            additionalAttributes = 'color,size,colorVariations,masterID,short_description,brand,name,pricebooks,newArrival,storeAvailability';
        } else {
            recordModel = 'variant-level';
            indexPrefix = process.env.INDEX_PREFIX;
            additionalAttributes = 'color,size,colorVariations,masterID,short_description,brand,name,pricebooks,newArrival,storeAvailability';
        }

        // Create directories
        fs.mkdirSync(refArchDir, { recursive: true });
        fs.mkdirSync(metaDir, { recursive: true });

        // Copy the "meta" folder from ../metadata/algolia/meta to site_import/meta
        const sourceMeta = path.resolve(__dirname, '../metadata/algolia/meta');
        fs.cpSync(sourceMeta, metaDir, { recursive: true });

        console.log('Directories copied/created successfully.');

        var additionalAttributesString = '';
        additionalAttributes.split(',').forEach(attribute => {
            additionalAttributesString += `<value>${attribute}</value>`;
        });

        const preferencesXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<preferences xmlns="http://www.demandware.com/xml/impex/preferences/2007-03-31">
    <custom-preferences>
      <all-instances>
        <preference preference-id="Algolia_RecordModel">${recordModel}</preference>
        <preference preference-id="Algolia_IndexPrefix">${indexPrefix}</preference>
        <preference preference-id="Algolia_AdditionalAttributes">${additionalAttributesString}</preference>
        <preference preference-id="Algolia_EnableRealTimeInventoryHook">true</preference>
      </all-instances>
    </custom-preferences>
</preferences>`;

        const preferencesXmlPath = path.join(refArchDir, 'preferences.xml');
        fs.writeFileSync(preferencesXmlPath, preferencesXmlContent);

        console.log('preferences.xml created successfully.');

        const siteArchive = path.resolve(__dirname, '../site_import.zip');
        console.log('Creating site_import.zip...');
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(siteArchive);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                console.log(`site_import.zip created (${archive.pointer()} total bytes).`);
                resolve();
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);
            archive.directory(siteImportDir, 'site_import');
            archive.finalize();
        });

        console.log('Uploading site_import.zip...');
        await new Promise((resolve, reject) => {
            sfcc.instance.upload(instance, siteArchive, token, {}, (err) => {
                if (err) {
                    console.error('Upload error:', err);
                    reject(err);
                } else {
                    console.log('Site preferences uploaded successfully.');
                    resolve();
                }
            });
        });

        console.log('Importing site preferences...');
        const importExecutionId = await new Promise((resolve, reject) => {
            sfcc.instance.import(instance, 'site_import.zip', token, (err, result) => {
                if (err) {
                    console.error('Import error:', err);
                    reject(err);
                    return;
                }
                // `sfcc.instance.import` resolves as soon as the `sfcc-site-archive-import` job is
                // accepted, not when it finishes. Capture the execution id so we can poll for completion.
                const executionId = result && result.id;
                if (!executionId) {
                    reject(new Error('Site import was started but no execution id was returned: ' + JSON.stringify(result)));
                    return;
                }
                console.log('Site preferences import started (execution id: %s).', executionId);
                resolve(executionId);
            });
        });

        // Wait for the import to actually finish before returning. Without this, the caller can run the
        // indexing job while the preferences (e.g. Algolia_RecordModel, Algolia_IndexPrefix) are still
        // being applied, which produces records in the wrong shape/index.
        await waitForJobCompletion(instance, 'sfcc-site-archive-import', importExecutionId, token);

        console.log('Site preferences import completed successfully.');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

module.exports = importPreferences;

if (require.main === module) {
    importPreferences().catch((error) => {
        console.error('Error when running directly:', error);
        process.exit(1);
    });
}