require('@testing-library/jest-dom');

// Set up mocking for Next.js environment
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '',
      query: {},
      asPath: '',
    };
  },
}));

// Mock window and global browser APIs if needed
if (typeof window !== 'undefined') {
  window.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
}

// Global error handling for unhandled promises
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
});
