/**
* Check object is empty
* @param {Object} obj object
* @returns {boolean} true if object is empty
*/
function empty(obj) {
    return (obj === null || obj === undefined || obj === '' || (typeof (obj) !== 'function' && obj.length !== undefined && obj.length === 0));
}

function CurrentSession() {
    this.currency = {
        currencyCode: 'USD',
        getCurrencyCode: function() {
            return 'USD';
        },
        getSymbol: function() {
            return '$';
        }
    };
    this.getCurrency = function () {
        return this.currency;
    };
    this.setCurrency = function (currency) {
        this.currency = currency;
    };
}

function RequestMock() {
    this.locale = 'default';
    this.session = new CurrentSession();
    this.getLocale = function () {
        return this.locale;
    };
    this.setLocale = function (locale) {
        this.locale = locale;
    };
    this.getSession = function () {
        return this.session;
    };
}

module.exports = {
    empty: empty,
    RequestMock: RequestMock
};
