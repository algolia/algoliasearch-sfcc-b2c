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

            return config;
        },
        pageLoadTimeout: 15000,
    },
});