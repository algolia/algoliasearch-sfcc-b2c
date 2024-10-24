const {
    defineConfig
} = require("cypress");

module.exports = defineConfig({
    projectId: "a9wvhs",

    e2e: {
        setupNodeEvents(on, config) { // eslint-disable-line no-unused-vars
            // implement node event listeners here
        },
    },
});