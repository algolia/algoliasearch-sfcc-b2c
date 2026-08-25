'use strict';

const algoliaLogger = require('dw/system/Logger').getLogger('algolia');

/**
 * Finds the top-level product line item for a product in a basket or order.
 *
 * @param {dw.order.LineItemCtnr} lineItemCtnr - the basket or order
 * @param {string} productID - the product ID to look for
 * @returns {dw.order.ProductLineItem|null} the first matching line item, or null
 */
function findProductLineItem(lineItemCtnr, productID) {
    if (!lineItemCtnr || !productID) {
        return null;
    }

    const lineItems = lineItemCtnr.getProductLineItems().iterator();

    while (lineItems.hasNext()) {
        const lineItem = lineItems.next();
        if (lineItem.getProductID() === productID) {
            return lineItem;
        }
    }

    return null;
}

/**
 * Reads the price actually charged for a line item, per unit, for use as Insights `objectData`.
 *
 * The Insights API defines `price` as the final per-item price inclusive of any discounts, and
 * derives revenue from `price` multiplied by `quantity`. The line item already holds that figure,
 * so nothing is recalculated from the catalog: quantity-based price tiers, price overrides and
 * promotions are all already applied by the platform.
 *
 * `getAdjustedPrice()` is the extended price after product-level adjustments, matching the line
 * total SFRA itself displays. Order-level discounts are not prorated into it, so an order-level
 * promotion is not reflected in the reported price; `getProratedPrice()` would include it, at the
 * cost of no longer matching the displayed line total.
 *
 * Option values live on their own line items and are not part of the product's adjusted price, so
 * they are added in, as SFRA does when it builds a line total. The discount is measured on the
 * product alone, since option values carry no discount of their own.
 *
 * @param {dw.order.ProductLineItem} lineItem - the basket or order line item
 * @returns {Object|null} `{ price, currency, discount }` with `discount` omitted when there is
 *                        none, or null when no price is available
 */
function getLineItemPriceData(lineItem) {
    if (!lineItem) {
        return null;
    }

    const quantity = lineItem.getQuantityValue();

    if (!quantity) {
        algoliaLogger.warn('[priceHelper] Line item for product "{0}" has no quantity, no price reported.',
            lineItem.getProductID());
        return null;
    }

    const productPrice = lineItem.getAdjustedPrice();
    const basePrice = lineItem.getBasePrice();
    let unitPrice = null;

    if (productPrice.isAvailable()) {
        let linePrice = productPrice;

        const optionLineItems = lineItem.getOptionProductLineItems().iterator();
        while (optionLineItems.hasNext()) {
            linePrice = linePrice.add(optionLineItems.next().getAdjustedPrice());
        }

        if (linePrice.isAvailable()) {
            unitPrice = linePrice.divide(quantity);
        }
    }

    if (!unitPrice && basePrice.isAvailable()) {
        // The base price is the unit price and is set independently of the adjusted price, so it
        // still describes what the product costs. It excludes promotions and option values, so this
        // is a degraded figure and is logged rather than used silently.
        unitPrice = basePrice;
        algoliaLogger.warn('[priceHelper] No adjusted price for product "{0}" (quantity {1}), falling back to its base price of {2}. Promotions and option values are not reflected in the reported price.',
            lineItem.getProductID(), quantity, basePrice.getValue());
    }

    if (!unitPrice) {
        algoliaLogger.warn('[priceHelper] Neither the adjusted nor the base price is available for product "{0}", no price reported.',
            lineItem.getProductID());
        return null;
    }

    const priceData = {
        price: unitPrice.getValue(),
        currency: unitPrice.getCurrencyCode(),
    };

    if (basePrice.isAvailable() && productPrice.isAvailable()) {
        const unitDiscount = basePrice.subtract(productPrice.divide(quantity));
        if (unitDiscount.getValue() > 0) {
            priceData.discount = unitDiscount.getValue();
        }
    }

    return priceData;
}

module.exports.findProductLineItem = findProductLineItem;
module.exports.getLineItemPriceData = getLineItemPriceData;
