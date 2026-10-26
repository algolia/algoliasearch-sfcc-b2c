require('./loadEnv');
const { resolveConfig } = require('@salesforce/b2c-tooling-sdk/config');
const { globalMiddlewareRegistry } = require('@salesforce/b2c-tooling-sdk/clients');
const { NetworkError } = require('@salesforce/b2c-tooling-sdk/errors');

const NETWORK_RETRY_COUNT = 3;
const NETWORK_RETRY_DELAY_MS = 2000;
const RETRYABLE_NETWORK_ERROR_KINDS = ['connection-reset', 'timeout'];

let instancePromise;

/**
 * @param {Error} error - The error thrown by the request
 * @returns {boolean} Whether the request failed at the network level in a way that a retry
 *     can fix
 */
function isRetryableNetworkError(error) {
    return error instanceof NetworkError && RETRYABLE_NETWORK_ERROR_KINDS.indexOf(error.kind) !== -1;
}

// The SDK does not retry requests that fail at the network level, so a single dropped
// connection while polling a job execution fails the whole E2E run. Only GET requests are
// retried, because they do not change anything on the instance.
const retryNetworkErrorsMiddleware = {
    async onError({ request, error, options }) {
        if (request.method !== 'GET' || !isRetryableNetworkError(error)) {
            return undefined;
        }

        let lastError = error;
        for (let attempt = 1; attempt <= NETWORK_RETRY_COUNT; attempt++) {
            console.warn('[WARN] %s %s failed (%s), retrying (%d/%d)...', request.method,
                new URL(request.url).pathname, lastError.kind, attempt, NETWORK_RETRY_COUNT);
            await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS));
            try {
                return await options.fetch(new Request(request));
            } catch (retryError) {
                if (!isRetryableNetworkError(retryError)) {
                    return retryError;
                }
                lastError = retryError;
            }
        }
        return lastError;
    },
};

globalMiddlewareRegistry.register({
    name: 'e2e-retry-network-errors',
    getMiddleware: (clientType) => (clientType === 'ocapi' ? retryNetworkErrorsMiddleware : undefined),
});

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
