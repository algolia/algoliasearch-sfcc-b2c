/**
 * The record model is read through the real `algoliaData.getPreference`, which resolves it from
 * `global.customPreferences` via the Site mock. Setting that global is therefore the only way to
 * drive the module; a `jest.fn()` on algoliaData is not wired to it. Every test sets the model it
 * needs and `beforeEach` resets it, so no test depends on another having run first.
 */
const productMgrMock = require('dw/catalog/ProductMgr');
const utils = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/recommend/utils');

const emptySlotcontent = { content: [] };

/**
 * Builds a variation model that only answers getDefaultVariant().
 * @param {Object|null} defaultVariant the variant to return
 * @returns {Object} variation model mock
 */
function variationModelWithDefault(defaultVariant) {
    return { getDefaultVariant: jest.fn(() => defaultVariant) };
}

const variantProduct = {
    ID: 'variant1',
    getID: jest.fn(() => 'variant1'),
    isMaster: jest.fn(() => false),
    isVariant: jest.fn(() => true),
    isVariationGroup: jest.fn(() => false),
    getMasterProduct: jest.fn(() => ({ getID: jest.fn(() => 'master1') })),
};

const masterProduct = {
    ID: 'master1',
    getID: jest.fn(() => 'master1'),
    isMaster: jest.fn(() => true),
    isVariant: jest.fn(() => false),
    isVariationGroup: jest.fn(() => false),
    getVariationModel: jest.fn(() => variationModelWithDefault({ getID: jest.fn(() => 'variant1') })),
};

const masterWithoutVariants = {
    ID: 'master2',
    getID: jest.fn(() => 'master2'),
    isMaster: jest.fn(() => true),
    isVariant: jest.fn(() => false),
    isVariationGroup: jest.fn(() => false),
    getVariationModel: jest.fn(() => variationModelWithDefault(null)),
};

const variationGroupProduct = {
    ID: 'variationGroup1',
    getID: jest.fn(() => 'variationGroup1'),
    isMaster: jest.fn(() => false),
    isVariant: jest.fn(() => false),
    isVariationGroup: jest.fn(() => true),
    getMasterProduct: jest.fn(() => ({ getID: jest.fn(() => 'master1') })),
    getVariationModel: jest.fn(() => variationModelWithDefault({ getID: jest.fn(() => 'variant1') })),
};

// A simple product answers false to all three predicates and has no usable variation model.
// This is the case that used to be dropped: it was labelled a master, sent to getDefaultVariant(),
// and resolved to null.
const simpleProduct = {
    ID: 'simple1',
    getID: jest.fn(() => 'simple1'),
    isMaster: jest.fn(() => false),
    isVariant: jest.fn(() => false),
    isVariationGroup: jest.fn(() => false),
};

const bundleProduct = {
    ID: 'bundle1',
    getID: jest.fn(() => 'bundle1'),
    isMaster: jest.fn(() => false),
    isVariant: jest.fn(() => false),
    isVariationGroup: jest.fn(() => false),
    isBundle: jest.fn(() => true),
};

/**
 * Builds a variant whose attribute-sliced record is `<masterID>-<colorValueID>`, mirroring the
 * shape the indexing jobs write.
 * @param {string} id variant ID
 * @param {string} masterID master ID
 * @param {string} colorValueID grouping attribute value ID
 * @returns {Object} variant mock
 */
