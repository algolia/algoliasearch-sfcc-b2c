const {
    isIndexableComponent,
    getContainerContent,
    getAttributeDefinitions,
    getRegionDefinitons,
    isIgnoredAttribute,
    getRegionContent
} = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/pageDesignerHelper');

jest.mock('dw/experience/PageMgr', () => {
    class PageMock {
        constructor() {
            this.id = 'mockPage';
            this.typeID = 'storePage';
            this.regions = {
                mockRegion: {
                    visibleComponents: [{
                        id: 'mockComponent1',
                        testAttribute: 'testValue',
                    },
                    {
                        id: 'mockComponent2'
                    }],
                },
            };
        }

        getRegion(id) {
            return this.regions['mockRegion'];
        }

        getAttribute(id) {
            return this.regions['mockRegion'].visibleComponents[0].testAttribute;
        }

        getPage(id) {
            return this;
        }
    }

    return {
        getPage: jest.fn().mockImplementation((id) => {
            return new PageMock()
        }),
    };
}, {
    virtual: true
});

jest.mock('*/cartridge/experience/mockType/storePage.json', () => {
    const originalModule = jest.requireActual('../../../../../mocks/sfra/experiences/storePage.json');
    return originalModule;
}, {
    virtual: true
});

jest.mock('*/cartridge/experience/components/storePage.json', () => {
    const originalModule = jest.requireActual('../../../../../mocks/sfra/experiences/editorialRichText.json');
    return originalModule;
}, {
    virtual: true
});

describe('isIndexableComponent', () => {
    test('should return true for searchable components', () => {
        const component = {
            searching: {
                searchable: true
            }
        };
        expect(isIndexableComponent(component)).toBe(true);
    });

    test('should return false for non-searchable components', () => {
        const component = {
            searching: {
                searchable: false
            }
        };
        expect(isIndexableComponent(component)).toBe(false);
    });

    test('should return false for components without searching property', () => {
        const component = {};
        expect(isIndexableComponent(component)).toBe(false);
    });
});

describe('getContainerContent', () => {
    test('should retrieve content from container correctly', () => {
        // Set up a mock container and type
        const container = require('dw/experience/PageMgr').getPage('mockPage');

        const type = 'mockType';

        // Call the function and verify the result
        const result = getContainerContent(container, type);
        // Expectations based on the mock data

        // Verify that the correct page was retrieved (due to mock data)
        expect(result).toBe('testValue testValue testValue testValue testValue testValue');
    });
});

describe('Attribute and Region Definitions', () => {
    test('getAttributeDefinitions should return correct definitions', () => {
        const pageMetaDefinition = {
            attribute_definition_groups: [{
                attribute_definitions: [{
                    mockAttribute: {
                        type: 'mockType',
                    },
                }],
            }]
        };
        const result = getAttributeDefinitions(pageMetaDefinition);
        // Expectations
        expect(result).toEqual([{
            mockAttribute: {
                type: 'mockType',
            },
        }]);
    });

    test('getRegionDefinitons should return correct definitions', () => {
        const pageMetaDefinition = {
            region_definitions: {
                mockRegion: {
                    type: 'mockType',
                },
            },
        };
        const result = getRegionDefinitons(pageMetaDefinition);
        // Expectations
        expect(result).toEqual({
            mockRegion: {
                type: 'mockType',
            },
        });
    });
});

describe('isIgnoredAttribute', () => {
    test('should return true for ignored attributes', () => {
        const component = {
            id: 'customCategoryName1'
        };
        expect(isIgnoredAttribute(component)).toBe(true);
    });

    test('should return false for non-ignored attributes', () => {
        const component = {
            id: 'nonIgnoredAttribute'
        };
        expect(isIgnoredAttribute(component)).toBe(false);
    });
});

describe('getRegionContent', () => {
    test('should retrieve content from a region correctly', () => {
        const page = require('dw/experience/PageMgr').getPage('mockPage');
        const region = page.getRegion('mockRegion');
        const type = 'mockType';

        const result = getRegionContent(region, type);

        // Expectations (due to mock data)
        expect(result).toEqual('testValue testValue testValue testValue testValue testValue testValue testValue testValue testValue testValue testValue');
    });
});
