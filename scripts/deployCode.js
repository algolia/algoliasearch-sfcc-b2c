// scripts/deployCode.js
const path = require('path');
const { findAndDeployCartridges } = require('@salesforce/b2c-tooling-sdk/operations/code');
const { getInstance } = require('./sfccInstance');

// Listed explicitly so that local copies of other cartridges (for example SFRA) are not
// uploaded together with the Algolia cartridges
const ALGOLIA_CARTRIDGES = [
    'int_algolia',
    'int_algolia_controllers',
    'int_algolia_sfra',
    'algolia_sg_changes',
    'bm_algolia',
];

async function deployCode() {
    try {
        const instance = await getInstance();
        const result = await findAndDeployCartridges(instance, path.resolve(__dirname, '../cartridges'), {
            include: ALGOLIA_CARTRIDGES,
            activate: true,
        });

        console.log('Deployed %d cartridges to code version %s and activated it.',
            result.cartridges.length, result.codeVersion);
    } catch (error) {
        console.error('Deployment error:', error);
        throw error;
    }
}

module.exports = deployCode;

if (require.main === module) {
    deployCode().catch((error) => {
        console.error('Error when running directly:', error);
        process.exit(1);
    });
}
