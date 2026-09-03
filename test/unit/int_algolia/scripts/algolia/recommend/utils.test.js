/**
 * `getAnchorRecordID` takes the record model and the site preference values as arguments, so the
 * tests for the record-model matrix and for the indexing filters need no global setup.
 *
 * `getAnchorProductIDs` reads them itself, through the real `algoliaData.getPreference`, which
 * resolves them from `global.customPreferences` via the Site mock. Setting that global is the only
 * way to drive it; a `jest.fn()` on algoliaData is not wired to it.
 */
const productMgrMock = require('dw/catalog/ProductMgr');
const utils = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/recommend/utils');

const emptySlotcontent = { content: [] };

// Out-of-stock products are indexed, so the stock filter passes for every product. Tests that are
// about stock pass their own preferences.
const INDEX_EVERYTHING = { InStockThreshold: 1, IndexOutOfStock: true };
const SLICED_BY_COLOR = { InStockThreshold: 1, IndexOutOfStock: true, AttributeSlicedRecordModel_GroupingAttribute: 'color' };

/**
 * Builds an availability model whose inventory record reports the given available-to-sell quantity.
 * @param {number} ats available-to-sell quantity
 * @returns {Object} availability model mock
 */
function availabilityModelWithATS(ats) {
    return {
        getInventoryRecord: jest.fn(() => ({
            getATS: jest.fn(() => ({ getValue: jest.fn(() => ats) })),
        })),
    };
}

/**
 * Builds a product mock that answers false to every type predicate and passes every indexing
 * filter, so each test only has to describe what it is actually about.
 * @param {string} id product ID
 * @param {Object} [overrides] properties to replace on the mock
 * @returns {Object} product mock
 */
function productMock(id, overrides) {
    return Object.assign({
        ID: id,
        getID: jest.fn(() => id),
        isMaster: jest.fn(() => false),
        isVariant: jest.fn(() => false),
        isVariationGroup: jest.fn(() => false),
        isBundled: jest.fn(() => false),
        isOnline: jest.fn(() => true),
        isSearchable: jest.fn(() => true),
        getOnlineCategories: jest.fn(() => [{ ID: 'category1' }]),
        getAvailabilityModel: jest.fn(() => availabilityModelWithATS(10)),
    }, overrides || {});
}

/**
 * Builds the master a variant or variation group reports through getMasterProduct(). The real API
 * returns a full dw.catalog.Product there, so under the master-level model the filters run against
 * it directly.
 * @param {string} masterID master product ID
 * @returns {Object} master product mock
 */
function masterProductRef(masterID) {
    return masterMock(masterID, productMock(masterID + '-default', { isVariant: jest.fn(() => true) }));
}

/**
 * Builds a variation model that only answers getDefaultVariant().
 * @param {Object|null} defaultVariant the variant to return
 * @returns {Object} variation model mock
 */
function variationModelWithDefault(defaultVariant) {
    return { getDefaultVariant: jest.fn(() => defaultVariant) };
}

/**
 * Builds a variant.
 * @param {string} id variant ID
 * @param {string} masterID master product ID
 * @param {Object} [overrides] properties to replace on the mock
 * @returns {Object} variant mock
 */
function variantMock(id, masterID, overrides) {
    return productMock(id, Object.assign({
        isVariant: jest.fn(() => true),
        getMasterProduct: jest.fn(() => masterProductRef(masterID)),
    }, overrides || {}));
}

/**
 * Builds a dw.util.Collection-like list of variants that only answers iterator().
 * @param {Array} variants the variants to serve
 * @returns {Object} variant collection mock
 */
function variantCollection(variants) {
    return {
        iterator: jest.fn(() => {
            let index = 0;
            return {
                hasNext: jest.fn(() => index < variants.length),
                next: jest.fn(() => variants[index++]),
            };
        }),
    };
}

