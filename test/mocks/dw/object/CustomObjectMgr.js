jest.mock('dw/object/CustomObjectMgr', () => ({
    getAllCustomObjects: jest.fn().mockReturnValue({
        getCount: jest.fn().mockReturnValue(0)
    }),
    createCustomObject: jest.fn(),
    queryCustomObjects: jest.fn()
}), { virtual: true });