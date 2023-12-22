'use strict';

const PageMgr = require('dw/experience/PageMgr');
const contentMgr = require('dw/content/ContentMgr');
const indexableComponents = ['custom', 'cms_record', 'enum', 'markup', 'string', 'text'];
const indexOnlySearchables = false;

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
    if (indexableComponents.indexOf(component.type) === -1) {
        return false;
    }

    return !indexOnlySearchables || (component.searching && component.searching.searchable);
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
    var contentArr = [];
    var typeId;

    // We are fetching predefined metadata for the page type that is created by developers, 
    // for the detail: https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/b2c-dev-for-page-designer.html#create-page-and-component-types
    var pageMetaDefinition = require('*/cartridge/experience/' + type + '/' + page.typeID.replace(/\./g, '/') + '.json');
    var attributeDefinitions = [];
    var regionDefinitions = [];

    var attributeDefinitions = getAttributeDefinitions(pageMetaDefinition);
    var regionDefinitions = getRegionDefinitons(pageMetaDefinition);

    for (var i = 0; i < attributeDefinitions.length; i++) {
        var attribute_definition = attributeDefinitions[i];
        if (isIndexableComponent(attribute_definition)) {
            var content = getAttributeContent(page, attribute_definition);
            if (content) {
                contentArr.push(content);
            }
        }
    }

    for (var j = 0; j < regionDefinitions.length; j++) {
        var region_definition = regionDefinitions[j];
        var regionID = region_definition.id;
        var region = page.getRegion(regionID);
        var regionContent = getRegionContent(region, 'components');
        if (regionContent) {
            contentArr.push(regionContent);
        }
    }

    var indexableContent = contentArr.join('</div>');

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
function getRegionDefinitons (pageMetaDefinition) {
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
    return content;
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
    var contentArr = [];

    if (!visibleComponents.length || !visibleComponents.length > 0) {
        return null;
    }

    for (var i = 0; i < visibleComponents.length; i++) {
        var component = visibleComponents[i];
        var content = getContainerContent(component, type);
        if (content) {
            contentArr.push(content);
        }
    }

    return contentArr;
}

exports.getContainerContent = getContainerContent;
