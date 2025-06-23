/**
 * Orchestrates all steps in the end-to-end flow:
 * 1. Checks required environment variables
 * 2. Deploys code (already zipped and prepared by "npm run prepare:code")
 * 3. For each record model (master-level, variation-level):
 *    a) Import site preferences
 *    b) Run the SFCC job
 *    c) Run Variation Index Tests (Jest)
 *    d) Run Cypress frontend tests
 *
 * Also handles cleanup of leftover artifacts on normal or error exit.
 */

require('dotenv').config();
const fs = require('fs');
const { runCLI } = require('jest');
const cypress = require('cypress');
const deployCode = require('./deployCode');
const importPreferences = require('./importPreferences');
const runSFCCJob = require('./runSFCCJob');
const authenticate = require('./auth');

// List of paths to clean up
const cleanupPaths = [
    'site_import.zip',
    'site_import',
    process.env.CODE_VERSION,
    `${process.env.CODE_VERSION}.zip`
];

/**
 * Removes leftover files/directories on script exit or error.
 */
function cleanup() {
    console.log('\n[INFO] Cleaning up temporary artifacts...');
    cleanupPaths.forEach((item) => {
        if (!item) return;
        try {
            if (fs.existsSync(item)) {
                const stat = fs.lstatSync(item);
                if (stat.isDirectory()) {
                    fs.rmSync(item, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(item);
                }
                console.log(`[INFO] Removed: ${item}`);
            }
        } catch (error) {
            console.error(`[WARN] Error cleaning up ${item}: ${error.message}`);
        }
    });
}

// Trap various signals to ensure we do cleanup:
process.on('exit', cleanup);
process.on('SIGINT', () => {
    console.log('[ERROR] Received SIGINT (Ctrl+C). Exiting...');
    process.exit(1);
});
process.on('SIGTERM', () => {
    console.log('[ERROR] Received SIGTERM. Exiting...');
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    console.error('[ERROR] Uncaught Exception:', error);
    process.exit(1);
});

/**
 * Main orchestration function.
 */
async function main() {
    ensureRequiredEnvVars();

    console.log('[INFO] Starting E2E testing sequence...');
    console.log('[INFO] Deploying code version...');
    await deployCode();

    // We test two different record models:
    const recordModels = ['master-level', 'variation-level'];

    const indexPrefixes = {
        'master-level': 'test_ci',
        'variation-level': 'test_ci'
    };

    for (const model of recordModels) {

        console.log(`\n[INFO] === Running E2E for: ${model} ===`);
        process.env.RECORD_MODEL = model;
        process.env.INDEX_PREFIX = indexPrefixes[model];

        console.log('[INFO] Importing site preferences...');
        await importPreferences();

        // Ensure token exists before OCAPI call
        await ensureAccessToken();

        // Pre‑set ATS to 2 so first job picks it up
        console.log('[INFO] Updating inventory ATS to 2 before indexing job...');
        await updateInventoryATS(process.env.TEST_PRODUCT_ID, 2);

        console.log('[INFO] Running SFCC job...');
        await runSFCCJob();

        console.log('[INFO] Running Variation Index Tests (Jest)...');
        await runVariationIndexTests();

        console.log('[INFO] Running Cypress Frontend Tests...');
        await runCypressTests();
    }

    console.log('\n[INFO] All E2E tests completed successfully.');
    process.exit(0);
}

/**
 * Ensures that essential environment variables are set.
 */
function ensureRequiredEnvVars() {
    const requiredVars = [
        'TEST_PRODUCT_ID',
        'TEST_MASTER_PRODUCT_ID',
        'CODE_VERSION',
        'SANDBOX_HOST',
        'SFCC_OAUTH_CLIENT_ID',
        'SFCC_OAUTH_CLIENT_SECRET',
        'ALGOLIA_APP_ID',
        'ALGOLIA_API_KEY'
    ];

    requiredVars.forEach((envVar) => {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    });
}

/**
 * Runs the Variation Index Tests via Jest's programmatic API.
 */
async function runVariationIndexTests() {
    // We can specify more advanced config if needed:
    const config = {
        runInBand: true,        // run tests sequentially
        testPathPattern: ['test/e2e/algolia_index.test.js']
    };
    const { results } = await runCLI(config, [process.cwd()]);
    if (results.numFailedTests || results.numFailedTestSuites) {
        throw new Error('Variation Index Tests failed. Please check the Jest results above.');
    }
}

/**
 * Runs the Cypress End-to-End Tests via the Cypress module API.
 */
async function runCypressTests() {
    const cypressEnv = {
        RECORD_MODEL: process.env.RECORD_MODEL,
    };

    const result = await cypress.run({
        spec: 'cypress/e2e/*.cy.js',
        env: cypressEnv,
        browser: 'chrome',
        headless: true
    });

    if (result.status === 'failed' || (result.totalFailed && result.totalFailed > 0)) {
        console.log(`[INFO] Cypress run summary:
            totalFailed: ${result.totalFailed ?? 0}
            totalPassed: ${result.totalPassed ?? 0}
          `);
        throw new Error(
            `Cypress tests failed with status: ${result.status || 'unknown'}`
            + `, totalFailed: ${result.totalFailed || 0}`
            + (result.message ? `, message: ${result.message}` : '')
        );
    }
}

/**
 * Ensures ACCESS_TOKEN is available in env, otherwise authenticates and sets it.
 */
async function ensureAccessToken() {
    if (process.env.ACCESS_TOKEN) {
        return;
    }
    const token = await authenticate();
    process.env.ACCESS_TOKEN = token;
}

/**
 * Updates the inventory ATS for a given product.
 * @param {string} productId - The ID of the product to update.
 * @param {number} atsValue - The new ATS value to set.
 */
async function updateInventoryATS(productId, atsValue) {
    const inventoryListId = process.env.INVENTORY_LIST_ID || 'inventory_m';
    const apiUrl = `https://${process.env.SANDBOX_HOST}/s/-/dw/data/v24_5/inventory_lists/${inventoryListId}/product_inventory_records/${productId}`;
    const body = { allocation: { amount: atsValue } };

    const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to update inventory record: ${response.status} ${response.statusText}. Body: ${text}`);
    }
    var res = await response.json();
    console.log('New ATS value:', res.allocation.amount);
}

main().catch((err) => {
    console.error('[ERROR] E2E testing error:', err);
    process.exit(1);
});
