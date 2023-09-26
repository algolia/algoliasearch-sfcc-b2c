const Collection = require('../util/Collection');

const Category = function ({ name, parent, subcategories, showInMenu }) {
    this.ID = `storefront-catalog-m-en/${name.split(' ').join('-').toLowerCase()}`;
    this.parent = parent;
    this.subcategories = subcategories;
    this.showInMenu = showInMenu !== undefined ? showInMenu : true;

    this.getID = function() {
        return this.ID;
    }
    this.getDisplayName = function() {
        switch (request.getLocale()) {
            case 'fr': return `Nom français de ${name}`;
            case 'en': return `English name of ${name}`;
            default: return name;
        }
    }
    this.getDescription = function() {
        switch (request.getLocale()) {
            case 'fr': return `Description française de ${name}`;
            case 'en': return `English description of ${name}`;
            default: return `Description of ${name}`;
        }
    }
    this.getImage = function() {
        return {
            getHttpsURL: function() {
                return `http://example.com/${name.split(' ').join('-').toLowerCase()}.jpg`;
            }
        }
    }
    this.getThumbnail = function() {
        return {
            getHttpsURL: function() {
                return `http://example.com/${name.split(' ').join('-').toLowerCase()}-thumbnail.jpg`;
            }
        }
    }
    this.getParent = function() {
        return this.parent || { root: true };
    }
    this.getOnlineSubCategories= function() {
        return new Collection(this.subcategories || []);
    }
    this.hasOnlineSubCategories= function() {
        return this.subcategories && this.subcategories.length > 0;
    }
    this.custom = {
        showInMenu: this.showInMenu,
    }
    this.hasOnlineProducts= function() {
        return true;
    }
};

module.exports = Category;
