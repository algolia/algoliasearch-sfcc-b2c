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
        var q = req.querystring.q;
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
            var hits;
            var contentHits;
            //For Algolia, we don't need personalized cache, as the real results are fetched on the front-end.
            res.cachePeriod = 24;
            res.cachePeriodUnit = 'hours';
            res.personalized = true;

            // server-side rendering to improve SEO - makes a server-side request to Algolia to return CLP search results
            // only triggered when the user-agent looks like a bot, as we want it triggered only for search engines bots (DuckDuckBot, GoogleBot, BingBot, YandexBot, Baiduspider, ...)
            var searchenginesbots = /bot|crawler|spider/i;
            if (algoliaData.getPreference('EnableSSR') && searchenginesbots.test(req.httpHeaders.get('user-agent'))) {
                // We use the 'cgid' and 'q' parameters to identify if we're on a category page or normal search.
                var type = cgid ? 'category' : q ? 'query' : null;
                // Then, we are fetching server-side results and transform them prior to rendering according to search type.
                if (type) {
                    var query = type === 'category' ? cgid : q;
                    hits = require('*/cartridge/scripts/algoliaSearchAPI').getServerSideHits(query, type, 'products');
                    hits = require('*/cartridge/scripts/algolia/helper/ssrHelper').transformItems(hits);
                }

                if (type === 'query' && algoliaData.getPreference('EnableContentSearch')) {
                    contentHits = require('*/cartridge/scripts/algoliaSearchAPI').getServerSideHits(query, type, 'contents');
                    contentHits = require('*/cartridge/scripts/algolia/helper/ssrHelper').transformItems(contentHits);
                }
            }

            var PromotionMgr = require('dw/campaign/PromotionMgr');
            var promotionPlan = PromotionMgr.getActiveCustomerPromotions();
            var getActivePromotions = promotionPlan.productPromotions;

            var activePromotionsArr = [];

            for (var i = 0; i < getActivePromotions.length; i++) {
                activePromotionsArr.push({
                    id: getActivePromotions[i].ID,
                    calloutMsg: getActivePromotions[i].calloutMsg ? getActivePromotions[i].calloutMsg.markup : '',
                });
            }

            var activePromotions = JSON.stringify(activePromotionsArr);

            res.render('search/searchResults', {
                algoliaEnable: true,
                category: category,
                categoryDisplayNamePath: categoryDisplayNamePath,
                categoryDisplayNamePathSeparator: categoryDisplayNamePathSeparator,
                categoryBannerUrl: categoryBannerUrl,
                hits: hits,
                contentHits: contentHits,
                cgid: req.querystring.cgid,
                q: req.querystring.q,
                activePromotions: activePromotions
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
                res.cachePeriod = 0;
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
