"use strict";

/**
 * Function get Algolia Image Group of Images attributes of Product
 * @param {dw.order.Product} product - product
 * @param {string} viewtype - image type ('large' or 'small')
 * @returns  {Object} - Algolia Image Group Object
 */
function getImagesGroup(product, viewtype) {
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
            alt           : imageItem.alt,
            dis_base_link : imageItem.absURL.toString(),
            title         : imageItem.title
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
    this._type = "product";
    this.id = product.ID;
    this.name = product.name;
    this.url = product.pageURL ? product.pageURL : '';
    this.long_description = product.longDescription ? product.longDescription.source : '';
    this.short_description = product.shortDescription ? product.shortDescription.source : '';

    this.price = {};
    var currency = product.priceModel.price;
    if (currency.available) { 
        this.price[currency.currencyCode] = currency.value.toString();
    }

    // TODO: get adjusted price
    this.adjustedPrice = {};
    currency = product.priceModel.price;
    if (currency.available) { 
        this.adjustedPrice[currency.currencyCode] = currency.value.toString();
    }

    this.primary_category_id = product.getPrimaryCategory() ? product.primaryCategory.ID : '';
    this.in_stock = product.availabilityModel.inStock.toString();
    this.rating = '0';  // TODO: get rating
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
