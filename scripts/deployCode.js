// scripts/deployCode.js
require('dotenv').config();
const sfcc = require('sfcc-ci');
const authenticate = require('./auth');
const path = require('path');

async function deployCode() {
    try {
        const token = await authenticate();

        const instance = process.env.SANDBOX_HOST;
        const codeVersion = process.env.CODE_VERSION;
        const codeArchive = path.resolve(`${codeVersion}.zip`);

        // Deploy Code
        await new Promise((resolve, reject) => {
            sfcc.code.deploy(instance, codeArchive, token, {}, (err) => {
                if (err) {
                    console.error('Code deployment error:', err);
                    reject(err);
                } else {
                    console.log('Code deployed successfully.');
                    resolve();
                }
            });
        });

        // Activate Code
        await new Promise((resolve, reject) => {
            sfcc.code.activate(instance, codeVersion, token, (err) => {
                if (err) {
                    console.error('Code activation error:', err);
                    reject(err);
                } else {
                    console.log('Code activated successfully.');
                    resolve();
                }
            });
        });

        console.log('Code deployment and activation completed successfully.');
    } catch (error) {
        console.error('Deployment error:', error);
        throw error;
    }
}

// Export the function
module.exports = deployCode;

// If this script is run directly, execute the function
if (require.main === module) {
    deployCode().catch((error) => {
        console.error('Error when running directly:', error);
        process.exit(1);
    });
}