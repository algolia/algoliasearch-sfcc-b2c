'use strict';

var server = require('server');

/* API includes */
var CatalogMgr = require('dw/catalog/CatalogMgr');
/* Local includes */
var cache = require('*/cartridge/scripts/middleware/cache');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var pageMetaData = require('*/cartridge/scripts/middleware/pageMetaData');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

server.extend(module.superModule);

/* overwrite Search-Show */
server.replace('Show', cache.applyShortPromotionSensitiveCache, consentTracking.consent, function (req, res, next) {
    var useAlgolia = false;
    if (algoliaData.getPreference('Enable')) {
        useAlgolia = true;
        var cgid = req.querystring.cgid;
        var category = null;
        var categoryBannerUrl;
        if (cgid) {    // get category - need image, name and if root
            category = CatalogMgr.getCategory(cgid);
            if (category) {
                if (category && category.parent.ID === 'root') {
                    useAlgolia = false;    // main categories have specific template
                } else {
                    if (category.custom && 'slotBannerImage' in category.custom &&
                        category.custom.slotBannerImage) {
                        categoryBannerUrl = category.custom.slotBannerImage.getURL();
                    } else if (category.image) {
                        categoryBannerUrl = category.image.getURL();
                    }
                }
            } else {
                useAlgolia = false;    // if category does not exist use default error
            }
        }
        if (useAlgolia) {
            res.render('search/searchResults', {
                algoliaEnable: true,
                searchApiKey: algoliaData.getPreference('SearchApiKey'),
                applicationID: algoliaData.getPreference('ApplicationID'),
                category: category,
                categoryBannerUrl: categoryBannerUrl,
                productsIndex: algoliaData.calculateIndexId('products'),
                categoriesIndex: algoliaData.calculateIndexId('categories'),
                // TODO: sqlinjection ?
                cgid: req.querystring.cgid,
                q: req.querystring.q
            });
        }
    }
    if (!useAlgolia) {    // deafult Search-Show
        var ProductSearchModel = require('dw/catalog/ProductSearchModel');
        var searchHelper = require('*/cartridge/scripts/helpers/searchHelpers');
        var template = 'search/searchResults';

        var apiProductSearch = new ProductSearchModel();
        var viewData = {
            apiProductSearch: apiProductSearch
        };
        res.setViewData(viewData);

        this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
            var result = searchHelper.search(req, res);

            if (result.searchRedirect) {
                res.redirect(result.searchRedirect);
                return;
            }

            if (result.category && result.categoryTemplate) {
                template = result.categoryTemplate;
            }

            res.render(template, {
                productSearch: result.productSearch,
                maxSlots: result.maxSlots,
                reportingURLs: result.reportingURLs,
                refineurl: result.refineurl,
                category: result.category ? result.category : null,
                canonicalUrl: result.canonicalUrl,
                schemaData: result.schemaData
            });
        });
    }
    return next();
}, pageMetaData.computedPageMetaData);

module.exports = server.exports();