require('dotenv').config();
const authenticate = require('./auth');

// Account Manager access tokens (client_credentials grant) are valid for 30 minutes. Refresh a
// few minutes early so a cached token can never expire while a long-running step is still using it.
const MAX_TOKEN_AGE_MS = 25 * 60 * 1000;

let cachedToken = null;
let tokenObtainedAt = 0;

/**
 * Returns a valid Account Manager access token. A new token is minted when there is no cached
 * token, when a refresh is forced, or when the cached token is close to its 30-minute expiry.
 * Callers can therefore request a token on every OCAPI call (including each poll iteration)
 * without paying for an authentication round-trip every time.
 *
 * @param {boolean} [forceRefresh] - When true, always mints a new token.
 * @returns {Promise<string>} A valid access token.
 */
async function getValidToken(forceRefresh) {
    const tokenAge = Date.now() - tokenObtainedAt;
    if (forceRefresh || !cachedToken || tokenAge >= MAX_TOKEN_AGE_MS) {
        cachedToken = await authenticate();
        tokenObtainedAt = Date.now();
    }
    return cachedToken;
}

/**
 * Performs an SFCC OCAPI Data API request with a valid bearer token. On a 401 (for example an
 * expired or invalidated token) it mints a fresh token once and retries the request, so an
 * expired token can no longer fail the call.
 *
 * @param {string} url - The full request URL.
 * @param {object} [options] - fetch options (method, headers, body). The Authorization header is added automatically.
 * @returns {Promise<Response>} The fetch Response (after at most one re-authentication retry).
 */
async function ocapiFetch(url, options) {
    const requestOptions = options || {};
    const baseHeaders = requestOptions.headers || {};

    let accessToken = await getValidToken();
    let response = await fetch(url, {
        ...requestOptions,
        headers: { ...baseHeaders, Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401) {
        console.warn('[ocapiFetch] Received 401; minting a fresh token and retrying once.');
        accessToken = await getValidToken(true);
        response = await fetch(url, {
            ...requestOptions,
            headers: { ...baseHeaders, Authorization: `Bearer ${accessToken}` },
        });
    }

    return response;
}

module.exports = { getValidToken, ocapiFetch };