function slicedVariant(id, masterID, colorValueID) {
    return {
        ID: id,
        getID: jest.fn(() => id),
        isMaster: jest.fn(() => false),
        isVariant: jest.fn(() => true),
        isVariationGroup: jest.fn(() => false),
        getMasterProduct: jest.fn(() => ({ getID: jest.fn(() => masterID) })),
        getVariationModel: jest.fn(() => ({
            getProductVariationAttribute: jest.fn(() => ({ getID: jest.fn(() => 'color') })),
            getMaster: jest.fn(() => ({ getID: jest.fn(() => masterID) })),
            getSelectedValue: jest.fn(() => ({ getID: jest.fn(() => colorValueID) })),
        })),
    };
}

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

        it('reads anchor products from the session when present', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['variant1']);
            productMgrMock.getProduct.mockReturnValue(variantProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['variant1']));
        });

        it('falls back to slot content when the session holds no anchor products', () => {
            const slotcontent = { content: [{ getID: jest.fn(() => 'variant1') }] };
            productMgrMock.getProduct.mockReturnValue(variantProduct);

            expect(utils.getAnchorProductIDs(slotcontent)).toBe(JSON.stringify(['variant1']));
        });
    });

    describe('variant-level record model', () => {
        beforeEach(() => {
            global.customPreferences.Algolia_RecordModel = 'variant-level';
        });

        it('anchors a variant on its own ID', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['variant1']);
            productMgrMock.getProduct.mockReturnValue(variantProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['variant1']));
        });

        it('anchors a master on its default variant, since masters are not indexed', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['master1']);
            productMgrMock.getProduct.mockReturnValue(masterProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['variant1']));
        });

        it('anchors a variation group on its default variant', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['variationGroup1']);
            productMgrMock.getProduct.mockReturnValue(variationGroupProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['variant1']));
        });

        // The bug this ticket fixes. Before the change these two resolved to null and were dropped.
        it('anchors a simple product on its own ID', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['simple1']);
            productMgrMock.getProduct.mockReturnValue(simpleProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['simple1']));
        });

        it('anchors a bundle on its own ID', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['bundle1']);
            productMgrMock.getProduct.mockReturnValue(bundleProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['bundle1']));
        });

        it('never calls getVariationModel on a simple product', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['simple1']);
            productMgrMock.getProduct.mockReturnValue(simpleProduct);

            utils.getAnchorProductIDs(emptySlotcontent);

            expect(simpleProduct.getVariationModel).toBeUndefined();
        });
    });

    describe('master-level record model', () => {
        beforeEach(() => {
            global.customPreferences.Algolia_RecordModel = 'master-level';
        });

        it('anchors a variant on its master', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['variant1']);
            productMgrMock.getProduct.mockReturnValue(variantProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['master1']));
        });

        it('anchors a master on its own ID', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['master1']);
            productMgrMock.getProduct.mockReturnValue(masterProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['master1']));
        });

        it('anchors a variation group on its master, since variation groups are not indexed', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['variationGroup1']);
            productMgrMock.getProduct.mockReturnValue(variationGroupProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['master1']));
        });

        it('anchors a simple product on its own ID', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['simple1']);
            productMgrMock.getProduct.mockReturnValue(simpleProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['simple1']));
        });
    });

    describe('attribute-sliced record model', () => {
        beforeEach(() => {
            global.customPreferences.Algolia_RecordModel = 'attribute-sliced';
            global.customPreferences.Algolia_AttributeSlicedRecordModel_GroupingAttribute = 'color';
        });

        // Reproduces the case debugged on the sandbox: the variant's own ID has no record, the
        // slice holding its colour does.
        it('anchors a variant on the slice holding its grouping attribute value', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['013742003154M']);
            productMgrMock.getProduct.mockReturnValue(slicedVariant('013742003154M', '25720054M', 'JJG03XX'));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['25720054M-JJG03XX']));
        });

        it('anchors a master on the slice holding its default variant', () => {
            const defaultVariant = slicedVariant('013742003154M', '25720054M', 'JJG03XX');
            const slicedMaster = {
                ID: '25720054M',
                getID: jest.fn(() => '25720054M'),
                isMaster: jest.fn(() => true),
                isVariant: jest.fn(() => false),
                isVariationGroup: jest.fn(() => false),
                getVariationModel: jest.fn(() => variationModelWithDefault(defaultVariant)),
            };
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['25720054M']);
            productMgrMock.getProduct.mockReturnValue(slicedMaster);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['25720054M-JJG03XX']));
        });

        it('anchors a simple product on its own ID', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['simple1']);
            productMgrMock.getProduct.mockReturnValue(simpleProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['simple1']));
        });

        it('returns an empty array when no grouping attribute is configured', () => {
            delete global.customPreferences.Algolia_AttributeSlicedRecordModel_GroupingAttribute;
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['013742003154M']);
            productMgrMock.getProduct.mockReturnValue(slicedVariant('013742003154M', '25720054M', 'JJG03XX'));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify([]));
        });

        it('sends one anchor for two variants of the same slice', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['smallRed', 'largeRed']);
            productMgrMock.getProduct
                .mockReturnValueOnce(slicedVariant('smallRed', '25720054M', 'JJG03XX'))
                .mockReturnValueOnce(slicedVariant('largeRed', '25720054M', 'JJG03XX'));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['25720054M-JJG03XX']));
        });
    });

    describe('products without a record', () => {
        it('skips a product that no longer resolves in the catalog', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['gone', 'variant1']);
            productMgrMock.getProduct
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(variantProduct);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['variant1']));
        });

        it('does not throw when every product is missing', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['gone']);
            productMgrMock.getProduct.mockReturnValue(null);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify([]));
        });

        it('skips a master that has no default variant', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['master2']);
            productMgrMock.getProduct.mockReturnValue(masterWithoutVariants);

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify([]));
        });
    });

    describe('anchor cap', () => {
        it('sends at most five anchors', () => {
            const ids = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'];
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(ids);
            productMgrMock.getProduct.mockImplementation((id) => ({
                ID: id,
                getID: jest.fn(() => id),
                isMaster: jest.fn(() => false),
                isVariant: jest.fn(() => false),
                isVariationGroup: jest.fn(() => false),
            }));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['v1', 'v2', 'v3', 'v4', 'v5']));
        });

        it('does not count skipped products against the cap', () => {
            global.session.privacy.algoliaAnchorProducts = JSON.stringify(['gone', 'v1', 'v2']);
            productMgrMock.getProduct.mockImplementation((id) => (id === 'gone' ? null : {
                ID: id,
                getID: jest.fn(() => id),
                isMaster: jest.fn(() => false),
                isVariant: jest.fn(() => false),
                isVariationGroup: jest.fn(() => false),
            }));

            expect(utils.getAnchorProductIDs(emptySlotcontent)).toBe(JSON.stringify(['v1', 'v2']));
        });
    });
});
