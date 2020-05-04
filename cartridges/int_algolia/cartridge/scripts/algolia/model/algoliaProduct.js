'use strict';

var Site = require('dw/system/Site');
var Currency = require('dw/util/Currency');
var stringUtils = require('dw/util/StringUtils');
var URLUtils = require('dw/web/URLUtils');

/**
 * Function get Algolia Image Group of Images attributes of Product
 * @param {dw.order.Product} product - product
 * @param {string} viewtype - image type ('large' or 'small')
 * @returns  {Object} - Algolia Image Group Object
 */
function getImagesGroup(product, viewtype) {
    var currentSites = Site.getCurrent();

    if (empty(product) || empty(viewtype)) { return null; }

    var imagesList = product.getImages(viewtype);
    if (empty(imagesList)) { return null; }

    var result = {
        _type: 'image_group',
        images: [],
        view_type: viewtype
    };

    var imagesListSize = imagesList.size();
    for (var i = 0; i < imagesListSize; i += 1) {
        var imageItem = imagesList[i];
        var image = {
            _type: 'image',
            alt: {},
            dis_base_link: {},
            title: {}
        };

        var siteLocales = currentSites.getAllowedLocales();
        var siteLocalesSize = siteLocales.size();

        for (var loc = 0; loc < siteLocalesSize; loc += 1) {
            var localeName = siteLocales[loc];
            request.setLocale(localeName);
            image.alt[localeName] = stringUtils.trim(imageItem.alt);
            image.dis_base_link[localeName] = stringUtils.trim(imageItem.absURL.toString());
            image.title[localeName] = stringUtils.trim(imageItem.title);
        }

        result.images.push(image);
    }

    return result;
}

/**
 * AlgoliaProduct class that represents an algoliaProduct Object
 * @param {dw.order.Product} product - Product
 * @constructor
 */
var algoliaProduct = function (product) {
    if (empty(product)) {
        this.id = null;
        this.primary_category_id = null;
        this.in_stock = null;
        this.name = null;
        this.url = null;
        this.long_description = null;
        this.short_description = null;
        this.price = null;
        this.image_groups = null;
    } else {
        var currentSites = Site.getCurrent();

        // GET none Localized properties
        this.id = product.ID;
        this.primary_category_id = product.getPrimaryCategory() ? product.primaryCategory.ID : '';
        this.in_stock = product.availabilityModel.inStock.toString();

        // Get Localized properties
        this.name = {};
        this.url = {};
        this.long_description = {};
        this.short_description = {};

        var siteLocales = currentSites.getAllowedLocales();
        var siteLocalesSize = siteLocales.size();

        for (var i = 0; i < siteLocalesSize; i += 1) {
            var localeName = siteLocales[i];
            request.setLocale(localeName);

            this.name[localeName] = product.name ? stringUtils.trim(product.name) : '';
            var productPageUrl = URLUtils.https('Product-Show', 'pid', product.ID);
            this.url[localeName] = productPageUrl ? productPageUrl.toString() : '';
            this.long_description[localeName] = product.longDescription ? stringUtils.trim(product.longDescription.toString()) : 'No descriptoion';
            this.short_description[localeName] = product.shortDescription ? stringUtils.trim(product.shortDescription.toString()) : 'No descriptoion';
        }

        // Get price for all currencies
        this.price = {};
        var currentSession = request.getSession();
        var siteCurrencies = currentSites.getAllowedCurrencies();
        var siteCurrenciesSize = siteCurrencies.size();

        for (var k = 0; k < siteCurrenciesSize; k += 1) {
            var currency = Currency.getCurrency(siteCurrencies[k]);
            currentSession.setCurrency(currency);
            var price = product.priceModel.price;
            if (price.available) {
                this.price[price.currencyCode] = price.value.toString();
            }
        }

        var imageGroupsArr = [];
        var imageGroup = getImagesGroup(product, 'large');
        if (!empty(imageGroup)) {
            imageGroupsArr.push(imageGroup);
        }

        imageGroup = getImagesGroup(product, 'small');
        if (!empty(imageGroup)) {
            imageGroupsArr.push(imageGroup);
        }

        this.image_groups = imageGroupsArr.length > 0 ? imageGroupsArr : '';
    }
};

algoliaProduct.getFields = function () {
    return ['name', 'short_description', 'long_description', 'primary_category_id', 'image_groups', 'price', 'in_stock', 'url'];
};

module.exports = algoliaProduct;
