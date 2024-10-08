const Result = require('dw/svc/Result');
const retryStrategy = require('../../../../../../cartridges/int_algolia/cartridge/scripts/algolia/helper/retryStrategy');

const appID = 'TESTAPP';

jest.mock('dw/svc/Result', () => {
    return {
        // https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/api/class_dw_svc_Result.html#dw_svc_Result_UNAVAILABLE_TIMEOUT_DetailAnchor
        UNAVAILABLE_TIMEOUT: 'TIMEOUT',
    }
},
{virtual: true});
jest.mock('*/cartridge/scripts/algolia/lib/algoliaData', () => {
    return {
        getPreference: jest.fn((property) => {
            switch (property) {
                case 'ApplicationID':
                    return appID;
            }
        }),
    }
}, {virtual: true});

beforeEach(() => {
    retryStrategy.initHosts();
})

test('StatefulHost', () => {
    const statefulhost = new retryStrategy.StatefulHost('http://test.com');
    expect(statefulhost.hostname).toBe('http://test.com');
    expect(statefulhost.isDown).toBe(false);
    expect(statefulhost.isExpired()).toBe(false);

    statefulhost.markDown();
    expect(statefulhost.isDown).toBe(true);
    expect(statefulhost.isExpired()).toBe(false);

    // Set lastUpdate to 5 min and 1 second ago
    statefulhost.lastUpdate = Date.now() - 5 * 60 * 1000 - 1000;
    expect(statefulhost.isExpired()).toBe(true);

    statefulhost.reset();
    expect(statefulhost.isDown).toBe(false);
});

test('defaultHosts', () => {
    expect(retryStrategy.getAvailableHosts()
        .map(statefulhost => statefulhost.hostname)).toEqual([
        `${appID}.algolia.net`,
        `${appID}-1.algolianet.com`,
        `${appID}-2.algolianet.com`,
        `${appID}-3.algolianet.com`,
    ]);
});

test('isRetryable', () => {
    const getUnavailableReasonMock = jest.fn();
    const getErrorMock = jest.fn().mockReturnValue(0);

    const result = {
        getUnavailableReason: getUnavailableReasonMock,
        getError: getErrorMock,
        getObject: jest.fn(),
    }

    getUnavailableReasonMock.mockReturnValueOnce(Result.UNAVAILABLE_TIMEOUT)
    expect(retryStrategy.isRetryable(result)).toBe(true);

    getErrorMock.mockReturnValueOnce(101)
    expect(retryStrategy.isRetryable(result)).toBe(true);

    getErrorMock.mockReturnValueOnce(302)
    expect(retryStrategy.isRetryable(result)).toBe(true);

    getErrorMock.mockReturnValueOnce(204)
    expect(retryStrategy.isRetryable(result)).toBe(false);

    getErrorMock.mockReturnValueOnce(400)
    expect(retryStrategy.isRetryable(result)).toBe(false);
});

test('retryableCall - success on 3rd server', () => {
    const serverErrorResult = {
        ok: false,
        getUnavailableReason: jest.fn(),
        getError: jest.fn().mockReturnValue(502),
        getErrorMessage: jest.fn().mockReturnValue('Bad Gateway'),
    }
    const timeoutErrorResult = {
        ok: false,
        getUnavailableReason: jest.fn().mockReturnValue(Result.UNAVAILABLE_TIMEOUT),
        getError: jest.fn().mockReturnValue(0),
        getErrorMessage: jest.fn().mockReturnValue(''),
    }

    const callMock = jest.fn()
        .mockReturnValueOnce(serverErrorResult)
        .mockReturnValueOnce(timeoutErrorResult)
        .mockReturnValueOnce({ ok: true });
    const service = {
        call: callMock,
    }

    retryStrategy.retryableCall(service, { path: '/test' });

    expect(callMock).toHaveBeenCalledTimes(3);
    // Only hosts in errors are marked as down, hosts that timeout are kept in the list
    expect(retryStrategy.getAvailableHosts()).toHaveLength(3);
});

test('retryableCall - error', () => {
    const serverErrorResult = {
        ok: false,
        getUnavailableReason: jest.fn(),
        getError: jest.fn().mockReturnValue(502),
        getErrorMessage: jest.fn().mockReturnValue('Bad Gateway'),
    }

    const callMock = jest.fn().mockReturnValue(serverErrorResult)
    const service = {
        call: callMock,
    }

    const result = retryStrategy.retryableCall(service, { path: '/test' });

    expect(callMock).toHaveBeenCalledTimes(4);
    expect(result.getError()).toBe(502);
    expect(result.getErrorMessage()).toBe('Bad Gateway');
    // All hosts have been marked down, getAvailableHosts() reset them all at the next call
    expect(retryStrategy.getAvailableHosts()).toHaveLength(4);
});
