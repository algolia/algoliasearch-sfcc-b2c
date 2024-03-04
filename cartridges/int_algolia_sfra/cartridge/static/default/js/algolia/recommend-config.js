/* global instantsearch */

const { frequentlyBoughtTogether, relatedProducts, trendingItems, trendingFacets } = window['@algolia/recommend-js'];

/**
 * Enable recommendations
 * @param {Object} config - Configuration object
 * @returns {void}
 */
function enableRecommendations(config) {
    createRecommendationWidget({
        type: 'frequentlyBoughtTogether',
        containerId: 'frequentlyBoughtTogether',
        recommendClient: config.recommendClient
    });
    createRecommendationWidget({
        type: 'trendingItems',
        containerId: 'trendingItems',
        recommendClient: config.recommendClient
    });
}

/**
 * Generic function to create a recommendation widget
 * @param {Object} options - Options for the widget creation
 * @returns {void}
 */
function createRecommendationWidget(options) {
    const { type, containerId, recommendClient } = options;
    const container = document.getElementById(containerId);
    if (!container) return;

    const indexName = algoliaData.productsIndex;
    const objectIDs = getObjectIds(container);

    if (type == 'frequentlyBoughtTogether' && !objectIDs) return;

    const widgetOptions = {
        container: `#${containerId}`,
        recommendClient,
        indexName,
        objectIDs,
        itemComponent: ({ item, html }) => itemComponent({ item, html })
    };

    if (type === 'frequentlyBoughtTogether') {
        frequentlyBoughtTogether(widgetOptions);
    } else if (type === 'trendingItems') {
        trendingItems(widgetOptions);
    }
}

/**
 * Parse Object IDs from data attribute
 * @param {HTMLElement} container - Container element
 * @returns {Array|null} Object IDs
 */
function getObjectIds(container) {
    try {
        const objectIDs = container.getAttribute('data-object-ids');
        return JSON.parse(objectIDs);
    } catch (e) {
        console.error('Parsing error on objectIDs:', e);
        return null;
    }
}

/**
 * Item component used in widgets
 * @param {Object} param0 - Item and HTML from Algolia widget
 * @returns {string} HTML string
 */
