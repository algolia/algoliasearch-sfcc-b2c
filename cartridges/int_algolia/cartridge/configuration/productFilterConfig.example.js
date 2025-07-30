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
    // Control whether to include offline products in indexing
    // Default: false (exclude offline products)
    includeOfflineProducts: false,

    // Control whether to include non-searchable products in indexing
    // Default: false (exclude non-searchable products)
    includeNotSearchableProducts: false,

    // Control whether to include products without online categories in indexing
    // Default: false (exclude products without online categories)
    includeProductsWithoutOnlineCategories: false

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