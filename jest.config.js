/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
const config = {
    // Automatically clear mock calls, instances, contexts and results before every test
    clearMocks: true,

    // The paths to modules that run some code to configure or set up the testing environment before each test
    setupFiles: ['<rootDir>/jest.setup.js'],
    testPathIgnorePatterns: ['/node_modules/', '/test/e2e/'],
};

module.exports = config;
