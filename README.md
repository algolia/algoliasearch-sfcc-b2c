# Algolia Search & Discovery for Salesforce B2C Commerce

Algolia's cartridge unlocks best-in-class Search & Discovery on Salesforce B2C Commerce.

It can be used for synchronization of product (incl. price and inventory information), category and content data, and includes native storefront cartridges to power Search & Discovery Experiences on both [SFRA (Storefront Reference Architecture)](https://developer.salesforce.com/docs/commerce/sfra/guide/sfra-overview.html) and SiteGenesis.
It also is compatible with Headless/Composable storefront integrations, such as the [PWA Kit](https://developer.salesforce.com/docs/commerce/pwa-kit-managed-runtime/guide/getting-started.html), thanks to Algolia's developer-friendly [InstantSearch](https://www.algolia.com/doc/guides/building-search-ui/what-is-instantsearch/react/), [Autocomplete](https://www.algolia.com/doc/ui-libraries/autocomplete/introduction/what-is-autocomplete) and [Recommend](https://www.algolia.com/doc/ui-libraries/recommend/introduction/getting-started/) UI libraries.
The integration can be used in conjunction with Algolia’s rich suite of Search & Discovery products such as its user-friendly [Merchandising Studio](https://www.algolia.com/doc/guides/managing-results/rules/merchandising-and-promoting/) and [Search Analytics](https://www.algolia.com/doc/guides/search-analytics/overview/), powerful [AI Search](https://www.algolia.com/doc/guides/getting-started/neuralsearch), [Personalization](https://www.algolia.com/doc/guides/personalization/what-is-personalization/) and [Recommend](https://www.algolia.com/doc/guides/algolia-recommend/overview/).

To learn more about the cartridge and how to get started, check out [our documentation](https://www.algolia.com/doc/integration/salesforce-commerce-cloud-b2c/getting-started/introduction/).

## References
- [Algolia Docs](https://www.algolia.com/doc/integration/salesforce-commerce-cloud-b2c/getting-started/introduction/)
- [AppExchange Listing](https://appexchange.salesforce.com/appxListingDetail?listingId=a0N4V00000IkzoAUAR&tab=e)
- [Academy: Algolia's Salesforce B2C Commerce Integration](https://academy.algolia.com/training/718dcbf0-786f-11ec-a21b-02d47b69d3fd/overview)
- [General information](https://www.algolia.com/search-solutions/salesforce-commerce-cloud/)

## Need Help?

For feedback, bug reporting, or unresolved issues with the cartridge, please contact us via our [support portal](https://support.algolia.com/hc/en-us/requests/new).
Include your cartridge version, Salesforce B2C version, application ID, steps to reproduce your issue and some indication of the severity.
Add additional information like error messages, log files, screenshots, screencasts or details about customizations to help our team better troubleshoot your issues.

## Deprecation of versions 23.4.x and below

Cartridge versions 23.4.x and lower ("Gen 1") are deprecated and will be ["sunsetted"](https://www.algolia.com/blog/algolia/sunsetting-salesforce-b2c-commerce-cartridge-gen-1/) on October 31, 2024.
To take advantage of the improvements in the latest version, upgrade to the "Gen 2" cartridges (>23.5.x).
For more information, see the [release notes](https://github.com/algolia/algoliasearch-sfcc-b2c/releases) and the [migration guide](https://www.algolia.com/doc/integration/salesforce-commerce-cloud-b2c/guides/migrating-to-23-5-0/).


## Running Tests
- Create API key on account manager.
- Add WebDAV access and necessary Ocapi resources for this key. 


`act pull_request --container-architecture linux/amd64 --secret-file act-secrets.env  --var-file act.variables`
