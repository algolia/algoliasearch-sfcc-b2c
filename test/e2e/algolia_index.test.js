require('dotenv').config();
const { algoliasearch } = require('algoliasearch');
const getProduct = require('../../scripts/getProduct');

var productName;

describe('Algolia Integration', () => {
    beforeAll(() => {
        // getProduct mints its own short-lived SFCC token per call, so no shared
        // ACCESS_TOKEN is needed here. Validate credentials and config up front so the suite
        // fails fast with a clear message if anything is missing.
        const requiredEnvVars = ['SFCC_OAUTH_CLIENT_ID', 'SFCC_OAUTH_CLIENT_SECRET', 'SANDBOX_HOST', 'ALGOLIA_APP_ID', 'ALGOLIA_API_KEY'];
        requiredEnvVars.forEach(envVar => {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        });
    });

    let client;
    const recordModel = process.env.RECORD_MODEL
    const indexPrefix = process.env.INDEX_PREFIX;

    beforeEach(() => {
        client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY);
    });

    const testProducts = [
        {
            type: 'variant',
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
        // Skip master product test if running in variant-level mode
        if (recordModel === 'variant-level' && product.type === 'master') {
            return;
        }
        // Skip variation product test if running in master-level mode
        if (recordModel === 'master-level' && product.type === 'variant') {
            return;
        }

        test(`should search for a ${product.type} product`, async () => {
            // Verify product ID is available
            if (!product.id) {
                console.error(`Missing product ID for ${product.type} test`);
                throw new Error(`TEST_${product.type.toUpperCase()}_PRODUCT_ID environment variable is not set`);
            }

            const sfccProduct = await getProduct(product.id);

            // Add validation for the SFCC product
            if (!sfccProduct || !sfccProduct.name || !sfccProduct.id) {
                console.error('Invalid SFCC product response:', sfccProduct);
                throw new Error('Invalid SFCC product data received');
            }

            const { results } = await client.search({
                requests: [
                    {
                        indexName: process.env.ALGOLIA_INDEX_NAME || `${indexPrefix}__products__en_US`,
                        query: sfccProduct.name.default
                    }
                ]
            });

            if (!results?.[0]?.hits?.length) {
                console.error('No matching products found in Algolia');
                throw new Error('Product not found in Algolia index');
            }

            const hit = results[0].hits[0];
            expect(hit.name).toContain(sfccProduct.name.default);
            productName = sfccProduct.name.default;
        });
    });

    test('Algolia record contains storeAvailability attribute', async () => {
        // Arrange
        const prefix = process.env.INDEX_PREFIX;
        const indexName = `${prefix}__products__en_US`;

        // Act
        const { results } = await client.search({
            requests: [
                {
                    indexName,
                    query: productName,
                }
            ]
        });

        const hit = results?.[0]?.hits?.[0];

        // Assert
        if (recordModel === 'master-level') {
            expect(hit.variants[0].storeAvailability).toBeDefined();
        } else {
            expect(hit.storeAvailability).toBeDefined();
        }
    });
});
