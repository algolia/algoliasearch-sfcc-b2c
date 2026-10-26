require('./loadEnv');
const { resolveConfig } = require('@salesforce/b2c-tooling-sdk/config');

let instancePromise;

/**
 * Returns the B2C Commerce instance used by the E2E scripts. The configuration comes only
 * from environment variables, so a local dw.json does not change the target instance or
 * the credentials.
 *
 * @returns {Promise<import('@salesforce/b2c-tooling-sdk').B2CInstance>} The instance
 */
function getInstance() {
    if (!instancePromise) {
        instancePromise = resolveConfig({
            hostname: process.env.SANDBOX_HOST,
            codeVersion: process.env.CODE_VERSION,
            clientId: process.env.SFCC_OAUTH_CLIENT_ID,
            clientSecret: process.env.SFCC_OAUTH_CLIENT_SECRET,
            // Without this, the SDK can fall back to a browser login, which hangs in CI
            authMethods: ['client-credentials'],
        }, {
            replaceDefaultSources: true,
        }).then((config) => config.createB2CInstance());
    }
    return instancePromise;
}

module.exports = { getInstance };
