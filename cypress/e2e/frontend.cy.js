/// <reference types="cypress" />
require('dotenv').config();

describe('Algolia Search', () => {
    beforeEach(() => {
        // Close cookie consent
        cy.CloseCookieConsent();
    });

    const testSearchScenarios = [];

    if (process.env.RECORD_MODEL === 'master-level') {
        testSearchScenarios.push({
            name: 'master product search',
            query: 'Roll Up',
            expectedProduct: 'Roll Up Cargo Pant'
        });
    } else {
        testSearchScenarios.push({
            name: 'variation product search',
            query: 'TomTom Go 720',
            expectedProduct: 'TomTom Go 720 Portable GPS Unit'
        });
    }

    testSearchScenarios.forEach(scenario => {
        it(`performs a ${scenario.name} and displays results`, () => {
            // Type a search query
            cy.get('#autocomplete-0-input').type(scenario.query);

            // Wait for the autocomplete results to load
            cy.get('.aa-PanelLayout', { timeout: 10000 }).should('be.visible');

            // Autocomplete should contain the search query
            cy.get('.aa-PanelLayout').should('contain', scenario.query);

            // press enter
            cy.get('#autocomplete-0-input').type('{enter}');

            // Wait for results to load
            cy.get('.search-results', { timeout: 10000 }).should('be.visible');

            // Find the specific product tile
            cy.contains('.product-tile', scenario.expectedProduct)
                .should('be.visible')
                .within(() => {
                    cy.get('.price').should('be.visible');
                    cy.get('.tile-image').should('be.visible');
                });
        });
    });
});