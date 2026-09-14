'use strict';

var server = require('server');

/* API includes */
var CatalogMgr = require('dw/catalog/CatalogMgr');
var URLUtils = require('dw/web/URLUtils');
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
        var collection = req.querystring.collection;
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

        // A repeated parameter arrives as an array. The storefront never produces one,
        // but keeping a single value makes sure the heading, the canonical URL and the
        // client-side refinement all name the same collection. The query string parser
        // walks the parameters in reverse, so the last array element is the first
        // occurrence in the URL, which is the one the client applies.
        if (Array.isArray(collection)) {
            collection = collection[collection.length - 1];
        }

        // What kind of listing this request is. A collection supplied next to a query
        // or a category refines that page, so only a collection on its own makes a
        // collection listing. The canonical URL and the crawler request follow this
        // precedence too.
        var pageType = null;
        if (!empty(cgid)) {
            pageType = 'category';
        } else if (!empty(q)) {
            pageType = 'query';
        } else if (!empty(collection)) {
            pageType = 'collection';
        }

        var isCollectionPage = pageType === 'collection';

        if (useAlgolia) {
            var hits;
            var contentHits;
            //For Algolia, we don't need personalized cache, as the real results are fetched on the front-end.
            res.cachePeriod = 24;
            res.cachePeriodUnit = 'hours';
            res.personalized = true;

            // Canonical URL excludes refinements and pagination so that crawlers
            // see a single representative URL per category, query or collection,
            var canonicalUrl;
            switch (pageType) {
                case 'category':
                    canonicalUrl = URLUtils.url('Search-Show', 'cgid', cgid).abs().toString();
                    break;
                case 'query':
                    canonicalUrl = URLUtils.url('Search-Show', 'q', q).abs().toString();
                    break;
                case 'collection':
                    canonicalUrl = URLUtils.url('Search-Show', 'collection', collection).abs().toString();
                    break;
                default:
                    break;
            }

            // server-side rendering to improve SEO - makes a server-side request to Algolia to return CLP search results
            // only triggered when the user-agent looks like a bot, as we want it triggered only for search engines bots (DuckDuckBot, GoogleBot, BingBot, YandexBot, Baiduspider, ...)
            var searchenginesbots = /bot|crawler|spider/i;
            if (algoliaData.getPreference('EnableSSR') && searchenginesbots.test(req.httpHeaders.get('user-agent'))) {
                // The term to search on depends on the kind of listing.
                var query;
                switch (pageType) {
                    case 'category':
                        query = cgid;
                        break;
                    case 'query':
                        query = q;
                        break;
                    case 'collection':
                        query = collection;
                        break;
                    default:
                        break;
                }

                // Then, we are fetching server-side results and transform them prior to rendering according to search type.
                if (pageType) {
                    hits = require('*/cartridge/scripts/algoliaSearchAPI').getServerSideHits(query, pageType, 'products');
                    hits = require('*/cartridge/scripts/algolia/helper/ssrHelper').transformItems(hits);
                }

                if (pageType === 'query' && algoliaData.getPreference('EnableContentSearch')) {
                    contentHits = require('*/cartridge/scripts/algoliaSearchAPI').getServerSideHits(query, pageType, 'contents');
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

            var viewData = {
                algoliaEnable: true,
                category: category,
                categoryDisplayNamePath: categoryDisplayNamePath,
                categoryDisplayNamePathSeparator: categoryDisplayNamePathSeparator,
                categoryBannerUrl: categoryBannerUrl,
                hits: hits,
                contentHits: contentHits,
                cgid: req.querystring.cgid,
                q: req.querystring.q,
                collection: collection,
                isCollectionPage: isCollectionPage,
                canonicalUrl: canonicalUrl,
                activePromotions: activePromotions
            }

            var storeList = [];

            var attributeList = algoliaData.getSetOfArray('AdditionalAttributes');
            var isStoreAvailabilityEnabled = attributeList.indexOf('storeAvailability') !== -1;

            if (isStoreAvailabilityEnabled) {
                // Do not need to cache this, because page is already cached via cache.applyShortPromotionSensitiveCache
                var StoreMgr = require('dw/catalog/StoreMgr');

                // Get all stores using a very large radius search
                var storesMap = StoreMgr.searchStoresByCoordinates(0, 0, 'mi', 99999999);

                if (storesMap && !storesMap.empty) {
                    var storeIds = storesMap.keySet().toArray();
                    for (i = 0; i < storeIds.length; i++) {
                        var store = storeIds[i];
                        if (store && store.inventoryList) {
                            storeList.push({
                                id: store.ID,
                                name: store.name,
                                address: {
                                    address1: store.address1 || '',
                                    city: store.city || '',
                                    stateCode: store.stateCode || '',
                                    postalCode: store.postalCode || ''
                                },
                                phone: store.phone || ''
                            });
                        }
                    }
                }
                var storeListJSON = JSON.stringify(storeList);
                viewData.storeList = storeListJSON;
            }

            res.render('search/searchResults', viewData);
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
