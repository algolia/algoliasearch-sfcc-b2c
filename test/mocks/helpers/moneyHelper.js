/**
 * Builds a dw.value.Money-like mock that exposes both the direct properties
 * (value, currencyCode, available) used by config-driven attribute lookups and
 * the getter methods (getValue, getCurrencyCode, isAvailable) used by code that
 * accesses Money through the SFCC API.
 * @param {number} value - monetary value
 * @param {string} currencyCode - ISO currency code
 * @param {boolean} available - whether the price is available
 * @returns {Object} Money-like mock
 */
function createMoney(value, currencyCode, available) {
    return {
        value: value,
        currencyCode: currencyCode,
        available: available,
        getValue: function () {
            return value;
        },
        getCurrencyCode: function () {
            return currencyCode;
        },
        isAvailable: function () {
            return available;
        },
    };
}

module.exports = {
    createMoney: createMoney,
};
