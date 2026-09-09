/**
 * `getAnchorRecordID` takes the record model and the grouping attribute as arguments, so the tests
 * for the record-model matrix need no global setup.
 *
 * `getAnchorProductIDs` reads both itself, through the real `algoliaData.getPreference`, which
 * resolves them from `global.customPreferences` via the Site mock. Setting that global is the only
 * way to drive it; a `jest.fn()` on algoliaData is not wired to it.
 */
const productMgrMock = require('dw/catalog/ProductMgr');
const utils = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/recommend/utils');

const emptySlotcontent = { content: [] };

/**
 * Builds a product mock that answers false to every type predicate, so each test only has to
 * describe what it is actually about.
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
    }, overrides || {});
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
        getMasterProduct: jest.fn(() => productMock(masterID, { isMaster: jest.fn(() => true) })),
    }, overrides || {}));
}

/**
 * Builds a master product.
 * @param {string} id master product ID
 * @param {Object|null} defaultVariant the variant getDefaultVariant() reports
 * @returns {Object} master product mock
 */
function masterMock(id, defaultVariant) {
    return productMock(id, {
        isMaster: jest.fn(() => true),
        getVariationModel: jest.fn(() => variationModelWithDefault(defaultVariant)),
    });
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
        getMasterProduct: jest.fn(() => productMock(masterID, { isMaster: jest.fn(() => true) })),
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
            getMaster: jest.fn(() => productMock(masterID, { isMaster: jest.fn(() => true) })),
            getSelectedValue: jest.fn(() => ({ getID: jest.fn(() => colorValueID) })),
        })),
    }, overrides || {}));
}

