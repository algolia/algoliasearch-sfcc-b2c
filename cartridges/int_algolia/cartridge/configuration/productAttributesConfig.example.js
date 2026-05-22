// Product records configuration example file
//
// The list of available attributes is documented here:
// https://www.algolia.com/doc/integration/salesforce-commerce-cloud-b2c/indexing/product-indexing/indexing-attributes/#configurable-attributes
// If you want to add additional attributes, change their name or override the existing definitions:
//   - Create a `productAttributesConfig.js` file in this directory
//   - Upload the cartridge
//   - Add the declared attributes to the "Additional Product Attributes" field of the Business Manager
//
// The `productAttributesConfig.js` file has to export an object with the following structure:

const productAttributesConfig = {
    // object key is the name that will be used in Algolia records
    searchRank: {
        // Here is an attribute directly present in the dw.catalog.Product object
        attribute: 'searchRank',
        localized: false,
    },
    // Active Data examples.
    //
    // The cartridge ships with built-in handlers for all 48 `dw.catalog.ProductActiveData`
    // properties, indexed flat at the master record root (see `algoliaProductConfig.js` for details).
    // Add the bare ID (e.g. `ordersWeek`, `revenueWeek`) to `Algolia_AdditionalAttributes` to enable
    // that - no entry is required in this file.
    //
    // The two examples below cover the cases the built-in handlers do NOT cover:
    //   1) Rename: publish an Active Data field under a different Algolia key.
    //   2) Per-variant un-nest: place per-variant Active Data inside `variants[]`
    //      as a flat field (not nested under `activeData`).
    popularity: {
        // Renaming: index `product.activeData.revenueWeek` under the Algolia key `popularity`.
        attribute: 'activeData.revenueWeek',
        localized: false,
    },
    revenueWeekPerVariant: {
        // Per-variant un-nest: in the master-level and attribute-sliced models, place each
        // variant's `activeData.revenueWeek` inside its `variants[]` entry as a flat
        // `revenueWeekPerVariant` field, instead of nested under `activeData`.
        attribute: 'activeData.revenueWeek',
        localized: false,
        variantAttribute: true,
    },
    categoryName: {
        attribute: 'primaryCategory.displayName',
        // Declare if the attribute is localized
        localized: true,
    },

    // Some base attributes are present by default: https://www.algolia.com/doc/integration/salesforce-commerce-cloud-b2c/indexing/product-indexing/indexing-attributes/#base-attributes-non-configurable
    // You can declare an empty object to remove them:
    in_stock: {},

    // You can overwrite the default definition of existing attributes.
    // For example, the Base-product record model has a `variants` attribute:
    // https://www.algolia.com/doc/integration/salesforce-commerce-cloud-b2c/indexing/product-indexing/indexing-attributes/#product-level-default-model
    variants: {
        // For more complex computations, you can use a function. The return value will be indexed into Algolia.
        // Here, it returns an array containing the variant IDs
        attribute: function (product) {
            if (!product.isMaster() && !product.isVariationGroup()) {
                return null;
            }
            const variants = [];
            const variantsIt = product.variants.iterator();
            while (variantsIt.hasNext()) {
                var variant = variantsIt.next();
                variants.push(variant.ID);
            }
            return variants;
        },
        localized: false,
    },
};

module.exports = productAttributesConfig;
