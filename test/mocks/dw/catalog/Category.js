var Category = function ({ name, parent, subcategories}) {
    this.ID = `storefront-catalog-m-en/${name.split(' ').join('-').toLowerCase()}`;
    this.parent = parent;
    this.subcategories = subcategories;

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
    this.custom = {
        showInMenu: true,
    }
    this.hasOnlineProducts= function() {
        return true;
    }
};

// Mock of dw.util.Collection
const Collection = function(values) {
    this.values = values;
    const that = this;

    this.iterator = function() {
        let nextIndex = 0;

        return {
            hasNext() {
                return nextIndex < that.values.length;
            },
            next() {
                if (nextIndex < that.values.length) {
                    return that.values[nextIndex++];
                }
            },
        };
    }
}

module.exports = Category;
