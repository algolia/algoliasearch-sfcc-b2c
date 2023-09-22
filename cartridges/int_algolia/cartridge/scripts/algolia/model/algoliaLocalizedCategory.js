var URLUtils = require('dw/web/URLUtils');
var forEach = require('../lib/utils').forEach;

/**
 * Get category url
 * @param {dw.catalog.Category} category - Current category
 * @returns {string} - Url of the category
 */
function getCategoryUrl(category) {
    return category.custom && 'alternativeUrl' in category.custom && category.custom.alternativeUrl
        ? (category.custom.alternativeUrl.toString()).replace(/&amp;/g, '&')
        : URLUtils.https('Search-Show', 'cgid', category.getID()).toString();
}

/**
 * Get category ID
 * @param {string} catalogId - Catalog ID
 * @param {dw.catalog.Category} category - Current category
 * @returns {string} - Final ID of the category
 */
function getCategoryId(catalogId, category) {
    return catalogId + '/' + category.ID;
}

/**
 * Get image url
 * @param {dw.content.MediaFile} image - MediaFile
 * @returns {string} - Url of the image
 */
function getImageUrl(image) {
    return image ? image.getHttpsURL().toString() : null;
}

/**
 * AlgoliaLocalizedCategory class that represents a localized category ready to be indexed
 * @param {dw.catalog.Category} category - A single category
 * @param {string} catalogId - ID of site catalog
 * @param {string} locale - the requested locale
 * @constructor
 */
function algoliaLocalizedCategory(category, catalogId, locale) {
    request.setLocale(locale|| 'default');

    this.objectID = getCategoryId(catalogId, category);
    this.id = getCategoryId(catalogId, category);
    this.name = category.getDisplayName();
    if (category.getDescription()) {
        this.description = category.getDescription();
    }
    var image = getImageUrl(category.getImage());
    if (image) {
        this.image = image;
    }
    var parent = category.getParent();
    if (parent && !parent.root) {
        this.parent_category_id = getCategoryId(catalogId, parent);
    }
    var thumbnail = getImageUrl(category.getThumbnail());
    if (thumbnail) {
        this.thumbnail = thumbnail;
    }

    var subCategories = category.getOnlineSubCategories();

    var that = this;
    forEach(subCategories, function (subcategory) {
        if (subcategory.custom && subcategory.custom.showInMenu
          && (subcategory.hasOnlineProducts() || subcategory.hasOnlineSubCategories())) {
            if (!that.subCategories) {
                that.subCategories = [];
            }
            that.subCategories.push(getCategoryId(catalogId, subcategory));
        }
    });

    this.url = getCategoryUrl(category);
    this._tags = ['id:' + this.id];
}

module.exports = algoliaLocalizedCategory;
