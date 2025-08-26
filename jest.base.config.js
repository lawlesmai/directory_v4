const path = require('path');

module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  setupFiles: [
    '<rootDir>/__tests__/mocks/jest-setup.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/mocks/supabase.ts'
  ],
  modulePaths: ['<rootDir>'],
  moduleNameMapper: {
    '^@/(.*)$': path.resolve(__dirname, './$1'),
    '^@/components/(.*)$': path.resolve(__dirname, './components/$1'),
    '^@/lib/(.*)$': path.resolve(__dirname, './lib/$1'),
    '^@/types/(.*)$': path.resolve(__dirname, './types/$1'),
    '^@/__tests__/(.*)$': path.resolve(__dirname, './__tests__/$1'),
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      useESM: true,
      diagnostics: {
        warnOnly: true
      }
    }]
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@faker-js/faker|@testing-library)/)/'
  ],
  testPathIgnorePatterns: [
    '/node_modules/', 
    '/dist/', 
    '/.next/', 
    '/e2e/', 
    '/tests/e2e/'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/', 
    '/e2e/', 
    '/tests/e2e/'
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
      useESM: true
    }
  },
  afterEach: () => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }
};
