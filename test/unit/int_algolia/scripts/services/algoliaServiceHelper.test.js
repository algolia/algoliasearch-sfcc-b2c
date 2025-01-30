/**
 * File: test/unit/int_algolia/scripts/services/algoliaServiceHelper.test.js
 */

const Resource = require('dw/web/Resource');
const algoliaServiceHelper = require('../../../../../cartridges/int_algolia/cartridge/scripts/services/algoliaServiceHelper');

describe('algoliaServiceHelper.validateAPIKey', () => {
    let mockService;
    const applicationID = 'myTestAppId';
    const apiKey = 'testKey';
    const indexPrefix = 'myPrefix';
    const locales = ['en_US', 'fr_FR'];

    beforeEach(() => {
        mockService = {
            call: jest.fn()
        };

        // Default Resource mock: we can refine or just have it echo
        Resource.msg = jest.fn((key) => `MSG:${key}`);
        Resource.msgf = jest.fn((key, bundle, ...args) => `MSGF:${key}:${args.join(',')}`);
    });

    it('should return error if the service call fails altogether', () => {
        // The GET call that fetches key info fails
        mockService.call.mockReturnValueOnce({
            ok: false,
            error: 'SERVICE_UNAVAILABLE',
            errorMessage: 'Could not connect'
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            locales,
            true,    // isAdminKey
            false,   // isRecommendationEnabled
            false    // isContentSearchEnabled
        );

        expect(result.error).toBe(true);
        expect(result.errorMessage).toContain('MSG:algolia.error.key.validation');
    });

    it('should return error if admin key is missing any of the required ACLs', () => {
        // The GET call returns partial ACL only
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // Missing 'addObject' and 'deleteIndex'
                    acl: ['deleteObject', 'settings'],
                    indexes: []
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            locales,
            true,   // isAdminKey
            false,  // recommend
            false   // contentSearch
        );

        expect(result.error).toBe(true);
        // Should see 'missing.permissions' message
        expect(result.errorMessage).toMatch(/missing.permissions/);
        expect(result.warning).toBe('');
    });

    it('should return error if search key is missing required ACLs (search)', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // Missing 'search'
                    acl: ['settings'],
                    indexes: []
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            locales,
            false,  // isAdminKey => false, so we require search
            false,  // recommend
            false   // contentSearch
        );

        expect(result.error).toBe(true);
        expect(result.errorMessage).toMatch(/missing.permissions/);
        expect(result.warning).toMatch(/settings/);
    });

    it('should return warning if there are excessive ACLs but no error if required ACLs exist', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // Admin key minimal is [addObject, deleteObject, deleteIndex, settings]
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings', 'extraACL1', 'extraACL2'],
                    indexes: []
                }
            }
        });

        // No index restrictions => means user can access everything
        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            locales,
            true,   // isAdminKey
            false,
            false
        );

        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
        // We do expect a warning about the extra ACLs
        expect(result.warning).toMatch(/excessive.permissions/);
        expect(result.warning).toMatch(/extraACL1, extraACL2/);
    });

    it('should pass if required ACLs are present and no index restrictions are given', () => {
        // This covers the scenario that "indexes" array is empty => means no restriction
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings'],
                    indexes: []
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            locales,
            true,
            false,
            false
        );

        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
        expect(result.warning).toBe('');
    });

    it('should fail if indexes are restricted and do not include all product/category indexes', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings'],
                    // 'myPrefix__products__en_US' => missing or doesn't match
                    indexes: ['myPrefix__products__fr_FR', 'myPrefix__categories__en_US', 'myPrefix__categories__fr_FR']
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            locales,
            true,
            false,
            false
        );

        expect(result.error).toBe(true);
        // Should mention the missing index, e.g. 'myPrefix__products__en_US'
        expect(result.errorMessage).toMatch(/algolia.error.index.restricted/);
    });

    it('should pass if indexes field includes wildcard that covers everything', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // Admin ACL
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings'],
                    // Single pattern: "myPrefix__*"
                    indexes: ['myPrefix__*']
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            locales,
            true,   // isAdminKey
            false,  // recommend
            false   // contentSearch
        );

        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
        expect(result.warning).toBe('');
    });

    it('should require "recommend" ACL if isRecommendationEnabled is true (search key scenario)', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // minimal search key => missing 'recommend'
                    acl: ['search'],
                    indexes: []
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            locales,
            false, // isAdminKey => false => search key
            true,  // isRecommendationEnabled
            false  // isContentSearchEnabled
        );

        expect(result.error).toBe(true);
        expect(result.errorMessage).toMatch(/missing.permissions/);
        expect(result.errorMessage).toMatch(/recommend/);
    });

    it('should require "contents" index coverage if isContentSearchEnabled is true', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['search'],
                    indexes: ['myPrefix__products__en_US', 'myPrefix__categories__en_US']
                    // "contents" index is not present => should fail
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            ['en_US'], // single locale for simplicity
            false,     // search key
            false,     // recommend
            true       // content search
        );

        expect(result.error).toBe(true);
        // error about missing 'myPrefix__contents__en_US'
        expect(result.errorMessage).toMatch(/contents__en_US/);
    });

    it('should pass if "contents" index is included and search ACL is correct for content search', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['search'],
                    indexes: [
                        'myPrefix__products__en_US',
                        'myPrefix__categories__en_US',
                        'myPrefix__contents__en_US'
                    ]
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            ['en_US'],
            false,  // isAdminKey => search key
            false,  // recommend
            true    // content search
        );

        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
        expect(result.warning).toBe('');
    });

    it('should handle a scenario with both recommend & content search enabled and pass if everything is correct', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // includes 'recommend' for search
                    acl: ['search', 'recommendation'],
                    indexes: [
                        'myPrefix__products__en_US',
                        'myPrefix__categories__en_US',
                        'myPrefix__contents__en_US'
                    ]
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            ['en_US'],
            false,  // search key
            true,   // recommend
            true    // content search
        );

        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
        expect(result.warning).toBe('');
    });

    it('should add a warning if user’s key has the needed ACLs but also some unrelated ACL', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: [
                        'search', 'recommendation',
                        'unnecessaryACL'
                    ],
                    indexes: ['myPrefix__*']
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            ['en_US'],
            false, // search key
            true,  // recommend
            false  // content search
        );

        expect(result.error).toBe(false);
        expect(result.warning).toMatch(/excessive.permissions/);
        expect(result.warning).toMatch(/unnecessaryACL/);
    });
});
