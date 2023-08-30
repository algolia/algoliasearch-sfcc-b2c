'use strict';

var server = require('server');

/* API includes */
var CatalogMgr = require('dw/catalog/CatalogMgr');
/* Local includes */
var cache = require('*/cartridge/scripts/middleware/cache');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var pageMetaData = require('*/cartridge/scripts/middleware/pageMetaData');
var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');
var algoliaUtils = require('*/cartridge/scripts/algolia/lib/utils');

server.extend(module.superModule);

/* overwrite Search-Show */
server.replace('Show', cache.applyShortPromotionSensitiveCache, consentTracking.consent, function (req, res, next) {
    var useAlgolia = false;
    if (algoliaData.getPreference('Enable')) {
        useAlgolia = true;
        var cgid = req.querystring.cgid;
        var category = null;
        var categoryBannerUrl;
        var categoryDisplayNamePath = '';
        var categoryDisplayNamePathSeparator = '>';

        if (cgid) { // get category - need image, name and if root
            category = CatalogMgr.getCategory(cgid);
            if (category) {
                if (!empty(category.template) && category.template !== 'rendering/category/categoryproducthits') {
                    useAlgolia = false; // main categories have specific template
                } else if (category.custom && 'slotBannerImage' in category.custom
                            && category.custom.slotBannerImage) {
                    categoryBannerUrl = category.custom.slotBannerImage.getURL();
                } else if (category.image) {
                    categoryBannerUrl = category.image.getURL();
                }

                // category path
                categoryDisplayNamePath = algoliaUtils.getCategoryDisplayNamePath(category).join(categoryDisplayNamePathSeparator);
            } else {
                useAlgolia = false; // if category does not exist use default error
            }
        }

        if (useAlgolia) {
            var categoryProductHits;

            // server-side rendering to improve SEO - makes a server-side request to Algolia to return CLP search results
            if (algoliaData.getPreference('EnableSSR')) {
                // server-side results rendering for CLPs
                categoryProductHits = require('*/cartridge/scripts/algoliaSearchAPI').getCategoryProductHits(cgid);
                // transforms search hit results before rendering them (similarly to InstantSearch's transformItems() method)
                categoryProductHits = require('*/cartridge/scripts/algolia/helper/ssrHelper').transformItems(categoryProductHits);
            } else {
                categoryProductHits = null;
            }

            res.render('search/searchResults', {
                algoliaEnable: true,
                category: category,
                categoryDisplayNamePath: categoryDisplayNamePath,
                categoryDisplayNamePathSeparator: categoryDisplayNamePathSeparator,
                categoryBannerUrl: categoryBannerUrl,
                categoryProductHits: categoryProductHits,
                cgid: req.querystring.cgid,
                q: req.querystring.q
            });
        }
    }
    if (!useAlgolia) { // default Search-Show
        var searchHelper = require('*/cartridge/scripts/helpers/searchHelpers');

        if (req.querystring.cgid) {
            var pageLookupResult = searchHelper.getPageDesignerCategoryPage(req.querystring.cgid);

            if ((pageLookupResult.page && pageLookupResult.page.hasVisibilityRules()) || pageLookupResult.invisiblePage) {
                // the result may be different for another user, do not cache on this level
                // the page itself is a remote include and can still be cached
                res.cachePeriod = 0; // eslint-disable-line no-param-reassign
            }

            if (pageLookupResult.page) {
                res.page(pageLookupResult.page.ID, {}, pageLookupResult.aspectAttributes);
                return next();
            }
        }

        var template = 'search/searchResults';

        var result = searchHelper.search(req, res);

        if (result.searchRedirect) {
            res.redirect(result.searchRedirect);
            return next();
        }

        if (result.category && result.categoryTemplate) {
            template = result.categoryTemplate;
        }

        var redirectGridUrl = searchHelper.backButtonDetection(req.session.clickStream);
        if (redirectGridUrl) {
            res.redirect(redirectGridUrl);
        }

        res.render(template, {
            productSearch: result.productSearch,
            maxSlots: result.maxSlots,
            reportingURLs: result.reportingURLs,
            refineurl: result.refineurl,
            category: result.category ? result.category : null,
            canonicalUrl: result.canonicalUrl,
            schemaData: result.schemaData,
            apiProductSearch: result.apiProductSearch
        });
    }
    return next();
}, pageMetaData.computedPageMetaData);

module.exports = server.exports();