/**
 * Builds a master product. Its variants default to the one variant getDefaultVariant() reports.
 * @param {string} id master product ID
 * @param {Object|null} defaultVariant the variant getDefaultVariant() reports
 * @param {Object} [overrides] properties to replace on the mock
 * @param {Array} [variants] every variant of the master, when it has more than the default one
 * @returns {Object} master product mock
 */
function masterMock(id, defaultVariant, overrides, variants) {
    const allVariants = variants || (defaultVariant ? [defaultVariant] : []);

    return productMock(id, Object.assign({
        isMaster: jest.fn(() => true),
        getVariationModel: jest.fn(() => variationModelWithDefault(defaultVariant)),
        getVariants: jest.fn(() => variantCollection(allVariants)),
    }, overrides || {}));
}

/**
 * Builds a variation group.
 * @param {string} id variation group ID
 * @param {string} masterID master product ID
 * @param {Object|null} defaultVariant the variant getDefaultVariant() reports
 * @returns {Object} variation group mock
 */
function variationGroupMock(id, masterID, defaultVariant) {
    return productMock(id, {
        isVariationGroup: jest.fn(() => true),
        getMasterProduct: jest.fn(() => masterProductRef(masterID)),
        getVariationModel: jest.fn(() => variationModelWithDefault(defaultVariant)),
    });
}

/**
 * Builds a variant whose attribute-sliced record is `<masterID>-<colorValueID>`, mirroring the
 * shape the indexing jobs write.
 * @param {string} id variant ID
 * @param {string} masterID master ID
 * @param {string} colorValueID grouping attribute value ID
 * @param {Object} [overrides] properties to replace on the mock
 * @returns {Object} variant mock
 */
function slicedVariantMock(id, masterID, colorValueID, overrides) {
    return variantMock(id, masterID, Object.assign({
        getVariationModel: jest.fn(() => ({
            getProductVariationAttribute: jest.fn(() => ({ getID: jest.fn(() => 'color') })),
            getMaster: jest.fn(() => masterProductRef(masterID)),
            getSelectedValue: jest.fn(() => ({ getID: jest.fn(() => colorValueID) })),
        })),
    }, overrides || {}));
}

