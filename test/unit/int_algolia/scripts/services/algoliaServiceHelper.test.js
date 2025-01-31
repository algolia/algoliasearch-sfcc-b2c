/**
 * File: test/unit/int_algolia/scripts/services/algoliaServiceHelper.test.js
 */

const Resource = require('dw/web/Resource');
const algoliaServiceHelper = require('../../../../../cartridges/int_algolia/cartridge/scripts/services/algoliaServiceHelper');

/**
 * Mock details:
 *   - We'll only test validateAPIKey’s handling of ACL array and index prefix coverage.
 *   - We no longer do loop checking each locale; we only verify that the user prefix is within
 *     at least one wildcard from "indexes".
 */

describe('algoliaServiceHelper.validateAPIKey', () => {
    let mockService;
    const applicationID = 'myTestAppId';
    const apiKey = 'testKey';
    const indexPrefix = 'myPrefix';

    beforeEach(() => {
        mockService = {
            call: jest.fn()
        };

        // Default Resource mock
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
            indexPrefix,
            true,   // isAdminKey
            false   // isRecommendationEnabled
        );
        expect(result.error).toBe(true);
        expect(result.errorMessage).toContain('MSG:algolia.error.key.validation');
    });

    it('should require admin ACLs for an admin key', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // Missing some admin permissions
                    acl: ['addObject', 'settings'], // missing deleteObject, deleteIndex
                    indexes: []
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            true,  // isAdminKey
            false
        );
        expect(result.error).toBe(true);
        expect(result.errorMessage).toMatch(/missing.permissions/i);
        // We can also verify it mentions 'deleteObject' and 'deleteIndex'
    });

    it('should require "search" ACL for a search key', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
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
            false, // isAdminKey
            false  // isRecommendationEnabled
        );
        expect(result.error).toBe(true);
        expect(result.errorMessage).toMatch(/missing.permissions/i);
        expect(result.errorMessage).toMatch(/search/);
    });

    it('should require "recommendation" ACL if isRecommendationEnabled for search key', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['search'],
                    indexes: []
                }
            }
        });

        // Now we expect "recommendation" too
        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            false,  // not admin
            true    // recommend
        );
        expect(result.error).toBe(true);
        expect(result.errorMessage).toMatch(/missing.permissions/i);
        expect(result.errorMessage).toMatch(/recommendation/);
    });

    it('should allow extra ACLs but mark them as a warning', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // Perfect admin ACL plus extras
                    acl: [
                        'addObject', 'deleteObject', 'deleteIndex', 'settings',
                        'extraACL'
                    ],
                    indexes: []
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            true,  // admin
            false
        );
        expect(result.error).toBe(false);
        expect(result.warning).toMatch(/excessive.permissions/i);
        expect(result.warning).toMatch(/extraACL/);
    });

    it('should pass if no index restrictions (i.e. no "indexes" field)', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // minimal search key
                    acl: ['search']
                    // no indexes field => means unrestricted
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            indexPrefix,
            false, // search key
            false
        );
        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
    });

    it('should pass if "indexes": ["myPrefix*"] covers the user-specified prefix "myPrefix"', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['search'],
                    indexes: ['myPrefix*']
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            'myPrefix', // user prefix
            false,      // not admin
            false
        );
        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
    });

    it('should fail if "indexes": ["test*"] does not match the user prefix "myPrefix"', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['search'],
                    indexes: ['test*']
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            'myPrefix', // mismatch
            false,
            false
        );
        expect(result.error).toBe(true);
        expect(result.errorMessage).toMatch(/restrictedprefix/);
        expect(result.errorMessage).toMatch(/myPrefix/);
    });

    it('should handle a universal wildcard "*" that matches any prefix', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['search'],
                    indexes: ['*']
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            'anythingGoes',
            false,
            false
        );
        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
    });

    it('should pass if indexPrefix is empty but "indexes": ["*"] covers it', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['search'],
                    indexes: ['*']
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            '',   // user typed no prefix
            false,
            false
        );
        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
    });

    it('should fail if indexPrefix is empty but "indexes": ["test*"] cannot match it', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['search'],
                    indexes: ['test*']
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(
            mockService,
            applicationID,
            apiKey,
            '', // no prefix
            false,
            false
        );
        expect(result.error).toBe(true);
        expect(result.errorMessage).toMatch(/restrictedprefix/);
    });
});
