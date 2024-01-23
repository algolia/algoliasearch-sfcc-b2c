'use strict';

// Import the module and mocks
var AlgoliaLocalizedContent = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/model/algoliaLocalizedContent');
var ContentMock = require('../../../../../mocks/dw/content/Content');
var GlobalMock = require('../../../../../mocks/global');
var ObjectHelper = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/objectHelper');
// Mock global dependencies
global.request = new GlobalMock.RequestMock();

jest.mock('*/cartridge/scripts/algolia/lib/pageDesignerHelper', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/pageDesignerHelper');
}, {virtual: true});

jest.mock('*/cartridge/scripts/algolia/helper/objectHelper', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/objectHelper');
}, {virtual: true});

jest.mock('*/cartridge/scripts/algolia/lib/algoliaContentConfig', () => {
    return jest.requireActual('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/lib/algoliaContentConfig');
}, {virtual: true});

jest.mock('*/cartridge/experience/pages/storePage.json', () => {
    const originalModule = jest.requireActual('../../../../../mocks/sfra/experiences/editorialRichText.json');
    return originalModule;
}, {virtual: true});

describe('AlgoliaLocalizedContent', () => {
    let contentMock;

    beforeEach(() => {
        // Setup a basic content mock
        contentMock = new ContentMock();
        contentMock.ID = 'testContentID';
        contentMock.custom = {};
    });

    test('should initialize correctly with given parameters', () => {
        const attributeList = ['url', 'body'];
        const algoliaContent = new AlgoliaLocalizedContent({ content: contentMock, locale: 'en', attributeList, includedContent: 'allContents' });

        expect(algoliaContent.objectID).toEqual('testContentID');
        expect(algoliaContent.url).toBeDefined();
        expect(algoliaContent.body).toBeDefined();
    });

    test('body handler returns content for a page', () => {
        contentMock.isPage = jest.fn().mockReturnValue(true);

        const attributeList = ['body'];
        const algoliaContent = new AlgoliaLocalizedContent({ content: contentMock, locale: 'en', attributeList, includedContent: 'allContents' });

        expect(algoliaContent.body).toEqual('testValue');
    });

    test('body handler returns custom body content', () => {
        contentMock.isPage = jest.fn().mockReturnValue(false);
        contentMock.custom.body = { source: 'mockedCustomBody' };

        const attributeList = ['body'];
        const algoliaContent = new AlgoliaLocalizedContent({ content: contentMock, locale: 'en', attributeList, includedContent: 'allContents' });

        expect(algoliaContent.body).toEqual('mockedCustomBody');
    });

    test('body handler returns custom body content', () => {
        contentMock.isPage = jest.fn().mockReturnValue(false);
        contentMock.custom.body = { source: 'mockedCustomBody' };

        const attributeList = ['body'];
        const algoliaContent = new AlgoliaLocalizedContent({ content: contentMock, locale: 'en', attributeList, includedContent: 'allContents' });

        expect(algoliaContent.body).toEqual('mockedCustomBody');
    });

    test('attributes are handled correctly', () => {
        contentMock.custom.attribute = 'mockedAttribute';

        const attributeList = ['custom.attribute'];
        const algoliaContent = new AlgoliaLocalizedContent({ content: contentMock, locale: 'en', attributeList, includedContent: 'allContents' });

        expect(ObjectHelper.getAttributeValue(contentMock, attributeList[0])).toEqual('mockedAttribute');
    });

});
