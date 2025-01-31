#!/usr/bin/env node

/**
 * e2eTest.js
 * ----------------
 * Comprehensive Node script to replicate the e2e.sh logic.
 * Now with proper cleanup handling for both success and failure cases.
 */

const { execSync } = require('child_process');
const fs = require('fs');
require('dotenv').config();

// Files and directories to clean up
const cleanupPaths = [
    'e2e-tests',
    'e2e-tests.zip',
    'site_import.zip',
    'site_import',
    process.env.CODE_VERSION,
    `${process.env.CODE_VERSION}.zip`
];

/**
 * Cleanup function to remove generated files and folders
 */
function cleanup() {
    console.log('\nCleaning up...');
    cleanupPaths.forEach(path => {
        try {
            if (fs.existsSync(path)) {
                if (fs.lstatSync(path).isDirectory()) {
                    fs.rmSync(path, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(path);
                }
                console.log(`Removed: ${path}`);
            }
        } catch (error) {
            console.error(`Error cleaning up ${path}:`, error.message);
        }
    });
}

// Register cleanup handlers for different types of script termination
process.on('exit', cleanup);
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT (Ctrl+C)');
    cleanup();
    process.exit(1);
});
process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM');
    cleanup();
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    cleanup();
    process.exit(1);
});

/**
 * main()
 * - Orchestrates each step in the E2E sequence
 */
function main() {
    try {
        // Initial setup and compilation
        cleanup(); // Initial cleanup before starting
        ensureRequiredEnvVars();

        console.log(`Using CODE_VERSION: ${process.env.CODE_VERSION}`);

        compileJS();
        compileSCSS();
        prepareCode();
        deployCode();

        // First run all master-level tests
        console.log('\n=== Running Master-Level Tests ===');
        runTestsForConfiguration('master-level', 'basex', process.env.TEST_MASTER_PRODUCT_ID);

        // Then run all variation-level tests
        console.log('\n=== Running Variation-Level Tests ===');
        runTestsForConfiguration('variation-level', 'varx', process.env.TEST_PRODUCT_ID);

        console.log('All E2E tests completed successfully.');
    } catch (error) {
        console.error('Error during E2E testing:', error.message);
        process.exit(1);
    }
}

function ensureRequiredEnvVars() {
    const required = ['TEST_PRODUCT_ID', 'TEST_MASTER_PRODUCT_ID', 'CODE_VERSION'];
    required.forEach(varName => {
        if (!process.env[varName]) {
            throw new Error(`ERROR: ${varName} is not set. Please define it in your .env file.`);
        }
    });
}

/**
 * Runs all tests for a specific configuration
 * @param {string} recordModel - 'master-level' or 'variation-level'
 * @param {string} indexPrefix - 'basex' or 'varx'
 * @param {string} productId - The product ID to test with
 */
function runTestsForConfiguration(recordModel, indexPrefix, productId) {
    console.log(`\nTesting configuration: Record Model=${recordModel}, Index Prefix=${indexPrefix}`);
    
    // Import preferences for this configuration
    console.log('Importing site preferences...');
    execSync(`RECORD_MODEL=${recordModel} INDEX_PREFIX=${indexPrefix} npm run e2e:import-preferences`, {
        stdio: 'inherit',
        shell: '/bin/bash'
    });

    // Run SFCC job
    console.log('Running SFCC job...');
    execSync('npm run e2e:run-sfcc-job', {
        stdio: 'inherit'
    });

    // Run variation index tests
    console.log('Running index tests...');
    execSync(
        `RECORD_MODEL=${recordModel} INDEX_PREFIX=${indexPrefix} TEST_PRODUCT_ID=${productId} npm run e2e:variation-index-test`,
        {
            stdio: 'inherit',
            shell: '/bin/bash'
        }
    );

    // Run Cypress tests
    console.log('Running frontend tests...');
    execSync(
        `CYPRESS_RECORD_MODEL=${recordModel} CYPRESS_INDEX_PREFIX=${indexPrefix} CYPRESS_TEST_PRODUCT_ID=${productId} npm run test:frontend`,
        {
            stdio: 'inherit',
            shell: '/bin/bash'
        }
    );

    console.log(`Configuration test completed: Record Model=${recordModel}, Index Prefix=${indexPrefix}`);
}

function compileJS() {
    execSync('npm run e2e:compile-js', { stdio: 'inherit' });
}

function compileSCSS() {
    execSync('npm run e2e:compile-scss', { stdio: 'inherit' });
}

function prepareCode() {
    execSync('npm run e2e:prepare-code', { stdio: 'inherit', shell: '/bin/bash' });
}

function deployCode() {
    execSync('npm run e2e:deploy-code', { stdio: 'inherit' });
}

// Run the main function
main();