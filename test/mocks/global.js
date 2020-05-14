/**
* Check object is empty
* @param {Object} obj object
* @returns {boolean} true if object is empty
*/
function empty(obj) {
    return (obj === null || obj === undefined || obj === '' || (typeof (obj) !== 'function' && obj.length !== undefined && obj.length === 0));
}

function RequestLocale() {
    this.locale = 'default';
    this.getLocale = function () {
        return this.locale;
    };
    this.setLocale = function (locale) {
        this.locale = locale;
    };
}

module.exports = {
    empty: empty,
    request: new RequestLocale()
};
