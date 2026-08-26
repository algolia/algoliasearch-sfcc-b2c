const priceHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/priceHelper');

/**
 * Minimal stand-in for dw.value.Money, with the arithmetic the helper relies on.
 * @param {number|null} value - the amount, or null for an unavailable price
 * @param {string} currencyCode - ISO 4217 code
 * @returns {Object} a Money-like object
 */
function money(value, currencyCode) {
    const code = currencyCode || 'USD';
    return {
        getValue: () => value,
        getCurrencyCode: () => (value === null ? 'N/A' : code),
        isAvailable: () => value !== null,
        // The platform rounds to the currency's precision; two decimals is enough here.
        divide: (divisor) => money(value === null ? null : Math.round((value / divisor) * 100) / 100, code),
        add: (other) => money(
            value === null || other.getValue() === null ? null : value + other.getValue(), code
        ),
        subtract: (other) => money(
            value === null || other.getValue() === null ? null : +(value - other.getValue()).toFixed(2), code
        ),
    };
}

/**
 * @param {Object} options - line item configuration
 * @returns {Object} a dw.order.ProductLineItem-like object
 */
function lineItem(options) {
    const config = options || {};
    return {
        getProductID: () => config.productID || 'PRODUCT1',
        getUUID: () => config.uuid || 'UUID1',
        getQuantityValue: () => (config.quantity === undefined ? 1 : config.quantity),
        getBasePrice: () => money(config.basePrice === undefined ? 50 : config.basePrice),
        getAdjustedPrice: () => money(config.adjustedPrice === undefined ? 50 : config.adjustedPrice),
        getOptionProductLineItems: () => ({
            iterator: () => {
                const options_ = config.optionPrices || [];
                let index = 0;
                return {
                    hasNext: () => index < options_.length,
                    next: () => {
                        const optionPrice = options_[index];
                        index += 1;
                        return { getAdjustedPrice: () => money(optionPrice) };
                    },
                };
            },
        }),
    };
}

/**
 * @param {Array} lineItems - the container's product line items
 * @returns {Object} a dw.order.LineItemCtnr-like object
 */
function lineItemCtnr(lineItems) {
    return {
        getProductLineItems: () => ({
            iterator: () => {
                let index = 0;
                return {
                    hasNext: () => index < lineItems.length,
                    next: () => {
                        const item = lineItems[index];
                        index += 1;
                        return item;
                    },
                };
            },
        }),
    };
}

describe('findProductLineItem', () => {
    test('returns the line item matching the product ID', () => {
        const wanted = lineItem({ productID: 'B' });
        const basket = lineItemCtnr([lineItem({ productID: 'A' }), wanted]);
        expect(priceHelper.findProductLineItem(basket, 'B')).toBe(wanted);
    });

    test('returns the first match when a product appears more than once', () => {
        const first = lineItem({ productID: 'A' });
        const basket = lineItemCtnr([first, lineItem({ productID: 'A' })]);
        expect(priceHelper.findProductLineItem(basket, 'A')).toBe(first);
    });

    test('returns null when the product is not in the container', () => {
        expect(priceHelper.findProductLineItem(lineItemCtnr([lineItem({ productID: 'A' })]), 'B')).toBeNull();
    });

    test('returns null for a missing container or product ID', () => {
        expect(priceHelper.findProductLineItem(null, 'A')).toBeNull();
        expect(priceHelper.findProductLineItem(lineItemCtnr([]), null)).toBeNull();
    });
});

describe('findLineItemByUUID', () => {
    test('returns the line item matching the UUID', () => {
        const wanted = lineItem({ uuid: 'U2' });
        const basket = lineItemCtnr([lineItem({ uuid: 'U1' }), wanted]);
        expect(priceHelper.findLineItemByUUID(basket, 'U2')).toBe(wanted);
    });

    test('tells apart two line items for the same product with different options', () => {
        // SFRA creates a separate line item when a product is added with other option values, so
        // the product ID alone cannot say which configuration was added.
        const silver = lineItem({ productID: 'A', uuid: 'U1', adjustedPrice: 50 });
        const gold = lineItem({ productID: 'A', uuid: 'U2', adjustedPrice: 70 });
        const basket = lineItemCtnr([silver, gold]);
        expect(priceHelper.findLineItemByUUID(basket, 'U2')).toBe(gold);
        expect(priceHelper.findProductLineItem(basket, 'A')).toBe(silver);
    });

    test('returns null when no line item has the UUID', () => {
        expect(priceHelper.findLineItemByUUID(lineItemCtnr([lineItem({ uuid: 'U1' })]), 'U2')).toBeNull();
    });

    test('returns null for a missing container or UUID', () => {
        expect(priceHelper.findLineItemByUUID(null, 'U1')).toBeNull();
        expect(priceHelper.findLineItemByUUID(lineItemCtnr([lineItem({ uuid: 'U1' })]), null)).toBeNull();
    });
});

