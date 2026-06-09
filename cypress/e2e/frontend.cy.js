/// <reference types="cypress" />

describe('Algolia Search', () => {
    beforeEach(() => {
        // Close cookie consent
        cy.closeCookieConsent();
    });

    const testSearchScenarios = [];

    if (Cypress.env('RECORD_MODEL') === 'master-level') {
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
            const host = Cypress.env('SANDBOX_HOST');
            cy.visit(`https://${host}/s/RefArch/home`);

            // Wait for the Algolia autocomplete to initialize
            cy.get('#autocomplete-0-input', { timeout: 20000 }).should('be.visible');

            // Immediately after a fresh index, the first storefront query can come back empty, so the
            // expected product may be missing on the first try. Re-issue the search until it appears,
            // rather than letting an assertion fail and trigger a whole-test retry.
            const maxSearchAttempts = 6;
            const searchUntilProductVisible = (attempt = 1) => {
                cy.get('#autocomplete-0-input').clear();
                cy.get('#autocomplete-0-input').type(`${scenario.query}{enter}`);
                cy.get('.search-results', { timeout: 15000 }).should('be.visible');

                cy.get('body', { log: false }).then(($body) => {
                    const productVisible = $body.find(`.product-tile:contains("${scenario.expectedProduct}")`).length > 0;
                    if (productVisible) {
                        return;
                    }

                    if (attempt >= maxSearchAttempts) {
                        throw new Error(`"${scenario.expectedProduct}" not found in search results after ${maxSearchAttempts} attempts`);
                    }

                    cy.log(`Product not in results yet; retrying search (${attempt + 1}/${maxSearchAttempts})`);
                    // eslint-disable-next-line cypress/no-unnecessary-waiting
                    cy.wait(3000).then(() => searchUntilProductVisible(attempt + 1));
                });
            };

            searchUntilProductVisible();

            // The product tile should render with a price and an image
            cy.contains('.product-tile', scenario.expectedProduct)
                .should('be.visible')
                .within(() => {
                    cy.get('.price').should('be.visible');
                    cy.get('.tile-image').should('be.visible');
                });
        });
    });
});
