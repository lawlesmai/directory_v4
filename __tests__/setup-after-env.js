// Jest setup that runs after the test environment is set up
require('@testing-library/jest-dom');

// Global cleanup after each test
afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
  jest.clearAllTimers();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});