function itemComponent({ item, html }) {

    const hit = transformItem(item);

    return html`
        <div class="col-12" data-pid="${hit.objectID}" data-query-id="${hit.__queryID}" data-index-name="${hit.__indexName}">
            <div class="product-tile">
                <div class="image-container">
                    <a href="${hit.url}">
                        <img class="tile-image" src="${hit.image.dis_base_link}" alt="${hit.image.alt}" title="${hit.name}"/>
                    </a>
                    ${getQuickViewHtml(hit, html)}
                </div>
                <div class="tile-body">
                    <div class="pdp-link">
                        <a href="${hit.url}">${hit.name}</a>
                    </div>
                    <div class="price">${getPriceHtml(hit, html)}</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * This function is used to transform the item before it is displayed in the widget.
 * It is used to add or modify properties of the item.
 * @param {Object} item - Item to transform
 * @returns {Object} Transformed item
 */
function transformItem(item) {
    if (item.image_groups) {
        const imageGroup = item.image_groups.find(function (i) {
            return i.view_type === 'large'
        }) || item.image_groups[0];
        if (imageGroup) {
            var firstImageInGroup = imageGroup.images[0];
            item.image = firstImageInGroup
        }
    } else {
        item.image = {
            dis_base_link: algoliaData.noImages.large,
            alt: item.name + ', large',
        }
    }

    // adjusted price in user currency
    if (item.promotionalPrice && item.promotionalPrice[algoliaData.currencyCode] !== null) {
        item.promotionalPrice = item.promotionalPrice[algoliaData.currencyCode]
    }

    // price in user currency
    if (item.price && item.price[algoliaData.currencyCode] !== null) {
        item.price = item.price[algoliaData.currencyCode]
    }

    // currency symbol
    item.currencySymbol = algoliaData.currencySymbol;


    item.quickShowUrl = algoliaData.quickViewUrlBase + '?pid=' + (item.masterID || item.objectID);

    // originating index
    item.__indexName = algoliaData.productsIndex;

    // url with queryID (used for analytics)
    if (item.url) {
        item.url = generateProductUrl({
            objectID: item.objectID,
            productUrl: item.url,
            queryID: item.__queryID,
            indexName: item.__indexName,
        });
    }

    if (item.colorVariations) {
        // Display the swatches only if at least one item has some colorVariations
        displaySwatches = true;
        item.colorVariations.forEach(colorVariation => {
            colorVariation.variationURL = generateProductUrl({
                objectID: item.objectID,
                productUrl: colorVariation.variationURL,
                queryID: item.__queryID,
                indexName: item.__indexName,
            });
        });
    }

    // Master-level indexing
    if (item.variants) {
        let price;
        item.variants.forEach(variant => {
            price = variant.price[algoliaData.currencyCode]
            variant.url = generateProductUrl({
                objectID: item.objectID,
                productUrl: variant.url,
                queryID: item.__queryID,
                indexName: item.__indexName,
            });
        });

        // 1. Find the variant matching the selected facets, or use the default variant
        let selectedVariant;
        const sizeFacets = results._state.disjunctiveFacetsRefinements['variants.size'] || [];
        const colorFacets = results._state.disjunctiveFacetsRefinements['variants.color'] || [];
        if (colorFacets.length > 0 && sizeFacets.length > 0) {
            // 1.1 If both facets are selected, find the variant that match both
            selectedVariant = item.variants.find(variant => {
                return sizeFacets.includes(variant.size) && colorFacets.includes(variant.color);
            });
        }
        if (!selectedVariant && colorFacets.length > 0) {
            // 1.2 If we have color refinement, find one that match the selected color
            selectedVariant = item.variants.find(variant => {
                return colorFacets.includes(variant.color)
            });
        }
        if (!selectedVariant && sizeFacets.length > 0) {
            // 1.3 Otherwise if we have size refinement, find one that match the selected size
            selectedVariant = item.variants.find(variant => {
                return sizeFacets.includes(variant.size)
            });
        }
        if (!selectedVariant) {
            // 1.4 No facets selected, use the default variant
            selectedVariant = item.variants.find(variant => {
                return variant.variantID === item.defaultVariantID;
            }) || item.variants[0];
        }

        // 2. Get the colorVariation corresponding to the selected variant, to display its image
        if (item.colorVariations) {
            const colorVariation = item.colorVariations.find(i => {
                return selectedVariant && i.color === selectedVariant.color
            }) || item.colorVariations[0];
            const imageGroup = colorVariation.image_groups.find(i => {
                return i.view_type === 'large'
            }) || colorVariation.image_groups[0];
            if (imageGroup) {
                item.image = imageGroup.images[0];
            }
        }

        // 3. Get the variant price
        if (selectedVariant) {
            if (selectedVariant.promotionalPrice && selectedVariant.promotionalPrice[algoliaData.currencyCode] !== null) {
                item.promotionalPrice = selectedVariant.promotionalPrice[algoliaData.currencyCode];
            }
            if (selectedVariant.price && selectedVariant.price[algoliaData.currencyCode] !== null) {
                item.price = selectedVariant.price[algoliaData.currencyCode]
            }
            item.url = selectedVariant.url;
        }
    }

    return item;
}

/**
 * Get item image
 * @param {Object} item - Item object
 * @returns {Object} Image object
 */
function getItemImage(item) {
    if (item.image_groups) {
        const imageGroup = item.image_groups.find(i => i.view_type === 'large') || item.image_groups[0];
        return imageGroup ? imageGroup.images[0] : getDefaultImage();
    }
    return getDefaultImage();
}

/**
 * Get default image
 * @returns {Object} Default image object
 */
function getDefaultImage() {
    return {
        dis_base_link: algoliaData.noImages.large,
        alt: 'Product image, large'
    };
}

/**
 * Get quick view HTML
 * @param {Object} item - Item object
 * @param {Function} html - Tagged template function
 * @returns {string} HTML string
 */
function getQuickViewHtml(item, html) {
    return html`
        <a class="quickview hidden-sm-down" href="${item.quickShowUrl}"
           data-toggle="modal" data-target="#quickViewModal" title="${item.name}"
           aria-label="${item.name}" data-query-id="${item.__queryID}"
           data-object-id="${item.objectID}" data-index-name="${item.__indexName}"
        >
            <span class="fa-stack fa-lg">
                <i class="fa fa-circle fa-inverse fa-stack-2x"></i>
                <i class="fa fa-expand fa-stack-1x"></i>
            </span>
        </a>
    `;
}

/**
 * Get price HTML
 * @param {Object} item - Item object
 * @param {Function} html - Tagged template function
 * @returns {string} HTML string
 */
function getPriceHtml(item, html) {
    return html`
        ${item.promotionalPrice && html`
            <span class="strike-through list">
                <span class="value"> ${item.currencySymbol} ${item.price} </span>
            </span>
        `}
        <span class="sales">
            <span class="value">
                ${item.currencySymbol} ${item.promotionalPrice ? item.promotionalPrice : item.price}
            </span>
        </span>
    `;
}
