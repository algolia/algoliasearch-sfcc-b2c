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
    cy.intercept('**/ConsentTracking-SetSession*').as('consentTracking');
    // Visit your website's homepage or search page
    cy.visit(`https://${host}/on/demandware.store/Sites-RefArch-Site`);
    // Wait for the tracking consent modal to appear (may be slow on CI)
    cy.get('#consent-tracking .affirm', { timeout: 10000 }).then(($affirm) => {
        if ($affirm.length) {
            cy.wrap($affirm).click();
            // Wait for the consent to be persisted in the session
            // before navigating away
            cy.wait('@consentTracking');
        } else {
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
