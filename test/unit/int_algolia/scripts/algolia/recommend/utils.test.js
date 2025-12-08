describe('getAnchorProductIDs', () => {
    const productMgrMock = require('dw/catalog/ProductMgr');
    const algoliaDataMock = jest.mock('*/cartridge/scripts/algolia/lib/algoliaData');

    const variantProduct = {
        ID: 'product1',
        isVariationGroup: jest.fn(() => false),
        isVariant: jest.fn(() => true),
        master: false,
        masterProduct: {
            ID: 'masterProduct1'
        },
    };

    const masterProduct = {
        ID: 'masterProduct1',
        isVariationGroup: jest.fn(() => false),
        isVariant: jest.fn(() => false),
        master: true,
        variationModel: {
            defaultVariant: {
                ID: 'product1'
            },
        }
    };

    const variationGroupProduct = {
        ID: 'variationGroupProduct',
        isVariationGroup: jest.fn(() => true),
        isVariant: jest.fn(() => false),
        master: false,
        variationModel: {
            defaultVariant: {
                ID: 'product1'
            },
        },
        masterProduct: {
            ID: 'masterProduct1'
        },
    };

    beforeEach(() => {
        productMgrMock.getProduct.mockReset();

        if (algoliaDataMock.getPreference && algoliaDataMock.getPreference.mockReset) {
            algoliaDataMock.getPreference.mockReset();
        } else {
            algoliaDataMock.getPreference = jest.fn();
        }
    });

    const utils = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/recommend/utils');

    it('should return empty string if no anchor products or slot content', () => {
        const slotcontent = {
            content: []
        };
        expect(utils.getAnchorProductIDs(slotcontent)).toBe('');
    });

    it('should return anchor product IDs from session if available', () => {
        global.session.privacy.algoliaAnchorProducts = JSON.stringify(['product1']);
        const slotcontent = {
            content: []
        };
        productMgrMock.getProduct.mockReturnValue(variantProduct);
        expect(utils.getAnchorProductIDs(slotcontent)).toBe(JSON.stringify(['product1']));
    });

    it('should return product IDs from slot content if no anchor products in session', () => {
        global.session.privacy.algoliaAnchorProducts = null;
        const slotcontent = {
            content: [{
                ID: 'product1'
            }, {
                ID: 'product1'
            }]
        };
        productMgrMock.getProduct.mockReturnValue(variantProduct);
        expect(utils.getAnchorProductIDs(slotcontent)).toBe(JSON.stringify(['product1', 'product1']));
    });

    it('should return a variant when we use variant-model and anchor product is a variant product', () => {
        global.session.privacy.algoliaAnchorProducts = JSON.stringify(['product1']);
        const slotcontent = {
            content: []
        };
        productMgrMock.getProduct.mockReturnValue(variantProduct);
        expect(utils.getAnchorProductIDs(slotcontent)).toBe(JSON.stringify(['product1']));
    });

    it('should return a variant when we use variant-model and anchor product is a master product', () => {
        global.session.privacy.algoliaAnchorProducts = JSON.stringify(['masterProduct1']);
        const slotcontent = {
            content: []
        };
        productMgrMock.getProduct.mockReturnValue(masterProduct);
        expect(utils.getAnchorProductIDs(slotcontent)).toBe(JSON.stringify(['product1']));
    });

    it('should return a variant when we use variant-model and anchor product is a variation group product', () => {
        global.session.privacy.algoliaAnchorProducts = JSON.stringify(['variationGroupProduct']);
        const slotcontent = {
            content: []
        };
        productMgrMock.getProduct.mockReturnValue(variationGroupProduct);
        expect(utils.getAnchorProductIDs(slotcontent)).toBe(JSON.stringify(['product1']));
    });

    it('should return a master when we use master-model and anchor product is a master product', () => {
        global.session.privacy.algoliaAnchorProducts = JSON.stringify(['masterProduct1']);
        const slotcontent = {
            content: []
        };
        global.customPreferences.Algolia_RecordModel = 'master-level';
        productMgrMock.getProduct.mockReturnValue(masterProduct);
        expect(utils.getAnchorProductIDs(slotcontent)).toBe(JSON.stringify(['masterProduct1']));
    });

    it('should return a master when we use master-model and anchor product is a variation group product', () => {
        global.session.privacy.algoliaAnchorProducts = JSON.stringify(['variationGroupProduct']);
        const slotcontent = {
            content: []
        };
        algoliaDataMock.getPreference.mockReturnValue('master-level');
        productMgrMock.getProduct.mockReturnValue(variationGroupProduct);
        expect(utils.getAnchorProductIDs(slotcontent)).toBe(JSON.stringify(['masterProduct1']));
    });


    it('should return a master when we use variant-model and anchor product is a variant product', () => {
        global.session.privacy.algoliaAnchorProducts = JSON.stringify(['product1']);
        const slotcontent = {
            content: []
        };
        algoliaDataMock.getPreference.mockReturnValue('master-level');
        productMgrMock.getProduct.mockReturnValue(variantProduct);
        expect(utils.getAnchorProductIDs(slotcontent)).toBe(JSON.stringify(['masterProduct1']));
    });
});
