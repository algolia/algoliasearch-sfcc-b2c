const path = require('path');
const fs = require('fs');
const { siteArchiveImport } = require('@salesforce/b2c-tooling-sdk/operations/jobs');
const { getInstance } = require('./sfccInstance');

const IMPORT_TIMEOUT_SECONDS = 300;

async function importPreferences() {
    try {
        const instance = await getInstance();

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

        // Zips the directory, uploads it, runs the sfcc-site-archive-import job and waits for
        // it to finish. The caller runs the indexing job next, so the preferences (for
        // example Algolia_RecordModel, Algolia_IndexPrefix) must be applied by then.
        console.log('Importing site preferences...');
        const importResult = await siteArchiveImport(instance, siteImportDir, {
            archiveName: 'site_import',
            waitOptions: {
                timeoutSeconds: IMPORT_TIMEOUT_SECONDS,
                onPoll: (pollInfo) => console.info('%s execution status - %s (%ds)',
                    pollInfo.jobId, pollInfo.status, pollInfo.elapsedSeconds),
            },
        });

        console.log('Site preferences import completed successfully (execution id: %s).',
            importResult.execution.id);
    } catch (error) {
        console.error('Site preferences import error:', error);
        throw error;
    }
}

module.exports = importPreferences;

if (require.main === module) {
    importPreferences().catch((error) => {
        console.error('Error when running directly:', error);
        process.exit(1);
    });
}