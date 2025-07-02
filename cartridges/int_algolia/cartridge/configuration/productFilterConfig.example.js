// Product Filter Configuration Example File
//
// This configuration allows you to control which products are indexed to Algolia.
// By default, products must be online, searchable, and have at least one online category.
//
// To customize the filtering behavior:
//   - Create a `productFilterConfig.js` file in this directory
//   - Upload the cartridge
//   - The filters will be applied during product indexing
//
// The `productFilterConfig.js` file should export an object with the following structure:

const productFilterConfig = {
    // Control whether to check if products are online
    // Default: true (only index online products)
    checkOnline: true,

    // Control whether to check if products are searchable
    // Default: true (only index searchable products)
    checkSearchable: true,

    // Control whether to check if products have online categories
    // Default: true (only index products with at least one online category)
    checkOnlineCategory: true

    // ========================================================================
    // STOCK-RELATED SETTINGS (Managed via Business Manager UI)
    // ========================================================================
    //
    // The following stock-related settings are already configurable via 
    // Business Manager UI under:
    // Administration > Site Preferences > Custom Site Preferences > Algolia
    //
    // 1. InStockThreshold: 
    //    - Controls the minimum ATS value to consider a product in stock
    //    - Default: 0
    //    - Used by productFilter.isInStock() function
    //
    // 2. IndexOutOfStock:
    //    - Controls whether to index out of stock products to Algolia
    //    - Default: false
    //    - When false, out of stock products are excluded from indexing and in_stock status won't be set
    //    - When true, all products are indexed regardless of stock status and in_stock status is set to false
    //
    // These preferences are automatically used by the existing indexing logic
    // and do not need to be configured in this file.
};

module.exports = productFilterConfig;