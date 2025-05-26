/// <reference types="cypress" />
require('dotenv').config();

const email = 'test@algolia.com';
const password = 'Algolia2025!';
const productName = Cypress.env('TEST_PRODUCT_NAME') || process.env.TEST_PRODUCT_NAME || 'Pink and Gold Cluster Drop Earring';

/**
 * Inventory real-time update
 * This test places an order and ensures the product is removed from Algolia (out of stock)
 */
context('Inventory real-time update', () => {
    before(() => {
        cy.CloseCookieConsent();
        // Login once
        cy.loginSFRA(email, password);
    });

    it('Places order and ensures product removed from Algolia (out of stock)', () => {
        const host = Cypress.env('SANDBOX_HOST');
        // Arrange: Search and open PDP
        cy.get('#autocomplete-0-input').clear()
        cy.get('#autocomplete-0-input').type(productName);
        cy.get('.aa-PanelLayout').should('be.visible');
        cy.get('#autocomplete-0-input').type('{enter}');
        cy.contains('.product-tile', productName, { timeout: 7000 }).click();

        // Arrange: Add to cart
        cy.get('button.add-to-cart').click();
        cy.get('.minicart-quantity', { timeout: 7000 }).should('not.contain', 0);

        // Arrange: Go to cart
        cy.visit(`https://${host}/s/RefArch/cart`);
        cy.get('.line-item-header', { timeout: 7000 }).should('be.visible');

        // Arrange: Adjust quantity to 2
        cy.get('.quantity').select('2');
        cy.get('.quantity', { timeout: 7000 }).should('contain', 2);

        // Act: Go to the checkout page and place order
        cy.visit(`https://${host}/on/demandware.store/Sites-RefArch-Site/en_US/Checkout-Begin`);

        cy.get('.btn.btn-primary.btn-block.submit-shipping', { timeout: 7000 }).click();
        cy.get('input#saved-payment-security-code', { timeout: 7000 }).type('123');
        cy.get('.btn.btn-primary.btn-block.submit-payment').click();
        cy.get('.btn.btn-primary.btn-block.place-order').click();
        cy.get('.order-thank-you-msg', { timeout: 10000 }).should('be.visible');

        // Verify via storefront search that the product is no longer available (out of stock)
        // Retry up to 3 times with 15-second waits between attempts
        const verifyProductOutOfStock = (attempt = 1) => {
            cy.get('#autocomplete-0-input').clear()
            cy.get('#autocomplete-0-input').type(productName)
            cy.get('#autocomplete-0-input').type('{enter}')

            cy.get('.search-results', { timeout: 15000 }).should('be.visible').then(() => {
                cy.get('body').then(($body) => {
                    if ($body.find(':contains("No results")').length > 0) {
                        cy.contains('No results').should('be.visible');
                    } else {
                        if (attempt < 3) {
                            cy.log(`Attempt ${attempt} failed. Product still in stock. Waiting 15 seconds before retry...`);
                            cy.wait(15000);
                            verifyProductOutOfStock(attempt + 1);
                        } else {
                            cy.log('All 3 attempts failed. Product is still showing as in stock.');
                            throw new Error('Product is still in stock after 3 attempts');
                        }
                    }
                });
            });
        };

        verifyProductOutOfStock();
    });
});
