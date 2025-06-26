/// <reference types="cypress" />
require('dotenv').config();

let email;
let password;
let productName;

/**
 * Inventory real-time update
 * This test places an order and ensures the product is removed from Algolia (out of stock)
 */
context('Inventory real-time update', () => {
    before(() => {
        cy.closeCookieConsent();

        email = Cypress.env('TEST_SHOPPER_EMAIL');
        password = Cypress.env('TEST_SHOPPER_PASSWORD');

        const idFromEnv = Cypress.env('TEST_PRODUCT_ID');

        cy.task('getProduct', { id: idFromEnv }).then((product) => {
            productName = product.name.default;
            Cypress.env('TEST_PRODUCT_NAME', productName);
        }).then(() => {
            // Login after we have the product name
            cy.loginSFRA(email, password);
        });
    });

    it('Places order and ensures product removed from Algolia (out of stock)', () => {
        const host = Cypress.env('SANDBOX_HOST');
        // Arrange: Search and open PDP
        cy.get('#autocomplete-0-input').clear()
        cy.get('#autocomplete-0-input').type(productName);
        cy.get('.aa-PanelLayout').should('be.visible');
        cy.get('#autocomplete-0-input').type('{enter}');
        cy.contains('.product-tile', productName, { timeout: 15000 }).click();

        // Arrange: Add to cart
        cy.get('button.add-to-cart').click();
        cy.get('.minicart-quantity', { timeout: 15000 }).should('not.contain', 0);

        // Arrange: Go to cart
        cy.visit(`https://${host}/s/RefArch/cart`);
        cy.get('.line-item-header', { timeout: 15000 }).should('be.visible');

        // Arrange: Adjust quantity to 2
        cy.get('.quantity').select('2');
        cy.get('.quantity', { timeout: 15000 }).should('contain', 2);

        // Act: Go to the checkout page and place order
        cy.visit(`https://${host}/on/demandware.store/Sites-RefArch-Site/en_US/Checkout-Begin`);

        cy.get('.btn.btn-primary.btn-block.submit-shipping', { timeout: 15000 }).click();
        cy.get('input#saved-payment-security-code', { timeout: 15000 }).type('123');
        cy.get('.btn.btn-primary.btn-block.submit-payment').click();
        cy.get('.btn.btn-primary.btn-block.place-order').click();
        cy.get('.order-thank-you-msg', { timeout: 15000 }).should('be.visible');

        // Verify via storefront search that the product is no longer available (out of stock)
        const maxAttempts = 3;

        const performSearch = () => {
            cy.get('#autocomplete-0-input').clear();
            cy.get('#autocomplete-0-input').type(productName);
            cy.get('#autocomplete-0-input').type('{enter}');
        };

        const verifyOutOfStock = (attempt = 1) => {
            cy.log(`Inventory check attempt ${attempt}/${maxAttempts}`);
            performSearch();

            cy.get('body', { log: false }).then(($body) => {
                const productStillVisible = $body.find('.product-tile:contains("' + productName + '")').length > 0;

                if (!productStillVisible) {
                    cy.log('✅ Product is out of stock (not found in search results)');
                } else if (attempt < maxAttempts) {
                    cy.log('🔄 Product still appears in search, retrying in 15s...');
                    // eslint-disable-next-line cypress/no-unnecessary-waiting
                    cy.wait(15000)
                        .then(() => verifyOutOfStock(attempt + 1));
                } else {
                    throw new Error('❌ Product still appears in search after maximum retries');
                }
            });
        };

        verifyOutOfStock();
    });
});
