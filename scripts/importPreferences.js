// scripts/importPreferences.js
require('dotenv').config();
const sfcc = require('sfcc-ci');
const authenticate = require('./auth');
const path = require('path');
const {
    exec
} = require('child_process');

(async () => {
    try {
        const token = await authenticate();

        const instance = process.env.SANDBOX_HOST;

        // Define the path to the site import directory and zip file
        const siteImportDir = path.resolve('./site_import');
        const siteArchive = path.resolve('./site_import.zip');

        // Zip the site_import folder
        console.log('Zipping the site_import folder...');
        await new Promise((resolve, reject) => {
            exec(`zip -r ${siteArchive} ${siteImportDir}`, (err, stdout, stderr) => {
                if (err) {
                    console.error('Error zipping site_import folder:', stderr);
                    reject(err);
                } else {
                    console.log('site_import folder zipped successfully.');
                    resolve();
                }
            });
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

        console.log('Site preferences imported successfully.');
    } catch (error) {
        console.error('Import error:', error);
        process.exit(1);
    }
})();