describe('getAnchorRecordID', () => {
    describe('variant-level record model', () => {
        it('anchors a variant on its own ID', () => {
            const product = variantMock('variant1', 'master1');

            expect(utils.getAnchorRecordID(product, 'variant-level', INDEX_EVERYTHING)).toBe('variant1');
        });

        it('anchors a master on its default variant, since masters are not indexed', () => {
            const product = masterMock('master1', variantMock('variant1', 'master1'));

            expect(utils.getAnchorRecordID(product, 'variant-level', INDEX_EVERYTHING)).toBe('variant1');
        });

        it('anchors a variation group on its default variant', () => {
            const product = variationGroupMock('variationGroup1', 'master1', variantMock('variant1', 'master1'));

            expect(utils.getAnchorRecordID(product, 'variant-level', INDEX_EVERYTHING)).toBe('variant1');
        });

        // The bug this ticket fixes. Before the change all four of these resolved to null and were
        // dropped, because anything that was not a variant or a variation group was treated as a
        // master and sent to getDefaultVariant().
        it('anchors a simple product on its own ID', () => {
            expect(utils.getAnchorRecordID(productMock('simple1'), 'variant-level', INDEX_EVERYTHING)).toBe('simple1');
        });

        it('anchors a bundle on its own ID', () => {
            const bundle = productMock('bundle1', { isBundle: jest.fn(() => true) });

            expect(utils.getAnchorRecordID(bundle, 'variant-level', INDEX_EVERYTHING)).toBe('bundle1');
        });

        it('anchors a product set on its own ID', () => {
            const productSet = productMock('set1', { isProductSet: jest.fn(() => true) });

            expect(utils.getAnchorRecordID(productSet, 'variant-level', INDEX_EVERYTHING)).toBe('set1');
        });

        it('anchors an option product on its own ID', () => {
            const optionProduct = productMock('option1', { getOptionModel: jest.fn(() => ({})) });

            expect(utils.getAnchorRecordID(optionProduct, 'variant-level', INDEX_EVERYTHING)).toBe('option1');
        });

        it('never reaches the variation model of a product that is not a master or a variation group', () => {
            const simpleProduct = productMock('simple1', { getVariationModel: jest.fn() });

            utils.getAnchorRecordID(simpleProduct, 'variant-level', INDEX_EVERYTHING);

            expect(simpleProduct.getVariationModel).not.toHaveBeenCalled();
        });
    });

    describe('master-level record model', () => {
        it('anchors a variant on its master', () => {
            const product = variantMock('variant1', 'master1');

            expect(utils.getAnchorRecordID(product, 'master-level', INDEX_EVERYTHING)).toBe('master1');
        });

        it('anchors a master on its own ID', () => {
            const product = masterMock('master1', variantMock('variant1', 'master1'));

            expect(utils.getAnchorRecordID(product, 'master-level', INDEX_EVERYTHING)).toBe('master1');
        });

        it('anchors a variation group on its master, since variation groups are not indexed', () => {
            const product = variationGroupMock('variationGroup1', 'master1', variantMock('variant1', 'master1'));

            expect(utils.getAnchorRecordID(product, 'master-level', INDEX_EVERYTHING)).toBe('master1');
        });

        it('anchors a simple product on its own ID', () => {
            expect(utils.getAnchorRecordID(productMock('simple1'), 'master-level', INDEX_EVERYTHING)).toBe('simple1');
        });

        it('anchors a bundle on its own ID', () => {
            const bundle = productMock('bundle1', { isBundle: jest.fn(() => true) });

            expect(utils.getAnchorRecordID(bundle, 'master-level', INDEX_EVERYTHING)).toBe('bundle1');
        });

        it('never reaches the variation model, since no product resolves to a default variant', () => {
            const product = masterMock('master1', variantMock('variant1', 'master1'));

            utils.getAnchorRecordID(product, 'master-level', INDEX_EVERYTHING);

            expect(product.getVariationModel).not.toHaveBeenCalled();
        });
    });

    describe('attribute-sliced record model', () => {
        // Reproduces the case debugged on the sandbox: the variant's own ID has no record, the
        // slice holding its color does.
        it('anchors a variant on the slice holding its grouping attribute value', () => {
            const product = slicedVariantMock('013742003154M', '25720054M', 'JJG03XX');

            expect(utils.getAnchorRecordID(product, 'attribute-sliced', SLICED_BY_COLOR)).toBe('25720054M-JJG03XX');
        });

        it('anchors a master on the slice holding its default variant', () => {
            const defaultVariant = slicedVariantMock('013742003154M', '25720054M', 'JJG03XX');
            const product = masterMock('25720054M', defaultVariant);

            expect(utils.getAnchorRecordID(product, 'attribute-sliced', SLICED_BY_COLOR)).toBe('25720054M-JJG03XX');
        });

        it('anchors a variation group on the slice holding its default variant', () => {
            const defaultVariant = slicedVariantMock('013742003154M', '25720054M', 'JJG03XX');
            const product = variationGroupMock('variationGroup1', '25720054M', defaultVariant);

            expect(utils.getAnchorRecordID(product, 'attribute-sliced', SLICED_BY_COLOR)).toBe('25720054M-JJG03XX');
        });

        // A master that does not have the grouping attribute is written as a single master-level
        // record, so its variants anchor on the plain master ID.
        it('anchors a variant of a master without the grouping attribute on the master ID', () => {
            const product = variantMock('variant1', 'master1', {
                getVariationModel: jest.fn(() => ({
                    getProductVariationAttribute: jest.fn(() => null),
                    getMaster: jest.fn(() => masterProductRef('master1')),
                })),
            });

            expect(utils.getAnchorRecordID(product, 'attribute-sliced', SLICED_BY_COLOR)).toBe('master1');
        });

        it('anchors a simple product on its own ID', () => {
            expect(utils.getAnchorRecordID(productMock('simple1'), 'attribute-sliced', SLICED_BY_COLOR)).toBe('simple1');
        });

        it('anchors a bundle on its own ID', () => {
            const bundle = productMock('bundle1', { isBundle: jest.fn(() => true) });

            expect(utils.getAnchorRecordID(bundle, 'attribute-sliced', SLICED_BY_COLOR)).toBe('bundle1');
        });

        it('returns null when no grouping attribute is configured, since no record ID can be built', () => {
            const product = slicedVariantMock('013742003154M', '25720054M', 'JJG03XX');

            expect(utils.getAnchorRecordID(product, 'attribute-sliced', INDEX_EVERYTHING)).toBeNull();
        });

        // Every slice is built from the master, so an offline master has no slice records at all,
        // however online its individual variants are.
        it('returns null for a variant of an offline master', () => {
            const offlineMaster = masterMock('25720054M', null, { isOnline: jest.fn(() => false) });
            const product = slicedVariantMock('013742003154M', '25720054M', 'JJG03XX', {
                getMasterProduct: jest.fn(() => offlineMaster),
            });

            expect(utils.getAnchorRecordID(product, 'attribute-sliced', SLICED_BY_COLOR)).toBeNull();
        });
    });

    describe('site preferences', () => {
        it('falls back to reading the site preferences when they are not passed in', () => {
            global.customPreferences.Algolia_IndexOutOfStock = true;
            const product = variantMock('variant1', 'master1');

            expect(utils.getAnchorRecordID(product, 'variant-level')).toBe('variant1');

            delete global.customPreferences.Algolia_IndexOutOfStock;
        });
    });

    describe('an unrecognized record model', () => {
        it('falls back to the product ID, matching the variant-level model', () => {
            const product = variantMock('variant1', 'master1');

            expect(utils.getAnchorRecordID(product, '', INDEX_EVERYTHING)).toBe('variant1');
        });
    });

    describe('products that have no record to anchor on', () => {
        it('returns null for a product that no longer resolves in the catalog', () => {
            expect(utils.getAnchorRecordID(null, 'variant-level', INDEX_EVERYTHING)).toBeNull();
        });

        it('returns null for a master that has no default variant', () => {
            const product = masterMock('master2', null);

            expect(utils.getAnchorRecordID(product, 'variant-level', INDEX_EVERYTHING)).toBeNull();
        });

        it('returns null for an offline product, which the jobs do not index', () => {
            const product = productMock('simple1', { isOnline: jest.fn(() => false) });

            expect(utils.getAnchorRecordID(product, 'variant-level', INDEX_EVERYTHING)).toBeNull();
        });

        it('returns null for a product that is not searchable', () => {
            const product = productMock('simple1', { isSearchable: jest.fn(() => false) });

            expect(utils.getAnchorRecordID(product, 'variant-level', INDEX_EVERYTHING)).toBeNull();
        });

        it('returns null for a product with no online category', () => {
            const product = productMock('simple1', { getOnlineCategories: jest.fn(() => []) });

            expect(utils.getAnchorRecordID(product, 'variant-level', INDEX_EVERYTHING)).toBeNull();
        });

        it('returns null for a variant whose master has no online category', () => {
            const product = variantMock('variant1', 'master1', {
                getMasterProduct: jest.fn(() => ({
                    getID: jest.fn(() => 'master1'),
                    getOnlineCategories: jest.fn(() => []),
                })),
            });

            expect(utils.getAnchorRecordID(product, 'variant-level', INDEX_EVERYTHING)).toBeNull();
        });

        it('returns null for an offline master under the master-level model', () => {
            const product = masterMock('master1', variantMock('variant1', 'master1'), { isOnline: jest.fn(() => false) });

            expect(utils.getAnchorRecordID(product, 'master-level', INDEX_EVERYTHING)).toBeNull();
        });

        it('returns null for an out-of-stock product when out-of-stock products are not indexed', () => {
            const product = productMock('simple1', { getAvailabilityModel: jest.fn(() => availabilityModelWithATS(0)) });

            expect(utils.getAnchorRecordID(product, 'variant-level', { InStockThreshold: 1, IndexOutOfStock: false })).toBeNull();
        });

        it('anchors an out-of-stock product when out-of-stock products are indexed', () => {
            const product = productMock('simple1', { getAvailabilityModel: jest.fn(() => availabilityModelWithATS(0)) });

            expect(utils.getAnchorRecordID(product, 'variant-level', INDEX_EVERYTHING)).toBe('simple1');
        });

        it('returns null for a product below the in-stock threshold', () => {
            const product = productMock('simple1', { getAvailabilityModel: jest.fn(() => availabilityModelWithATS(4)) });

            expect(utils.getAnchorRecordID(product, 'variant-level', { InStockThreshold: 5, IndexOutOfStock: false })).toBeNull();
        });

        it('anchors a product at the in-stock threshold', () => {
            const product = productMock('simple1', { getAvailabilityModel: jest.fn(() => availabilityModelWithATS(5)) });

            expect(utils.getAnchorRecordID(product, 'variant-level', { InStockThreshold: 5, IndexOutOfStock: false })).toBe('simple1');
        });

        it('returns null for a master under the master-level model when none of its variants is in stock', () => {
            const outOfStockVariant = variantMock('variant1', 'master1', {
                getAvailabilityModel: jest.fn(() => availabilityModelWithATS(0)),
            });
            const product = masterMock('master1', outOfStockVariant);

            expect(utils.getAnchorRecordID(product, 'master-level', { InStockThreshold: 1, IndexOutOfStock: false })).toBeNull();
        });

        it('anchors a master under the master-level model when one of its variants is in stock', () => {
            const product = masterMock('master1', variantMock('variant1', 'master1'));

            expect(utils.getAnchorRecordID(product, 'master-level', { InStockThreshold: 1, IndexOutOfStock: false })).toBe('master1');
        });

        // The master's `variants` array only holds variants that pass isInclude() as well, and the
        // job writes no master record when that array comes out empty.
        it('returns null for a master under the master-level model whose only in-stock variant is offline', () => {
            const offlineInStockVariant = variantMock('variant1', 'master1', { isOnline: jest.fn(() => false) });
            const inStockButOfflineOnly = masterMock('master1', offlineInStockVariant);

            expect(utils.getAnchorRecordID(inStockButOfflineOnly, 'master-level', { InStockThreshold: 1, IndexOutOfStock: false })).toBeNull();
        });

        it('anchors a master under the master-level model when a later variant is indexable', () => {
            const offlineVariant = variantMock('variant1', 'master1', { isOnline: jest.fn(() => false) });
            const indexableVariant = variantMock('variant2', 'master1');
            const product = masterMock('master1', offlineVariant, {}, [offlineVariant, indexableVariant]);

            expect(utils.getAnchorRecordID(product, 'master-level', { InStockThreshold: 1, IndexOutOfStock: false })).toBe('master1');
        });
    });
});

