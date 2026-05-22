'use strict';

const {
    attributeConfig_v2,
    defaultAttributes_v2,
    defaultMasterAttributes_v2,
    defaultVariantAttributes_v2,
} = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaProductConfig');

// Canonical list of dw.catalog.ProductActiveData properties (48), keyed by bare ID.
// Each handler must resolve to `activeData.<id>`, with `localized: false` and
// `variantAttribute: false` (flat at the master record root).
const ACTIVE_DATA_IDS = [
    'ordersDay', 'ordersWeek', 'ordersMonth', 'ordersYear',
    'revenueDay', 'revenueWeek', 'revenueMonth', 'revenueYear',
    'conversionDay', 'conversionWeek', 'conversionMonth', 'conversionYear',
    'salesVelocityDay', 'salesVelocityWeek', 'salesVelocityMonth', 'salesVelocityYear',
    'viewsDay', 'viewsWeek', 'viewsMonth', 'viewsYear',
    'impressionsDay', 'impressionsWeek', 'impressionsMonth', 'impressionsYear',
    'unitsDay', 'unitsWeek', 'unitsMonth', 'unitsYear',
    'lookToBookRatioDay', 'lookToBookRatioWeek', 'lookToBookRatioMonth', 'lookToBookRatioYear',
    'avgSalesPriceDay', 'avgSalesPriceWeek', 'avgSalesPriceMonth', 'avgSalesPriceYear',
    'avgGrossMarginPercentDay', 'avgGrossMarginPercentWeek', 'avgGrossMarginPercentMonth', 'avgGrossMarginPercentYear',
    'avgGrossMarginValueDay', 'avgGrossMarginValueWeek', 'avgGrossMarginValueMonth', 'avgGrossMarginValueYear',
    'costPrice', 'returnRate',
    'availableDate', 'daysAvailable',
];

describe('algoliaProductConfig - Active Data handlers', () => {
    test('the canonical list contains all 48 ProductActiveData IDs', () => {
        expect(ACTIVE_DATA_IDS).toHaveLength(48);
        expect(new Set(ACTIVE_DATA_IDS).size).toBe(48);
    });

    describe.each(ACTIVE_DATA_IDS)('attributeConfig_v2.%s', (id) => {
        test('is registered with bare-name → activeData.<id> mapping, flat at root', () => {
            const entry = attributeConfig_v2[id];
            expect(entry).toBeDefined();
            expect(entry).toEqual({
                attribute: 'activeData.' + id,
                localized: false,
                variantAttribute: false,
            });
        });
    });

    test('none of the 48 IDs are present in defaultAttributes_v2 (Active Data must remain opt-in)', () => {
        ACTIVE_DATA_IDS.forEach((id) => {
            expect(defaultAttributes_v2).not.toContain(id);
        });
    });

    test('none of the 48 IDs are present in defaultMasterAttributes_v2 / defaultVariantAttributes_v2', () => {
        ACTIVE_DATA_IDS.forEach((id) => {
            expect(defaultMasterAttributes_v2).not.toContain(id);
            expect(defaultVariantAttributes_v2).not.toContain(id);
        });
    });
});
