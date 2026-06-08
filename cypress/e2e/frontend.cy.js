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

            // Wait for search input to be available, then type the query
            cy.get('#autocomplete-0-input', { timeout: 20000 }).should('be.visible').type(scenario.query);

            // Autocomplete panel should open and echo the query
            cy.get('.aa-PanelLayout', { timeout: 10000 }).should('be.visible').and('contain', scenario.query);

            // The catalog is reindexed immediately before this spec runs, so the first search against a
            // freshly swapped index can briefly return no results. Re-issue the search until the product
            // appears instead of relying on whole-test retries, which re-run the slow page visits.
            const maxSearchAttempts = 5;
            const searchUntilProductVisible = (attempt = 1) => {
                cy.get('#autocomplete-0-input').clear();
                cy.get('#autocomplete-0-input').type(`${scenario.query}{enter}`);
                cy.get('.search-results', { timeout: 10000 }).should('be.visible');

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
