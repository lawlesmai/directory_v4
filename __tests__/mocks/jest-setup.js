// Core Jest setup file for testing infrastructure

// Mock global browser APIs
if (typeof window !== 'undefined') {
  window.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };

  window.sessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
}

// Error handling for unhandled promises
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
});

// Global test timeouts
jest.setTimeout(10000); // 10-second timeout for tests

// Suppress console warnings during tests
const originalConsoleWarn = console.warn;
console.warn = jest.fn();
