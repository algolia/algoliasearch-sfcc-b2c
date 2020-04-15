"use strict";

/**
 * Function get Algolia Image Group of Images attributes of Product
 * @param {dw.order.Product} product - product
 * @param {string} viewtype - image type ('large' or 'small')
 * @returns  {Object} - Algolia Image Group Object
 */
function getImagesGroup(product, viewtype) {
    var Site = require('dw/system/Site');
    var currentSites = Site.getCurrent();

    if (empty(product) || empty(viewtype)) { return null; };
       
    var imagesList = product.getImages(viewtype);
    if (empty(imagesList)) { return null; };

    var result = {
        _type     : 'image_group', 
        images    : [],
        view_type : viewtype
    }

    for(var i = 0; i < imagesList.size(); i++) {
        var imageItem = imagesList[i];
        var image = {
            _type         : 'image',
            alt           : { locales:{} },
            dis_base_link : { locales:{} },
            title         : { locales:{} }
        }
        
        var siteLocales = currentSites.getAllowedLocales();

        for (var i = 0; i < siteLocales.size(); i++) {
            var localeName = siteLocales[i];
            request.setLocale(localeName);    
            image.alt.locales[localeName] = imageItem.alt;
            image.dis_base_link.locales[localeName] = imageItem.absURL.toString();
            image.title.locales[localeName] = imageItem.title;
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
    var currentSites = Site.getCurrent();

    // GET none Localized properties
    this._type = "product";
    this.id = product.ID;
    this.primary_category_id = product.getPrimaryCategory() ? product.primaryCategory.ID : '';
    this.in_stock = product.availabilityModel.inStock.toString();
    this.rating = '0';  // TODO: get rating
   
    // Get Localized properties
    this.name = { locales:{} };
    this.url = { locales:{} };
    this.long_description = { locales:{} };
    this.short_description = { locales:{} };

    var siteLocales = currentSites.getAllowedLocales();

    for (var i = 0; i < siteLocales.size(); i++) {
        var localeName = siteLocales[i];
        request.setLocale(localeName);

        this.name.locales[localeName] = product.name ? product.name : '';
        this.url.locales[localeName] = product.pageURL ? product.pageURL : '';
        this.long_description.locales[localeName] = product.longDescription ? product.longDescription.source : '';
        this.short_description.locales[localeName] = product.shortDescription ? product.shortDescription.source : '';
    }

    // Get price for all currencies
    this.price = {};
    var currentSession = request.getSession();
    var siteCurrencies = currentSites.getAllowedCurrencies();
    
    for (var i = 0; i < siteCurrencies.size(); i++) {
        var currency = Currency.getCurrency(siteCurrencies[i]);
        currentSession.setCurrency(currency);
        var price = product.priceModel.price;
        if (price.available) { 
            this.price[price.currencyCode] = price.value.toString();
        }
    }
 
    this.image_groups = [];
    var imageGroup = getImagesGroup(product, 'large');
    if (!empty(imageGroup)) {
        this.image_groups.push(imageGroup);
    }
 
    imageGroup = getImagesGroup(product, 'small');
    if (!empty(imageGroup)) {
        this.image_groups.push(imageGroup);
    }
}

module.exports = algoliaProduct;
