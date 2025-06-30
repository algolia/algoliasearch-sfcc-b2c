// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

// Close cookie consent pop-up
Cypress.Commands.add('closeCookieConsent', () => {
    const host = Cypress.env('SANDBOX_HOST');
    // Visit your website's homepage or search page
    cy.visit(`https://${host}/on/demandware.store/Sites-RefArch-Site`);
    // Wait for the page to load
    cy.get('body', { timeout: 20000 }).should('be.visible');
    // Handle the cookie consent pop-up
    cy.get('.affirm').then(($affirm) => {
        if ($affirm.length) {
            // If the affirm button exists, click it
            cy.get('.affirm').click();
        } else {
            // If the affirm button does not exist, log a message
            cy.log('No cookie consent pop-up found.');
        }
    });
});

// Login command (storefront)
Cypress.Commands.add('loginSFRA', (email, password) => {
    const host = Cypress.env('SANDBOX_HOST');
    cy.visit(`https://${host}/on/demandware.store/Sites-RefArch-Site/en_US/Login-Show`);

    cy.get('input#login-form-email').type(email);
    cy.get('input#login-form-password').type(password);
    //login button under login form (login form name is login-form)
    cy.get('form[name="login-form"] .btn.btn-block.btn-primary').click();

    // Wait until My Account link visible as proof of login
    cy.get('.account-image', { timeout: 10000 }).should('be.visible');
});
