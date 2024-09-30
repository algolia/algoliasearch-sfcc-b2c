describe('Algolia Search', () => {
    beforeEach(() => {
      // Visit your website's homepage or search page
      cy.visit('https://zzgk-003.dx.commercecloud.salesforce.com/on/demandware.store/Sites-RefArch-Site')

      // Wait for the page to load
      cy.get('body', { timeout: 10000 }).should('be.visible')

      // Handle the cookie consent pop-up
      cy.get('.affirm').click()
    })
  
    it('performs a search and displays results', () => {
      // Type a search query
      cy.get('#autocomplete-0-input').type('TomTom Go 720')

      // Wait 1 second
      cy.wait(1000)

      // Wait for the autocomplete results to load
      cy.get('.aa-PanelLayout', { timeout: 10000 }).should('be.visible')

      // Autocomplete should contain the search query
      cy.get('.aa-PanelLayout').should('contain', 'TomTom Go 720')
  
      // press enter
      cy.get('#autocomplete-0-input').type('{enter}')
  
      // Wait for results to load
      cy.get('.search-results', { timeout: 10000 }).should('be.visible')
  
      // Check if the specific product is in the results
      cy.contains('.product-tile', 'TomTom Go 720 Portable GPS Unit').should('be.visible')
  
      // Verify some details of the product
      cy.get('.product-tile')
        .within(() => {
          cy.get('.price').should('be.visible')
          cy.get('.tile-image').should('be.visible')
        })
    })
  })