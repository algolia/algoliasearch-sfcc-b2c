var Site = function() {
    this.ID = 'SiteID';
    this.name = 'Site Name';
    this.preferences = {};
    this.customPreferences = {};
    this.allowedLocales = {
        toArray: function() { return ['en_US']; },
        size: function() { return 1; },
        '0': 'en_US'
    };
};

Site.getCurrent = function() {
    return new Site();
};

Site.getCalendar = function() {
    return new (require('../util/Calendar'))();
};

Site.prototype.getCurrencyCode = function() {
    return this.currencyCode;
};

Site.prototype.getName = function() {
    return this.name;
};

Site.prototype.getID = function() {
    return this.ID;
};

Site.prototype.getPreferences = function() {
    return this.preferences;
};

Site.prototype.getHttpHostName = function() {
    return this.httpHostName;
};

Site.prototype.getHttpsHostName = function() {
    return this.httpsHostName;
};

Site.prototype.getCustomPreferenceValue = function(key) {
    return (this.customPreferences && this.customPreferences[key]) || undefined;
};

Site.prototype.setCustomPreferenceValue = function(key, value) {
    this.customPreferences = this.customPreferences || {};
    this.customPreferences[key] = value;
};

Site.prototype.getDefaultLocale = function() {
    return this.defaultLocale;
};

Site.prototype.getAllowedLocales = function() {
    return this.allowedLocales;
};

Site.prototype.getAllowedCurrencies = function() {
    return this.allowedCurrencies;
};

Site.prototype.getDefaultCurrency = function() {
    return this.defaultCurrency;
};

Site.prototype.getTimezone = function() {
    return this.timezone;
};

Site.prototype.getTimezoneOffset = function() {
    return this.timezoneOffset;
};

Site.prototype.isOMSEnabled = function() {
    return this.isOMSEnabled;
};

module.exports = Site;