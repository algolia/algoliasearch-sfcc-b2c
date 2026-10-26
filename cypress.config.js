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
                    // Core stability flags for headless CI environments
                    launchOptions.args.push('--disable-web-security');      // Allow cross-origin requests
                    launchOptions.args.push('--disable-gpu');               // No GPU in CI runners
                    launchOptions.args.push('--disable-dev-shm-usage');     // Use /tmp instead of /dev/shm (limited in Docker)
                    launchOptions.args.push('--no-sandbox');                // Required for non-root CI environments
                    launchOptions.args.push('--disable-setuid-sandbox');    // Related sandbox permission flag
                    
                    // Consistency flags to prevent flaky tests
                    launchOptions.args.push('--force-device-scale-factor=1');              // Consistent screenshots
                    launchOptions.args.push('--disable-smooth-scrolling');                 // Instant scrolling
                    launchOptions.args.push('--disable-background-timer-throttling');      // Keep timers running
                    launchOptions.args.push('--disable-renderer-backgrounding');           // Don't pause background tabs
                    launchOptions.args.push('--disable-features=VizDisplayCompositor');    // Avoid GPU compositor crashes
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