describe('getAnchorProductIDs', () => {
    beforeEach(() => {
        productMgrMock.getProduct.mockReset();
        global.session.privacy.algoliaAnchorProducts = null;
        global.customPreferences.Algolia_RecordModel = 'variant-level';
        global.customPreferences.Algolia_IndexOutOfStock = true;
        delete global.customPreferences.Algolia_AttributeSlicedRecordModel_GroupingAttribute;
    });

    describe('anchor sources', () => {
        it('returns an empty string when there are no anchor products and no slot content', () => {
            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe('');
        });

        it('returns an empty string when called with no slot content at all', () => {
            expect(utils.getAnchorProductIDs()).toBe('');
        });

        it('reads anchor products from the session when present', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['variant1']);
            productMgrMock.getProduct.mockReturnValue(variantMock('variant1', 'master1'));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['variant1']));
        });

        it('falls back to slot content when the session holds no anchor products', () => {
            const slotcontent = { content: [{ getID: jest.fn(() => 'variant1') }] };
            productMgrMock.getProduct.mockReturnValue(variantMock('variant1', 'master1'));

            expect(utils.getAnchorProductIDs(slotcontent)).toBe(JSON.stringify(['variant1']));
        });
    });

    describe('preferences', () => {
        it('resolves the anchors with the configured record model', () => {
            global.customPreferences.Algolia_RecordModel = 'master-level';
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['variant1']);
            productMgrMock.getProduct.mockReturnValue(variantMock('variant1', 'master1'));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['master1']));
        });

        it('resolves the anchors with the configured grouping attribute', () => {
            global.customPreferences.Algolia_RecordModel = 'attribute-sliced';
            global.customPreferences.Algolia_AttributeSlicedRecordModel_GroupingAttribute = 'color';
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['013742003154M']);
            productMgrMock.getProduct.mockReturnValue(slicedVariantMock('013742003154M', '25720054M', 'JJG03XX'));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['25720054M-JJG03XX']));
        });

        it('drops an out-of-stock product when out-of-stock products are not indexed', () => {
            global.customPreferences.Algolia_IndexOutOfStock = false;
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['simple1']);
            productMgrMock.getProduct.mockReturnValue(productMock('simple1', {
                getAvailabilityModel: jest.fn(() => availabilityModelWithATS(0)),
            }));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe('');
        });
    });

    describe('products without a record', () => {
        it('skips a product that no longer resolves in the catalog', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['gone', 'variant1']);
            productMgrMock.getProduct
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(variantMock('variant1', 'master1'));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['variant1']));
        });

        // An empty array would be truthy in `recommend-config.js` and build a widget with no
        // objectIDs, which is worse than building no widget at all.
        it('returns an empty string when no anchor product resolves to a record', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['gone']);
            productMgrMock.getProduct.mockReturnValue(null);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe('');
        });

        it('returns an empty string when the attribute-sliced model has no grouping attribute', () => {
            global.customPreferences.Algolia_RecordModel = 'attribute-sliced';
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['013742003154M']);
            productMgrMock.getProduct.mockReturnValue(slicedVariantMock('013742003154M', '25720054M', 'JJG03XX'));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe('');
        });
    });

    describe('duplicate anchors', () => {
        it('sends one anchor for two variants of the same slice', () => {
            global.customPreferences.Algolia_RecordModel = 'attribute-sliced';
            global.customPreferences.Algolia_AttributeSlicedRecordModel_GroupingAttribute = 'color';
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['smallRed', 'largeRed']);
            productMgrMock.getProduct
                .mockReturnValueOnce(slicedVariantMock('smallRed', '25720054M', 'JJG03XX'))
                .mockReturnValueOnce(slicedVariantMock('largeRed', '25720054M', 'JJG03XX'));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['25720054M-JJG03XX']));
        });
    });

    describe('anchor cap', () => {
        it('sends at most MAX_ANCHOR_PRODUCTS anchors', () => {
            const ids = [];
            for (let i = 1; i <= utils.MAX_ANCHOR_PRODUCTS + 2; i++) {
                ids.push('v' + i);
            }
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(ids);
            productMgrMock.getProduct.mockImplementation((id) => productMock(id));

            const anchors = JSON.parse(utils.getAnchorProductIDs(emptySlotcontent));

            expect(anchors).toHaveLength(utils.MAX_ANCHOR_PRODUCTS);
            expect(anchors).toEqual(ids.slice(0, utils.MAX_ANCHOR_PRODUCTS));
        });

        it('does not count skipped products against the cap', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['gone', 'v1', 'v2']);
            productMgrMock.getProduct.mockImplementation((id) => (id === 'gone' ? null : productMock(id)));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['v1', 'v2']));
        });
    });
});
