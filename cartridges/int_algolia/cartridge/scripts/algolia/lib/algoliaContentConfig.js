'use strict';

var defaultAttributes = ['id', 'name', 'description', 'url', 'body', 'page']; 

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
    id: {
        attribute: 'ID',
        localized: false
    },
    name: {
        attribute: 'name',
        localized: true
    },
    algolia_chunk_order: {
        attribute: 'order',
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
    pageTitle: {
        attribute: 'pageTitle',
        localized: true
    },
    url: {
        attribute: 'url',
        localized: true
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
