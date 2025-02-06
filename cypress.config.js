const { defineConfig } = require("cypress");
require('dotenv').config();

module.exports = defineConfig({
    e2e: {
        setupNodeEvents(on, config) {
            // Copy environment variables to Cypress config
            config.env = config.env || {};
            config.env.SANDBOX_HOST = process.env.SANDBOX_HOST;
            // Important: return the updated config
            return config;
        },
        pageLoadTimeout: 15000,
    },
});