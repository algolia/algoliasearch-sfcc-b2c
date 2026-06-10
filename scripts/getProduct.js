const { ocapiFetch } = require('./ocapiClient');
require('dotenv').config();

/**
 * Retrieves a single product from SFCC Data API.
 *
 * @param {string} productId - The SFCC product ID.
 * @returns {Promise<object>} - The full product JSON returned by the SFCC Data API.
 */
async function getProduct(productId) {
    if (!productId) {
        throw new Error('Product ID is required');
    }

    const apiUrl = `https://${process.env.SANDBOX_HOST}/s/-/dw/data/v24_5/products/${productId}?site_id=RefArch&client_id=${process.env.SFCC_OAUTH_CLIENT_ID}`;
    console.log(`[getProduct] Fetching product ${productId} from:`, apiUrl);

    // ocapiFetch attaches a valid bearer token and retries once with a fresh token on a 401,
    // so an expired token can no longer fail this request.
    const response = await ocapiFetch(apiUrl, {
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        const body = await response.text();
        console.error('[getProduct] SFCC API Error Response:', {
            url: apiUrl,
            status: response.status,
            statusText: response.statusText,
            body,
        });
        throw new Error(`SFCC API request failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        const body = await response.text();
        console.error('[getProduct] Unexpected response type:', { contentType, body });
        throw new Error(`Expected JSON response but got ${contentType}`);
    }

    const product = await response.json();

    if (!product || !product.name || !product.id) {
        console.error('[getProduct] Invalid SFCC product response:', product);
        throw new Error('Invalid SFCC product data received');
    }

    return product;
}

module.exports = getProduct;