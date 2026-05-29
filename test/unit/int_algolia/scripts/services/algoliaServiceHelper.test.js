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

    it('should require admin ACL entries when some required permissions are missing', () => {
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

    it('should allow extra ACL entries and return a warning', () => {
        mockService.call.mockReturnValueOnce({
            ok: true,
            object: {
                body: {
                    // All required ACL entries plus an extra one.
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


    it('should fail if indexPrefix is empty but "indexes": ["test*"] cannot match it', () => {
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
            indexPrefix // because indexPrefix is empty, it will use the default indexPrefix
        );
        expect(result.error).toBe(true);
        expect(result.errorMessage).toMatch(/MSGF:algolia.error.index.restrictedprefix/);
    });
});

describe('algoliaServiceHelper.validateUnretrievableAttributes', () => {
    let mockService;
    const applicationID = 'myTestAppId';
    const indexPrefix = 'myPrefix';

    beforeEach(() => {
        mockService = {
            call: jest.fn()
        };
        Resource.msg = jest.fn((key) => `MSG:${key}`);
        Resource.msgf = jest.fn((key, bundle, ...args) => `MSGF:${key}:${args.join(',')}`);
    });

    it('short-circuits when no attributes are selected', () => {
        const result = algoliaServiceHelper.validateUnretrievableAttributes(
            mockService, applicationID, indexPrefix, ['en_US'], []
        );
        expect(result).toEqual({ error: false, warning: '', notFoundNotice: '', unreachableNotice: '', details: [] });
        expect(mockService.call).not.toHaveBeenCalled();
    });

    it('short-circuits when no locales are supplied', () => {
        const result = algoliaServiceHelper.validateUnretrievableAttributes(
            mockService, applicationID, indexPrefix, [], ['ordersWeek']
        );
        expect(result).toEqual({ error: false, warning: '', notFoundNotice: '', unreachableNotice: '', details: [] });
        expect(mockService.call).not.toHaveBeenCalled();
    });

    it('short-circuits when applicationID or indexPrefix is empty', () => {
        const result1 = algoliaServiceHelper.validateUnretrievableAttributes(
            mockService, '', indexPrefix, ['en_US'], ['ordersWeek']
        );
        const result2 = algoliaServiceHelper.validateUnretrievableAttributes(
            mockService, applicationID, '', ['en_US'], ['ordersWeek']
        );
        expect(result1.error).toBe(false);
        expect(result1.warning).toBe('');
        expect(result2.error).toBe(false);
        expect(result2.warning).toBe('');
        expect(mockService.call).not.toHaveBeenCalled();
    });

    it('returns no warning when every selected attribute is in unretrievableAttributes for every locale', () => {
        mockService.call
            .mockReturnValueOnce({ ok: true, object: { body: { unretrievableAttributes: ['ordersWeek', 'revenueWeek'] } } })
            .mockReturnValueOnce({ ok: true, object: { body: { unretrievableAttributes: ['ordersWeek', 'revenueWeek'] } } });

        const result = algoliaServiceHelper.validateUnretrievableAttributes(
            mockService,
            applicationID,
            indexPrefix,
            ['en_US', 'fr_FR'],
            ['ordersWeek', 'revenueWeek']
        );

        expect(mockService.call).toHaveBeenCalledTimes(2);
        expect(result.error).toBe(false);
        expect(result.warning).toBe('');
        expect(result.details).toHaveLength(2);
        expect(result.details[0].missing).toEqual([]);
        expect(result.details[1].missing).toEqual([]);
    });

    it('returns a warning listing missing attributes per index', () => {
        // en_US is fully configured; fr_FR is missing both
        mockService.call
            .mockReturnValueOnce({ ok: true, object: { body: { unretrievableAttributes: ['ordersWeek', 'revenueWeek'] } } })
            .mockReturnValueOnce({ ok: true, object: { body: { unretrievableAttributes: [] } } });

        const result = algoliaServiceHelper.validateUnretrievableAttributes(
            mockService,
            applicationID,
            indexPrefix,
            ['en_US', 'fr_FR'],
            ['ordersWeek', 'revenueWeek']
        );

        expect(result.error).toBe(false);
        expect(result.warning).toMatch(/MSGF:algolia.warning.unretrievable.missing/);
        expect(result.warning).toMatch(/myPrefix__products__fr_FR/);
        expect(result.warning).toMatch(/ordersWeek/);
        expect(result.warning).toMatch(/revenueWeek/);
        expect(result.warning).not.toMatch(/myPrefix__products__en_US/);
        expect(result.details).toHaveLength(2);
        expect(result.details[0].missing).toEqual([]);
        expect(result.details[1].missing).toEqual(['ordersWeek', 'revenueWeek']);
    });

    it('treats missing unretrievableAttributes (undefined) as no entries configured', () => {
        mockService.call.mockReturnValueOnce({ ok: true, object: { body: {} } });

        const result = algoliaServiceHelper.validateUnretrievableAttributes(
            mockService,
            applicationID,
            indexPrefix,
            ['en_US'],
            ['ordersWeek']
        );

        expect(result.error).toBe(false);
        expect(result.warning).toMatch(/MSGF:algolia.warning.unretrievable.missing/);
        expect(result.details[0].missing).toEqual(['ordersWeek']);
    });

    it('soft-fails on 404 (index does not exist yet) -> notFoundNotice, no warning', () => {
        mockService.call.mockReturnValueOnce({ ok: false, error: 404, errorMessage: 'Index not found' });

        const result = algoliaServiceHelper.validateUnretrievableAttributes(
            mockService,
            applicationID,
            indexPrefix,
            ['en_US'],
            ['ordersWeek']
        );

        expect(result.error).toBe(false);
        expect(result.warning).toBe('');
        expect(result.notFoundNotice).toMatch(/MSGF:algolia.notice.unretrievable.notfound/);
        expect(result.notFoundNotice).toMatch(/myPrefix__products__en_US/);
        expect(result.unreachableNotice).toBe('');
        expect(result.details).toHaveLength(1);
        expect(result.details[0].status).toBe('not-found');
        expect(result.details[0].missing).toEqual([]);
    });

    it('soft-fails on auth/network errors -> unreachableNotice, no warning', () => {
        mockService.call.mockReturnValueOnce({ ok: false, error: 403, errorMessage: 'Forbidden' });

        const result = algoliaServiceHelper.validateUnretrievableAttributes(
            mockService,
            applicationID,
            indexPrefix,
            ['en_US'],
            ['ordersWeek']
        );

        expect(result.error).toBe(false);
        expect(result.warning).toBe('');
        expect(result.notFoundNotice).toBe('');
        expect(result.unreachableNotice).toMatch(/MSGF:algolia.notice.unretrievable.unreachable/);
        expect(result.unreachableNotice).toMatch(/myPrefix__products__en_US/);
        expect(result.details).toHaveLength(1);
        expect(result.details[0].status).toBe('unreachable');
        expect(result.details[0].error).toMatch(/Forbidden/);
    });

    it('soft-fails when service.call throws -> unreachableNotice, no warning', () => {
        mockService.call.mockImplementationOnce(() => { throw new Error('connection reset'); });

        const result = algoliaServiceHelper.validateUnretrievableAttributes(
            mockService,
            applicationID,
            indexPrefix,
            ['en_US'],
            ['ordersWeek']
        );

        expect(result.error).toBe(false);
        expect(result.warning).toBe('');
        expect(result.notFoundNotice).toBe('');
        expect(result.unreachableNotice).toMatch(/MSGF:algolia.notice.unretrievable.unreachable/);
        expect(result.details).toHaveLength(1);
        expect(result.details[0].status).toBe('unreachable');
        expect(result.details[0].error).toBe('connection reset');
    });

    it('mixed outcomes across locales -> warning + notFoundNotice + unreachableNotice all populated', () => {
        // gap on en_US, 404 on fr_FR, 403 on de_DE, ok on it_IT
        mockService.call
            .mockReturnValueOnce({ ok: true, object: { body: { unretrievableAttributes: [] } } })
            .mockReturnValueOnce({ ok: false, error: 404, errorMessage: 'Not found' })
            .mockReturnValueOnce({ ok: false, error: 403, errorMessage: 'Forbidden' })
            .mockReturnValueOnce({ ok: true, object: { body: { unretrievableAttributes: ['ordersWeek'] } } });

        const result = algoliaServiceHelper.validateUnretrievableAttributes(
            mockService,
            applicationID,
            indexPrefix,
            ['en_US', 'fr_FR', 'de_DE', 'it_IT'],
            ['ordersWeek']
        );

        expect(result.error).toBe(false);
        expect(result.warning).toMatch(/myPrefix__products__en_US/);
        expect(result.notFoundNotice).toMatch(/myPrefix__products__fr_FR/);
        expect(result.unreachableNotice).toMatch(/myPrefix__products__de_DE/);
        expect(result.details.map(d => d.status)).toEqual(['missing', 'not-found', 'unreachable', 'ok']);
    });


    it('builds the expected URL per locale', () => {
        mockService.call
            .mockReturnValue({ ok: true, object: { body: { unretrievableAttributes: ['ordersWeek'] } } });

        algoliaServiceHelper.validateUnretrievableAttributes(
            mockService,
            applicationID,
            indexPrefix,
            ['en_US', 'fr_FR'],
            ['ordersWeek']
        );

        expect(mockService.call).toHaveBeenNthCalledWith(1, {
            method: 'GET',
            url: 'https://myTestAppId.algolia.net/1/indexes/myPrefix__products__en_US/settings'
        });
        expect(mockService.call).toHaveBeenNthCalledWith(2, {
            method: 'GET',
            url: 'https://myTestAppId.algolia.net/1/indexes/myPrefix__products__fr_FR/settings'
        });
    });
});
