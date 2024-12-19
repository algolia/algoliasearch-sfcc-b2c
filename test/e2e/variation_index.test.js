const algoliasearch = require('algoliasearch');
const sfcc = require('sfcc-ci');

describe('Algolia Integration', () => {
    beforeAll(async () => {

        const sfccAuthVars = ['SFCC_OAUTH_CLIENT_ID', 'SFCC_OAUTH_CLIENT_SECRET'];
        sfccAuthVars.forEach(envVar => {
            if (!process.env[envVar]) {
                throw new Error(`Missing SFCC authentication variable: ${envVar}`);
            }
        });

        // Authenticate with SFCC using the JavaScript API
        try {
            await new Promise((resolve, reject) => {
                sfcc.auth.auth(
                    process.env.SFCC_OAUTH_CLIENT_ID, 
                    process.env.SFCC_OAUTH_CLIENT_SECRET,
                    (err, token) => {
                        if (err) {
                            console.error('Failed to authenticate with SFCC:', err);
                            reject(err);
                            return;
                        }
                        process.env.ACCESS_TOKEN = token;
                        console.log('Successfully authenticated with SFCC');
                        resolve(token);
                    }
                );
            });
        } catch (error) {
            console.error('Failed to authenticate with SFCC:', error);
            throw error;
        }

        // Now verify other required environment variables
        const requiredEnvVars = ['SANDBOX_HOST', 'ACCESS_TOKEN', 'ALGOLIA_APP_ID', 'ALGOLIA_API_KEY'];
        requiredEnvVars.forEach(envVar => {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        });
    });

    let client;
    let index;
    const recordModel = process.env.RECORD_MODEL || 'variation-level';
    const indexPrefix = process.env.INDEX_PREFIX || 'varx';

    beforeEach(() => {
        client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY);
        index = client.initIndex(`${indexPrefix}__products__en_US`);
    });

    const testProducts = [
        {
            type: 'variation',
            id: process.env.TEST_PRODUCT_ID,
            expectedFields: ['variationAttributes', 'prices']
        },
        {
            type: 'master',
            id: process.env.TEST_MASTER_PRODUCT_ID || process.env.TEST_PRODUCT_ID,
            expectedFields: ['variants', 'masterData']
        }
    ];

    testProducts.forEach(product => {
        // Skip master product test if running in variation-level mode
        if (recordModel === 'variation-level' && product.type === 'master') {
            return;
        }
        // Skip variation product test if running in master-level mode
        if (recordModel === 'master-level' && product.type === 'variation') {
            return;
        }

        test(`should search for a ${product.type} product`, async () => {
            // Verify product ID is available
            if (!product.id) {
                console.error(`Missing product ID for ${product.type} test`);
                throw new Error(`TEST_${product.type.toUpperCase()}_PRODUCT_ID environment variable is not set`);
            }

            const apiUrl = `https://${process.env.SANDBOX_HOST}/s/-/dw/data/v24_5/products/${product.id}?site_id=RefArch&client_id=${process.env.SFCC_OAUTH_CLIENT_ID}`;
            
            console.log('Attempting to fetch from URL:', apiUrl);

            const response = await fetch(
                apiUrl,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`
                    }
                }
            );

            if (!response.ok) {
                const text = await response.text();
                console.error('SFCC API Error Response:', {
                    url: apiUrl,
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: text
                });
                throw new Error(`SFCC API request failed: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Unexpected response type:', {
                    contentType,
                    body: text
                });
                throw new Error(`Expected JSON response but got ${contentType}`);
            }

            const sfccProduct = await response.json();

            console.log('SFCC Product:', sfccProduct);

            // Add validation for the SFCC product
            if (!sfccProduct || !sfccProduct.name || !sfccProduct.id) {
                console.error('Invalid SFCC product response:', sfccProduct);
                throw new Error('Invalid SFCC product data received');
            }

            // Then verify in Algolia
            const results = await index.search(sfccProduct.name.default);
            
            // Add validation for Algolia results
            if (!results.hits || !results.hits.length) {
                console.error('No matching products found in Algolia');
                throw new Error('Product not found in Algolia index');
            }

            const hit = results.hits[0];

            expect(hit.name).toContain(sfccProduct.name.default);
        });
    });
});