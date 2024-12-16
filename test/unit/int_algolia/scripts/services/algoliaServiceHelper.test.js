const Resource = require('dw/web/Resource');
const algoliaServiceHelper = require('../../../../../cartridges/int_algolia/cartridge/scripts/services/algoliaServiceHelper');

describe('validateAPIKey', () => {
    let mockService;
    const applicationID = 'testAppId';
    const adminApiKey = 'testApiKey';

    beforeEach(() => {
        mockService = {
            call: jest.fn()
        };

        // Mock Resource messages
        Resource.msg = jest.fn((key) => key);
        Resource.msgf = jest.fn((key, bundle, ...args) => `${key} ${args.join(',')}`);
    });

    it('should return error if key validation fails', () => {
        mockService.call.mockReturnValueOnce({
            ok: false
        });

        const result = algoliaServiceHelper.validateAPIKey(mockService, applicationID, adminApiKey);

        expect(result.error).toBe(true);
        expect(result.errorMessage).toBe('algolia.error.key.validation');
        expect(mockService.call).toHaveBeenCalledWith({
            method: 'GET',
            url: 'https://' + applicationID + '.algolia.net/1/keys/' + adminApiKey
        });
    });

    it('should return error if required ACLs are missing', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['deleteObject', 'settings'] // Missing addObject and deleteIndex
                }
            }
        });

        const result = algoliaServiceHelper.validateAPIKey(mockService, applicationID, adminApiKey);

        expect(result.error).toBe(true);
        expect(result.errorMessage).toBe('algolia.error.missing.permissions ,addObject, deleteIndex');
        expect(result.warning).toBe('');
    });

    it('should return warning if there are excessive permissions', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings', 'extraPermission1', 'extraPermission2']
                }
            }
        }).mockReturnValueOnce({
            ok: true
        });

        const result = algoliaServiceHelper.validateAPIKey(mockService, applicationID, adminApiKey);

        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
        expect(result.warning).toBe('algolia.warning.excessive.permissions ,extraPermission1, extraPermission2');
    });

    it('should return error if index access check fails', () => {
        mockService.call
            .mockReturnValueOnce({
                ok: true,
                object: {
                    body: {
                        acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings']
                    }
                }
            })
            .mockReturnValueOnce({
                ok: false
            });

        const result = algoliaServiceHelper.validateAPIKey(mockService, applicationID, adminApiKey);

        expect(result.error).toBe(true);
        expect(result.errorMessage).toBe('algolia.error.index.access');
    });

    it('should validate successfully with correct permissions', () => {
        mockService.call
            .mockReturnValueOnce({
                ok: true,
                object: {
                    body: {
                        acl: ['addObject', 'deleteObject', 'deleteIndex', 'settings']
                    }
                }
            })
            .mockReturnValueOnce({
                ok: true
            });

        const result = algoliaServiceHelper.validateAPIKey(mockService, applicationID, adminApiKey);

        expect(result.error).toBe(false);
        expect(result.errorMessage).toBe('');
        expect(result.warning).toBe('');
        expect(mockService.call).toHaveBeenCalledTimes(2);
        expect(mockService.call).toHaveBeenNthCalledWith(1, {
            method: 'GET',
            url: 'https://' + applicationID + '.algolia.net/1/keys/' + adminApiKey
        });
        expect(mockService.call).toHaveBeenNthCalledWith(2, {
            method: 'GET',
            url: expect.stringContaining('/1/indexes/') // Test index name will be dynamic
        });
    });
}); 