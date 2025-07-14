const { defineConfig } = require("cypress");
require('dotenv').config();

module.exports = defineConfig({
    e2e: {
        setupNodeEvents(on, config) {
            // Copy environment variables to Cypress config
            config.env = {
                ...config.env,
                ...process.env,
            };

            on('task', {
                async getProduct({ id }) {
                    const getProduct = require('./scripts/getProduct');
                    return await getProduct(id);
                },
            });

            // Browser launch options for CI stability
            on('before:browser:launch', (browser = {}, launchOptions) => {
                if (browser.family === 'chromium' && browser.name !== 'electron') {
                    // disable Chrome web security for cross-origin requests
                    launchOptions.args.push('--disable-web-security');
                    // disable GPU hardware acceleration
                    launchOptions.args.push('--disable-gpu');
                    // disable dev shm usage for CI environments
                    launchOptions.args.push('--disable-dev-shm-usage');
                    // no sandbox for CI environments
                    launchOptions.args.push('--no-sandbox');
                    // disable setuid sandbox
                    launchOptions.args.push('--disable-setuid-sandbox');
                    // force device scale factor
                    launchOptions.args.push('--force-device-scale-factor=1');
                    // disable smooth scrolling
                    launchOptions.args.push('--disable-smooth-scrolling');
                    // disable background timer throttling
                    launchOptions.args.push('--disable-background-timer-throttling');
                    // disable renderer backgrounding
                    launchOptions.args.push('--disable-renderer-backgrounding');
                    // disable features that might cause flakiness
                    launchOptions.args.push('--disable-features=VizDisplayCompositor');
                }
                return launchOptions;
            });

            return config;
        },
        pageLoadTimeout: 30000,
        chromeWebSecurity: false,
        screenshotsFolder: 'cypress/screenshots',
        video: true,
        videosFolder: 'cypress/videos',
        screenshotOnRunFailure: true,
        trashAssetsBeforeRuns: true,
        viewportWidth: 1280,
        viewportHeight: 720,
        defaultCommandTimeout: 10000,
        requestTimeout: 10000,
        responseTimeout: 30000,
        retries: {
            runMode: 2,
            openMode: 0
        },
    },
});