const Resource = require('dw/web/Resource');
const algoliaServiceHelper = require('../../../../../cartridges/int_algolia/cartridge/scripts/services/algoliaServiceHelper');

describe('algoliaServiceHelper.validateAPIKey', () => {
    let mockService;
    const applicationID = 'myTestAppId';
    const apiKey = 'testKey';
    const indexPrefix = 'myPrefix';

    beforeEach(() => {
        mockService = {
            call: jest.fn()
        };

        // Default Resource mocks
        Resource.msg = jest.fn((key) => `MSG:${key}`);
        Resource.msgf = jest.fn((key, bundle, ...args) => `MSGF:${key}:${args.join(',')}`);
    });

    it('should return an error if the service call fails entirely', () => {
        mockService.call.mockReturnValueOnce({
            ok: false,
            error: 'SERVICE_UNAVAILABLE',
            errorMessage: 'Could not connect'
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix
        );
        expect(result.error).toBe(true);
        expect(result.errorMessage).toContain('MSG:algolia.error.key.validation');
    });

    it('should require admin ACLs when some required permissions are missing', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // Missing 'deleteObject' and 'deleteIndex'
                    acl: ['addObject', 'settings'],
                    indexes: []
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix
        );
        expect(result.error).toBe(true);
        expect(result.errorMessage).toMatch(/MSGF:algolia.error.missing.permissions/);
    });

    it('should allow extra ACLs and return a warning', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // All required ACLs plus an extra one.
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings', 'extraACL'],
                    indexes: []
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix
        );
        expect(result.error).toBe(false);
        expect(result.warning).toMatch(/MSGF:algolia.warning.excessive.permissions/);
        expect(result.warning).toMatch(/extraACL/);
    });

    it('should pass if there are no index restrictions', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings']
                    // No indexes field implies no restrictions.
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix
        );
        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
    });

    it('should pass if restrictedIndexes contains a pattern matching the indexPrefix using polyfill logic', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings'],
                    indexes: ['myPrefix*']
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            'myPrefix'
        );
        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
    });

    it('should fail if restrictedIndexes does not match the indexPrefix using polyfill logic', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings'],
                    indexes: ['test*']
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            'myPrefix'
        );
        expect(result.error).toBe(true);
        expect(result.errorMessage).toMatch(/MSGF:algolia.error.index.restrictedprefix/);
        expect(result.errorMessage).toMatch(/myPrefix/);
    });

    it('should pass if restrictedIndexes contains the universal wildcard', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings'],
                    indexes: ['*']
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            'anythingGoes'
        );
        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
    });

    it('should use the default indexPrefix when provided indexPrefix is empty', () => {
        const defaultIndexPrefix = 'defaultPrefix';
        // Mock algoliaData.getIndexPrefix
        jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
            return {
                getIndexPrefix: function () {
                    return defaultIndexPrefix;
                },
                getDefaultIndexPrefix: function () {
                    return defaultIndexPrefix;
                }
            };
        }, { virtual: true });

        var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings'],
                    indexes: ['defaultPrefix*']
                }
            }
        });
        // Empty indexPrefix should use the default indexPrefix
        const indexPrefix = algoliaData.getDefaultIndexPrefix();

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix
        );
        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
    });

    it('should fail if indexPrefix is empty but "indexes": ["test*"] cannot match it', () => {
        const defaultIndexPrefix = 'defaultPrefix';
        jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
            return {
                getIndexPrefix: function () {
                    return defaultIndexPrefix;
                },
                getDefaultIndexPrefix: function () {
                    return defaultIndexPrefix;
                }
            };
        }, { virtual: true });

        var algoliaData = require('*/cartridge/scripts/algolia/lib/algoliaData');

        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings'],
                    indexes: ['test*']
                }
            }
        });

        // Empty indexPrefix should use the default indexPrefix
        const indexPrefix = algoliaData.getDefaultIndexPrefix();

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix
        );
        expect(result.error).toBe(true);
        expect(result.errorMessage).toMatch(/MSGF:algolia.error.index.restrictedprefix/);
    });
});
