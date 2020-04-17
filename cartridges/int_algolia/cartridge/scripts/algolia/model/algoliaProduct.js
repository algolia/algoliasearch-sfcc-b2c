"use strict";

/**
 * Function get Algolia Image Group of Images attributes of Product
 * @param {dw.order.Product} product - product
 * @param {string} viewtype - image type ('large' or 'small')
 * @returns  {Object} - Algolia Image Group Object
 */
function getImagesGroup(product, viewtype) {
    var Site = require('dw/system/Site');
    var stringUtils = require('dw/util/StringUtils');
    var currentSites = Site.getCurrent();

    if (empty(product) || empty(viewtype)) { return null; };
       
    var imagesList = product.getImages(viewtype);
    if (empty(imagesList)) { return null; };

    var result = {
        _type     : 'image_group', 
        images    : [],
        view_type : viewtype
    }

    var imagesListSize = imagesList.size();
    for(var i = 0; i < imagesListSize; i++) {
        var imageItem = imagesList[i];
        var image = {
            _type         : 'image',
            alt           : { locales: {} },
            dis_base_link : { locales: {} },
            title         : { locales: {} }
        }
        
        var siteLocales = currentSites.getAllowedLocales();
        var siteLocalesSize = siteLocales.size();

        for (var loc = 0; loc < siteLocalesSize; loc++) {
            var localeName = siteLocales[loc];
            request.setLocale(localeName);    
            image.alt.locales[localeName] = stringUtils.trim(imageItem.alt);
            image.dis_base_link.locales[localeName] = stringUtils.trim(imageItem.absURL.toString());
            image.title.locales[localeName] = stringUtils.trim(imageItem.title);
        }
    
        result.images.push(image);
    };

    return result;
}

/**
 * AlgoliaProduct class that represents an algoliaProduct Object
 * @param {dw.order.Product} product - Product
 * @constructor
 */
function algoliaProduct(product) {
    var Site = require('dw/system/Site');
    var Currency = require('dw/util/Currency');
    var stringUtils = require('dw/util/StringUtils');
    var currentSites = Site.getCurrent();

    // GET none Localized properties
    this._type = "product";
    this.id = product.ID;
    this.primary_category_id = product.getPrimaryCategory() ? product.primaryCategory.ID : '';
    this.in_stock = product.availabilityModel.inStock.toString();
    this.rating = '0';  // TODO: get rating
   
    // Get Localized properties
    this.name = { locales: {} };
    this.url = { locales: {} };
    this.long_description = { locales: {} };
    this.short_description = { locales: {} };

    var siteLocales = currentSites.getAllowedLocales();
    var siteLocalesSize = siteLocales.size();

    for (var i = 0; i < siteLocalesSize; i++) {
        var localeName = siteLocales[i];
        request.setLocale(localeName);

        this.name.locales[localeName] = product.name ? stringUtils.trim(product.name) : '';
        this.url.locales[localeName] = product.pageURL ? stringUtils.trim(product.pageURL.toString()) : '';
        this.long_description.locales[localeName] = product.longDescription ? stringUtils.trim(product.longDescription.toString()) : '';
        this.short_description.locales[localeName] = product.shortDescription ? stringUtils.trim(product.shortDescription.toString()) : '';
    }

    // Get price for all currencies
    this.price = {};
    var currentSession = request.getSession();
    var siteCurrencies = currentSites.getAllowedCurrencies();
    var siteCurrenciesSize = siteCurrencies.size();
    
    for (var i = 0; i < siteCurrenciesSize; i++) {
        var currency = Currency.getCurrency(siteCurrencies[i]);
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

module.exports = algoliaProduct;
