jest.mock('dw/system/Logger', () => {
    return {
        info: jest.fn(),
        error: jest.fn(),
        getLogger: jest.fn(() => {
            return {
                info: jest.fn(),
                error: jest.fn(),
            }
        }),
    }
},
{virtual: true});