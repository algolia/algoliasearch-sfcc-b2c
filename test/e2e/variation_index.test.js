const algoliasearch = require('algoliasearch');
const sfcc = require('sfcc-ci');

describe('Algolia Integration', () => {
    beforeAll(async () => {
        if (!process.env.CIRCLECI) {
            console.log('Skipping Algolia Integration tests - not in CircleCI environment');
            return;
        }

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

    beforeEach(() => {
        // Skip setup if not in CircleCI
        if (!process.env.CIRCLECI) return;

        client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY);
        index = client.initIndex(process.env.ALGOLIA_INDEX_NAME || 'varx__products__en_US');
    });

    test('should search for a specific product', async () => {
        if (!process.env.CIRCLECI) {
            console.log('Test skipped - not in CircleCI environment');
            return;
        }

        // Updated API URL structure to match curl example
        const apiUrl = `https://${process.env.SANDBOX_HOST}/s/-/dw/data/v24_5/products/${process.env.TEST_PRODUCT_ID}?site_id=RefArch&client_id=${process.env.SFCC_OAUTH_CLIENT_ID}`;
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