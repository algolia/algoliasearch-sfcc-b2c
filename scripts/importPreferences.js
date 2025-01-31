// scripts/importPreferences.js
require('dotenv').config();
const sfcc = require('sfcc-ci');
const authenticate = require('./auth');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

async function importPreferences() {
    try {
        const token = await authenticate();

        const instance = process.env.SANDBOX_HOST;

        const siteImportDir = path.resolve('./site_import');
        const sitesDir = path.join(siteImportDir, 'sites');
        const refArchDir = path.join(sitesDir, 'RefArch');
        const metaDir = path.join(siteImportDir, 'meta');
        var recordModel, indexPrefix, additionalAttributes;
        if (process.env.RECORD_MODEL === 'master-level') { 
            recordModel = 'master-level';
            indexPrefix = 'basex';
            additionalAttributes = 'color,size,colorVariations,masterID,short_description,brand,name,pricebooks,newArrival';
        } else {
            recordModel = 'variant-level';
            indexPrefix = 'varx';
            additionalAttributes = 'color,size,colorVariations,masterID,short_description,brand,name,pricebooks,newArrival';
        }

        fs.mkdirSync(refArchDir, { recursive: true });
        fs.mkdirSync(metaDir, { recursive: true });
        console.log('Directories created successfully for recordModel: ' + recordModel + ' and indexPrefix: ' + indexPrefix);

        const preferencesXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<preferences xmlns="http://www.demandware.com/xml/impex/preferences/2007-03-31">
    <custom-preferences>
      <all-instances>
        <preference preference-id="Algolia_RecordModel">${recordModel}</preference>
        <preference preference-id="Algolia_IndexPrefix">${indexPrefix}</preference>
        <preference preference-id="Algolia_AdditionalAttributes">${additionalAttributes}</preference>
      </all-instances>
    </custom-preferences>
</preferences>`;

        const preferencesXmlPath = path.join(refArchDir, 'preferences.xml');
        fs.writeFileSync(preferencesXmlPath, preferencesXmlContent);
        console.log('preferences.xml created successfully.');

        const siteArchive = path.resolve('./site_import.zip');
        console.log('Creating site_import.zip...');

        const output = fs.createWriteStream(siteArchive);
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        output.on('close', async () => {
            console.log(`site_import.zip created (${archive.pointer()} total bytes).`);
            console.log('Uploading site_import.zip...');

            await new Promise((resolve, reject) => {
                sfcc.instance.upload(instance, siteArchive, token, {}, (err) => {
                    if (err) {
                        console.error('Site preferences upload error:', err);
                        reject(err);
                    } else {
                        console.log('Site preferences uploaded successfully.');
                        resolve();
                    }
                });
            });

            console.log('Importing site preferences...');
            await new Promise((resolve, reject) => {
                sfcc.instance.import(instance, path.basename(siteArchive), token, (err) => {
                    if (err) {
                        console.error('Site preferences import error:', err);
                        reject(err);
                    } else {
                        console.log('Site preferences imported successfully.');
                        resolve();
                    }
                });
            });

            console.log('Site preferences import completed successfully.');
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);
        archive.directory(siteImportDir, false);
        await archive.finalize();

    } catch (error) {
        console.error('Import preferences error:', error);
        throw error;
    }
}

// Export the function
module.exports = importPreferences;

// If this script is run directly, execute the function
if (require.main === module) {
    importPreferences().catch((error) => {
        console.error('Error when running directly:', error);
        process.exit(1);
    });
}
