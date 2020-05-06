'use strict';

var Site = require('dw/system/Site');
var Currency = require('dw/util/Currency');
var stringUtils = require('dw/util/StringUtils');
var URLUtils = require('dw/web/URLUtils');

var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

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
function algoliaProduct(product) {
    var customFields = algoliaData.getSetOfArray('CustomFields');
    if (empty(product)) {
        this.id = null;
    } else {
        var currentSites = Site.getCurrent();

        // GET none Localized properties
        this.id = product.ID;

        if (customFields.indexOf('primary_category_id') > -1) {
            this.primary_category_id = product.getPrimaryCategory() ? product.primaryCategory.ID : '';
        }

        if (customFields.indexOf('in_stock') > -1) {
            this.in_stock = product.availabilityModel.inStock;
        }

        // Get Localized properties
        var productName = {};
        var productUrl = {};
        var productLongDescription = {};
        var productShortDescription = {};

        var siteLocales = currentSites.getAllowedLocales();
        var siteLocalesSize = siteLocales.size();

        for (var i = 0; i < siteLocalesSize; i += 1) {
            var localeName = siteLocales[i];
            request.setLocale(localeName);

            productName[localeName] = product.name ? stringUtils.trim(product.name) : '';
            var productPageUrl = URLUtils.https('Product-Show', 'pid', product.ID);
            productUrl[localeName] = productPageUrl ? productPageUrl.toString() : '';
            productLongDescription[localeName] = product.longDescription ? stringUtils.trim(product.longDescription.toString()) : 'No descriptoion';
            productShortDescription[localeName] = product.shortDescription ? stringUtils.trim(product.shortDescription.toString()) : 'No descriptoion';
        }

        if (customFields.indexOf('name') > -1) { this.name = productName; }
        if (customFields.indexOf('url') > -1) { this.url = productUrl; }
        if (customFields.indexOf('long_description') > -1) { this.long_description = productLongDescription; }
        if (customFields.indexOf('short_description') > -1) { this.short_description = productShortDescription; }


        // Get price for all currencies
        var productPrice = null;
        var currentSession = request.getSession();
        var siteCurrencies = currentSites.getAllowedCurrencies();
        var siteCurrenciesSize = siteCurrencies.size();

        for (var k = 0; k < siteCurrenciesSize; k += 1) {
            var currency = Currency.getCurrency(siteCurrencies[k]);
            currentSession.setCurrency(currency);
            var price = product.priceModel.price;
            if (price.available) {
                if (!productPrice) { productPrice = {}; }
                productPrice[price.currencyCode] = price.value;
            }
        }

        if (productPrice && customFields.indexOf('price') > -1) { this.price = productPrice; }

        var imageGroupsArr = [];
        var imageGroup = getImagesGroup(product, 'large');
        if (!empty(imageGroup)) {
            imageGroupsArr.push(imageGroup);
        }

        imageGroup = getImagesGroup(product, 'small');
        if (!empty(imageGroup)) {
            imageGroupsArr.push(imageGroup);
        }

        if (customFields.indexOf('image_groups') > -1) {
            this.image_groups = imageGroupsArr.length > 0 ? imageGroupsArr : '';
        }
    }
}

module.exports = algoliaProduct;
