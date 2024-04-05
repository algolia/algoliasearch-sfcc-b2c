# Cartridge configuration

This directory hosts user's configuration files that permit to override and
extend the default behaviour of the cartridge, in order to have complete
control on the produced Algolia records.

## Product records
### Customize product records attributes

You can:
- Override the definition of [existing attributes](https://www.algolia.com/doc/integration/salesforce-commerce-cloud-b2c/indexing/product-indexing/indexing-attributes/#configurable-attributes).
- Create new attributes definitions.
- Remove the default attributes.

#### 1. Declare the attributes definitions

To customize the attributes of the product records generated by the cartridge,
create a `productAttributesConfig.js` file in this directory.

It must export an object. The keys of this object are the name of the
attributes in your Algolia records. Each key is associated to an object with the
following properties:
- `attribute` is the declaration of what data is fetched in SFCC, for each 
  product. It can be:
  - a string that declares a direct Product property. The cartridge tries to
    access it directly and uses the value in the Algolia record. 
  - a function, taking the current product in parameter. What it returns will
    go in the attribute of the Algolia record.
- `localized` (optional) indicates if the attribute is different for each
  locale. It's useful for optimization purposes: when you index multiple
  locales, the cartridge only fetches once the non-localized attributes, and
  use the value in the records generated for each locale.
- `variantAttribute` (optional) used for the [product-level](https://www.algolia.com/doc/integration/salesforce-commerce-cloud-b2c/indexing/product-indexing/indexing-attributes/#product-level-default-model) record model, to
  identify attributes indexed in the `variants` array.
- `computedFromBaseProduct` (optional) used for the [variant-level](https://www.algolia.com/doc/integration/salesforce-commerce-cloud-b2c/indexing/product-indexing/indexing-attributes/#variant-level-default-model) record model,
  to identify attributes computed once from the master product, and indexed
  into each variant.

```ts
{
    attribute: string | (product: dw.catalog.Product) => any;
    localized?: boolean;
    variantAttribute?: boolean;
    computedFromBaseProduct?: boolean;
}
```

> Note: You can require any B2C Commerce Script class and use it in your functions, e.g.:
> `const PriceBookMgr = require('dw/catalog/PriceBookMgr');`

#### 2. Add the attributes to the list of indexed attributes

Add those attributes to the [Additional Product Attributes](https://www.algolia.com/doc/integration/salesforce-commerce-cloud-b2c/indexing/product-indexing/indexing-attributes/?client=javascript#configure-extra-attributes-for-algoliaproductindex_v2-and-algoliaproductdeltaindex_v2).

### Do post-processing on the records

To do post-processing on the generated records just before they are sent to
Algolia:
- Create a `productRecordCustomizer.js` file in this directory.
- This file must exports a function that takes in parameter the final Algolia
  record, and do modifications on it:

```js
module.exports = function(algoliaRecord) {
    if (algoliaRecord.colorVariations) {
        algoliaRecord['availableColors'] = algoliaRecord.colorVariations.length;
    }
}
```