describe('getAnchorRecordID', () => {
    describe('variant-level record model', () => {
        it('anchors a variant on its own ID', () => {
            const product = variantMock('variant1', 'master1');

            expect(utils.getAnchorRecordID(product, 'variant-level')).toBe('variant1');
        });

        it('anchors a master on its default variant, since masters are not indexed', () => {
            const product = masterMock('master1', variantMock('variant1', 'master1'));

            expect(utils.getAnchorRecordID(product, 'variant-level')).toBe('variant1');
        });

        it('anchors a variation group on its default variant', () => {
            const product = variationGroupMock('variationGroup1', 'master1', variantMock('variant1', 'master1'));

            expect(utils.getAnchorRecordID(product, 'variant-level')).toBe('variant1');
        });

        // The bug this ticket fixes. Before the change all four of these resolved to null and were
        // dropped, because anything that was not a variant or a variation group was treated as a
        // master and sent to getDefaultVariant().
        it('anchors a simple product on its own ID', () => {
            expect(utils.getAnchorRecordID(productMock('simple1'), 'variant-level')).toBe('simple1');
        });

        it('anchors a bundle on its own ID', () => {
            const bundle = productMock('bundle1', { isBundle: jest.fn(() => true) });

            expect(utils.getAnchorRecordID(bundle, 'variant-level')).toBe('bundle1');
        });

        it('anchors a product set on its own ID', () => {
            const productSet = productMock('set1', { isProductSet: jest.fn(() => true) });

            expect(utils.getAnchorRecordID(productSet, 'variant-level')).toBe('set1');
        });

        it('anchors an option product on its own ID', () => {
            const optionProduct = productMock('option1', { getOptionModel: jest.fn(() => ({})) });

            expect(utils.getAnchorRecordID(optionProduct, 'variant-level')).toBe('option1');
        });

        it('never reaches the variation model of a product that is not a master or a variation group', () => {
            const simpleProduct = productMock('simple1', { getVariationModel: jest.fn() });

            utils.getAnchorRecordID(simpleProduct, 'variant-level');

            expect(simpleProduct.getVariationModel).not.toHaveBeenCalled();
        });
    });

    describe('master-level record model', () => {
        it('anchors a variant on its master', () => {
            const product = variantMock('variant1', 'master1');

            expect(utils.getAnchorRecordID(product, 'master-level')).toBe('master1');
        });

        it('anchors a master on its own ID', () => {
            const product = masterMock('master1', variantMock('variant1', 'master1'));

            expect(utils.getAnchorRecordID(product, 'master-level')).toBe('master1');
        });

        it('anchors a variation group on its master, since variation groups are not indexed', () => {
            const product = variationGroupMock('variationGroup1', 'master1', variantMock('variant1', 'master1'));

            expect(utils.getAnchorRecordID(product, 'master-level')).toBe('master1');
        });

        it('anchors a simple product on its own ID', () => {
            expect(utils.getAnchorRecordID(productMock('simple1'), 'master-level')).toBe('simple1');
        });

        it('anchors a bundle on its own ID', () => {
            const bundle = productMock('bundle1', { isBundle: jest.fn(() => true) });

            expect(utils.getAnchorRecordID(bundle, 'master-level')).toBe('bundle1');
        });

        it('never reaches the variation model, since no product resolves to a default variant', () => {
            const product = masterMock('master1', variantMock('variant1', 'master1'));

            utils.getAnchorRecordID(product, 'master-level');

            expect(product.getVariationModel).not.toHaveBeenCalled();
        });
    });

    describe('attribute-sliced record model', () => {
        // Reproduces the case debugged on the sandbox: the variant's own ID has no record, the
        // slice holding its color does.
        it('anchors a variant on the slice holding its grouping attribute value', () => {
            const product = slicedVariantMock('013742003154M', '25720054M', 'JJG03XX');

            expect(utils.getAnchorRecordID(product, 'attribute-sliced', 'color')).toBe('25720054M-JJG03XX');
        });

        it('anchors a master on the slice holding its default variant', () => {
            const defaultVariant = slicedVariantMock('013742003154M', '25720054M', 'JJG03XX');
            const product = masterMock('25720054M', defaultVariant);

            expect(utils.getAnchorRecordID(product, 'attribute-sliced', 'color')).toBe('25720054M-JJG03XX');
        });

        it('anchors a variation group on the slice holding its default variant', () => {
            const defaultVariant = slicedVariantMock('013742003154M', '25720054M', 'JJG03XX');
            const product = variationGroupMock('variationGroup1', '25720054M', defaultVariant);

            expect(utils.getAnchorRecordID(product, 'attribute-sliced', 'color')).toBe('25720054M-JJG03XX');
        });

        // A master that does not have the grouping attribute is written as a single master-level
        // record, so its variants anchor on the plain master ID.
        it('anchors a variant of a master without the grouping attribute on the master ID', () => {
            const product = variantMock('variant1', 'master1', {
                getVariationModel: jest.fn(() => ({
                    getProductVariationAttribute: jest.fn(() => null),
                    getMaster: jest.fn(() => productMock('master1', { isMaster: jest.fn(() => true) })),
                })),
            });

            expect(utils.getAnchorRecordID(product, 'attribute-sliced', 'color')).toBe('master1');
        });

        it('anchors a simple product on its own ID', () => {
            expect(utils.getAnchorRecordID(productMock('simple1'), 'attribute-sliced', 'color')).toBe('simple1');
        });

        it('anchors a bundle on its own ID', () => {
            const bundle = productMock('bundle1', { isBundle: jest.fn(() => true) });

            expect(utils.getAnchorRecordID(bundle, 'attribute-sliced', 'color')).toBe('bundle1');
        });

        it('returns null when no grouping attribute is configured, since no record ID can be built', () => {
            const product = slicedVariantMock('013742003154M', '25720054M', 'JJG03XX');

            expect(utils.getAnchorRecordID(product, 'attribute-sliced')).toBeNull();
        });

        it('falls back to the grouping attribute preference when it is not passed in', () => {
            global.customPreferences.Algolia_AttributeSlicedRecordModel_GroupingAttribute = 'color';
            const product = slicedVariantMock('013742003154M', '25720054M', 'JJG03XX');

            expect(utils.getAnchorRecordID(product, 'attribute-sliced')).toBe('25720054M-JJG03XX');

            delete global.customPreferences.Algolia_AttributeSlicedRecordModel_GroupingAttribute;
        });
    });

    describe('an unrecognized record model', () => {
        it('falls back to the product ID, matching the variant-level model', () => {
            const product = variantMock('variant1', 'master1');

            expect(utils.getAnchorRecordID(product, '')).toBe('variant1');
        });
    });

    describe('products that have no record to anchor on', () => {
        it('returns null for a product that no longer resolves in the catalog', () => {
            expect(utils.getAnchorRecordID(null, 'variant-level')).toBeNull();
        });

        // getDefaultVariant() returns an arbitrary variant when the master has no default variant
        // defined, so it only comes back null when there is no variant at all.
        it('returns null for a master that has no variants', () => {
            const product = masterMock('master2', null);

            expect(utils.getAnchorRecordID(product, 'variant-level')).toBeNull();
        });

        it('returns null for a variation group whose variation model has no variants', () => {
            const product = variationGroupMock('variationGroup1', 'master1', null);

            expect(utils.getAnchorRecordID(product, 'variant-level')).toBeNull();
        });
    });
});

describe('getAnchorProductIDs', () => {
    beforeEach(() => {
        productMgrMock.getProduct.mockReset();
        global.session.privacy.algoliaAnchorProducts = null;
        global.customPreferences.Algolia_RecordModel = 'variant-level';
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
