// scripts/importPreferences.js
require('dotenv').config();
const sfcc = require('sfcc-ci');
const authenticate = require('./auth');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

(async () => {
    try {
        const token = await authenticate();

        const instance = process.env.SANDBOX_HOST;

        // Define paths
        const siteImportDir = path.resolve('./site_import');
        const sitesDir = path.join(siteImportDir, 'sites');
        const refArchDir = path.join(sitesDir, 'RefArch');
        const metaDir = path.join(siteImportDir, 'meta');

        // Create directories
        fs.mkdirSync(refArchDir, { recursive: true });
        fs.mkdirSync(metaDir, { recursive: true });
        console.log('Directories created successfully.');

        // Create preferences.xml
        const preferencesXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<preferences xmlns="http://www.demandware.com/xml/impex/preferences/2007-03-31">
    <custom-preferences>
      <all-instances>
        <preference preference-id="Algolia_RecordModel">variant-level</preference>
        <preference preference-id="Algolia_IndexPrefix">varx</preference>
        <preference preference-id="Algolia_AdditionalAttributes">color,size,colorVariations,masterID,short_description,brand,name,pricebooks</preference>
      </all-instances>
    </custom-preferences>
</preferences>`;

        const preferencesXmlPath = path.join(refArchDir, 'preferences.xml');
        fs.writeFileSync(preferencesXmlPath, preferencesXmlContent);
        console.log('preferences.xml created successfully.');

        // Zip the site_import folder
        const siteArchive = path.resolve('./site_import.zip');
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

        // Upload Site Preferences
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

        // Import Site Preferences
        console.log('Importing site preferences...');
        await new Promise((resolve, reject) => {
            sfcc.instance.import(instance, 'site_import.zip', token, (err) => {
                if (err) {
                    console.error('Import error:', err);
                    reject(err);
                } else {
                    console.log('Site preferences imported successfully.');
                    resolve();
                }
            });
        });

        console.log('Site preferences import completed successfully.');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
})();
