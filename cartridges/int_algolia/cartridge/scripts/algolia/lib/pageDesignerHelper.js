'use strict';

const PageMgr = require('dw/experience/PageMgr');

const indexOnlySearchables = true;

/* Usable if indexOnlySearchables is set to false because in this case, we are indexing all the components and not only the searchable ones
* It is already configured for default SFRA components, feel free to add your own
*/
const indexableAttributes = ['custom', 'cms_record', 'enum', 'markup', 'string', 'text', 'url'];
const ignoredAttributes = ['xsCarouselIndicators', 'xsCarouselControls', 'xsCarouselSlidesToDisplay', 'customCategoryName1', 'customCategoryName2', 'customCategoryName3', 'customCategoryName4', 'customCategoryName5', 'customCategoryName6', 'customCategoryName7',
    'customCategoryName8', 'customCategoryName9', 'customCategoryName10', 'customCategoryName11', 'customCategoryName12', 'imagesize', 'offset', 'smCarouselSlidesToDisplay', 'mdCarouselSlidesToDisplay'];

/**
 * Checks if a component is indexable.
 * component.searching - The searching configuration of the component.
 * component.searching.searchable - Indicates if the component is searchable.
 *
 * @param {Object} component - The component to check.
 * @param {string} component.type - The type of the component.
 * @returns {boolean} Returns true if the component is indexable, otherwise false.
 */
function isIndexableComponent(component) {
    if (component && component.searching && component.searching.searchable) {
        return true;
    }

    return false;
}


/**
 * Checks if Attribute is Indexable according to value
 * @param {Object} component - The component to check.
 * @returns {boolean} Returns true if the component is indexable, otherwise false.
 */
function isIndexableAttribute (component) {
    if (indexableAttributes.indexOf(component.type)) {
        return true;
    }

    return false;
}

/**
 * Retrieves the content of a container (Works Recursively).
 *
 * @param {Object} container - The container from which to retrieve content.
 * @param {string} type - The type of the container.
 * @returns {string} The content of the container, with each piece of content separated by '</div>'.
 */
function getContainerContent(container, type) {
    var page = PageMgr.getPage(container.ID) || container;
    var indexableContent = '';

    // We are fetching predefined metadata for the page type that is created by developers,
    // for the detail: https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/b2c-dev-for-page-designer.html#create-page-and-component-types
    var pageMetaDefinition = require('*/cartridge/experience/' + type + '/' + page.typeID.replace(/\./g, '/') + '.json');
    var attributeDefinitions = [];
    var regionDefinitions = [];
    var content;

    attributeDefinitions = getAttributeDefinitions(pageMetaDefinition);
    regionDefinitions = getRegionDefinitions(pageMetaDefinition);

    for (var i = 0; i < attributeDefinitions.length; i++) {
        var attribute_definition = attributeDefinitions[i];
        content = getAttributeContent(page, attribute_definition);
        if (content && content !== ' ' && ((indexOnlySearchables && isIndexableComponent(attribute_definition)) ||
            (!indexOnlySearchables && !isIgnoredAttribute(attribute_definition) && isIndexableAttribute(attribute_definition)))) {
            indexableContent = indexableContent ? indexableContent + ' ' + content : content;
        }
    }

    for (var j = 0; j < regionDefinitions.length; j++) {
        var region_definition = regionDefinitions[j];
        var regionID = region_definition.id;
        var region = page.getRegion(regionID);
        var regionContent = getRegionContent(region, 'components');
        if (regionContent && regionContent !== ' ') {
            indexableContent = indexableContent ? indexableContent + ' ' + regionContent : regionContent;
        }
    }

    return indexableContent;
}

/**
 * Retrieves the attribute definitions from a page meta definition.
 *
 * @param {Object} pageMetaDefinition - The page meta definition to retrieve attribute definitions from.
 * @returns {Array} An array of attribute definitions.
 */
function getAttributeDefinitions(pageMetaDefinition) {
    var attributeDefinitions = [];

    if (!pageMetaDefinition.attribute_definition_groups) {
        return attributeDefinitions;
    }

    pageMetaDefinition.attribute_definition_groups.forEach(function(group) {
        group.attribute_definitions.forEach(function(definition) {
            attributeDefinitions.push(definition);
        });
    });

    return attributeDefinitions;
}

/**
 * Retrieves the region definitions from a page meta definition.
 *
 * @param {Object} pageMetaDefinition - The page meta definition to retrieve region definitions from.
 * @returns {Array} An array of region definitions.
 */
function getRegionDefinitions (pageMetaDefinition) {
    if (!pageMetaDefinition.region_definitions) {
        return [];
    }

    return pageMetaDefinition.region_definitions;
}

/**
 * Retrieves the content of a specific attribute from a component.
 *
 * @param {dw.Exprerience.Component} component - The component to retrieve the attribute content from.
 * @param {Object} attribute_definition - The definition of the attribute to retrieve.
 * @returns {string} The content of the attribute.
 */
function getAttributeContent (component, attribute_definition) {
    var content = component.getAttribute(attribute_definition.id);
    return typeof content === 'string' ? content : '';
}


/**
 * Filter the components based on their ids.
 * @param {Object} component - The component to check.
 * @returns {boolean} Returns true if the component is indexable, otherwise false.
 */
function isIgnoredAttribute(component) {
    if (ignoredAttributes.indexOf(component.id) === -1) {
        return false;
    }

    return true;
}

/**
 * Retrieves the content of a region.
 *
 * @param {dw.Exprerience.Region} region - the region.
 * @param {string} type - The type of the region.
 * @returns {Array} An array of the content of the visible components in the region.
 */
function getRegionContent (region, type) {
    var visibleComponents = region.visibleComponents;
    var indexableContent = '';

    if (!visibleComponents.length) {
        return null;
    }

    for (var i = 0; i < visibleComponents.length; i++) {
        var content = getContainerContent(visibleComponents[i], type);
        if (content && content !== ' ') {
            indexableContent = indexableContent ? indexableContent + ' ' + content : content;
        }
    }

    return indexableContent;
}

exports.getContainerContent = getContainerContent;
exports.isIgnoredAttribute = isIgnoredAttribute;
exports.isIndexableComponent = isIndexableComponent;
exports.getRegionContent = getRegionContent;
exports.getAttributeDefinitions = getAttributeDefinitions;
exports.getRegionDefinitions = getRegionDefinitions;

