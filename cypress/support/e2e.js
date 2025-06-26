// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
// import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')
require('./commands')

// Ignore specific client-side JS errors that do not affect test assertions
Cypress.on('uncaught:exception', (err) => {
    // Ignore specific "cannot read property of undefined" cases that are known to
    // happen in the storefront but do not impact the assertions we care about.
    const knownBenignErrors = [
        "reading 'price'",   // Algolia price parsing error @TODO: fix this
        "reading 'split'",   // Checkout JS attempts to split undefined value
        "reading 'nodeValue'", // Occasional DOM nodeValue errors from storefront JS
        "Cannot read properties of undefined (reading 'color')", // Occasional DOM nodeValue errors from storefront JS @TODO: fix this
        "$ is not defined", // Occasional DOM nodeValue errors from storefront JS
    ];

    if (err.message && knownBenignErrors.some((substr) => err.message.includes(substr))) {
        return false; // prevents test failure for these known benign errors
    }
});