describe('getLineItemPriceData', () => {
    test('reports the per-unit price and currency', () => {
        expect(priceHelper.getLineItemPriceData(lineItem({
            quantity: 1, basePrice: 50, adjustedPrice: 50,
        }))).toEqual({ price: 50, currency: 'USD' });
    });

    test('divides the extended price by the quantity', () => {
        // This is the tiered-pricing case: ten units at the 45.00 tier.
        expect(priceHelper.getLineItemPriceData(lineItem({
            quantity: 10, basePrice: 45, adjustedPrice: 450,
        }))).toEqual({ price: 45, currency: 'USD' });
    });

    test('reports a discount when the adjusted price is below the base price', () => {
        expect(priceHelper.getLineItemPriceData(lineItem({
            quantity: 2, basePrice: 50, adjustedPrice: 80,
        }))).toEqual({ price: 40, currency: 'USD', discount: 10 });
    });

    test('omits the discount when there is none', () => {
        const priceData = priceHelper.getLineItemPriceData(lineItem({
            quantity: 1, basePrice: 50, adjustedPrice: 50,
        }));
        expect('discount' in priceData).toBe(false);
    });

    test('adds option value prices into the reported price', () => {
        expect(priceHelper.getLineItemPriceData(lineItem({
            quantity: 1, basePrice: 50, adjustedPrice: 50, optionPrices: [10, 5],
        }))).toEqual({ price: 65, currency: 'USD' });
    });

    test('measures the discount on the product alone, not on option values', () => {
        const priceData = priceHelper.getLineItemPriceData(lineItem({
            quantity: 1, basePrice: 50, adjustedPrice: 40, optionPrices: [10],
        }));
        expect(priceData).toEqual({ price: 50, currency: 'USD', discount: 10 });
    });

    test('falls back to the base price when the adjusted price is unavailable', () => {
        // SFRA's calculate hook sets the line item price to null when the platform cannot resolve
        // a price for the ordered quantity, which leaves the adjusted price unavailable.
        expect(priceHelper.getLineItemPriceData(lineItem({
            quantity: 1, basePrice: 50, adjustedPrice: null,
        }))).toEqual({ price: 50, currency: 'USD' });
    });

    test('reports no discount when falling back to the base price', () => {
        const priceData = priceHelper.getLineItemPriceData(lineItem({
            quantity: 2, basePrice: 50, adjustedPrice: null,
        }));
        expect(priceData).toEqual({ price: 50, currency: 'USD' });
    });

    test('returns null when neither the adjusted nor the base price is available', () => {
        expect(priceHelper.getLineItemPriceData(lineItem({
            basePrice: null, adjustedPrice: null,
        }))).toBeNull();
    });

    test('returns null for a quantity of zero, rather than dividing by it', () => {
        expect(priceHelper.getLineItemPriceData(lineItem({ quantity: 0 }))).toBeNull();
    });

    test('returns null for a missing line item', () => {
        expect(priceHelper.getLineItemPriceData(null)).toBeNull();
    });

    test('reports a price without a discount when the base price is unavailable', () => {
        expect(priceHelper.getLineItemPriceData(lineItem({
            quantity: 1, basePrice: null, adjustedPrice: 50,
        }))).toEqual({ price: 50, currency: 'USD' });
    });

    test('keeps the currency of the line item', () => {
        const item = lineItem({ quantity: 1, adjustedPrice: 42 });
        item.getAdjustedPrice = () => money(42, 'EUR');
        expect(priceHelper.getLineItemPriceData(item).currency).toBe('EUR');
    });
});
