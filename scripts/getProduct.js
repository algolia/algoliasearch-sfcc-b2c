const { getInstance } = require('./sfccInstance');

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

    const instance = await getInstance();
    console.info(`[getProduct] Fetching product ${productId}`);

    const { data: product, error, response } = await instance.ocapi.GET('/products/{id}', {
        params: {
            path: { id: productId },
            query: { site_id: 'RefArch' },
        },
    });

    if (error) {
        console.error('[getProduct] SFCC API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            error,
        });
        throw new Error(`SFCC API request failed: ${response.status} ${response.statusText}`);
    }

    if (!product || !product.name || !product.id) {
        console.error('[getProduct] Invalid SFCC product response:', product);
        throw new Error('Invalid SFCC product data received');
    }

    return product;
}

module.exports = getProduct;
