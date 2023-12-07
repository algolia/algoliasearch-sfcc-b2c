'use strict';

var defaultAttributes = ['id', 'name', 'description', 'url', 'body', 'classificationFolder', 'page', 'order'];

var attributeConfig = {
    body: {
        attribute: 'body',
        localized: true
    },
    classificationFolder: {
        attribute: 'classificationFolder.ID',
        localized: false
    },
    description: {
        attribute: 'description',
        localized: true
    },
    folders: {
        attribute: 'folders',
        localized: false
    },
    id: {
        attribute: 'ID',
        localized: false
    },
    name: {
        attribute: 'name',
        localized: true
    },
    order: {
        attribute: 'order',
        localized: false
    },
    online: {
        attribute: 'online',
        localized: false
    },
    onlineFlag: {
        attribute: 'onlineFlag',
        localized: false
    },
    page: {
        attribute: 'page',
        localized: false
    },
    pageDescription: {
        attribute: 'pageDescription',
        localized: true
    },
    pageKeywords: {
        attribute: 'pageKeywords',
        localized: true
    },
    pageMetaTags: {
        attribute: 'pageMetaTags',
        localized: true
    },
    pageTitle: {
        attribute: 'pageTitle',
        localized: true
    },
    url: {
        attribute: 'url',
        localized: true
    },
    searchable: {
        attribute: 'searchable',
        localized: false
    },
    searchableFlag: {
        attribute: 'searchableFlag',
        localized: false
    },
    siteMapChangeFrequency: {
        attribute: 'siteMapChangeFrequency',
        localized: false
    },
    siteMapIncluded: {
        attribute: 'siteMapIncluded',
        localized: false
    },
    siteMapPriority: {
        attribute: 'siteMapPriority',
        localized: false
    },
    template: {
        attribute: 'template',
        localized: true
    }
};


module.exports = {
    defaultAttributes: defaultAttributes,
    attributeConfig: attributeConfig,
};
