const path = require('path');

module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: [
    '<rootDir>/__tests__/mocks/jest-setup.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/setup-after-env.js'
  ],
  modulePaths: ['<rootDir>'],
  moduleNameMapper: {
    '^@/(.*)$': path.resolve(__dirname, './$1'),
    '^@/components/(.*)$': path.resolve(__dirname, './components/$1'),
    '^@/lib/(.*)$': path.resolve(__dirname, './lib/$1'),
    '^@/types/(.*)$': path.resolve(__dirname, './types/$1'),
    '^@/__tests__/(.*)$': path.resolve(__dirname, './__tests__/$1'),
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(png|jpg|jpeg|gif|svg)$': 'jest-transform-stub'
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      useESM: false,
      isolatedModules: true
    }]
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@faker-js/faker|@testing-library|@supabase|uuid)/)/'
  ],
  testMatch: [
    '<rootDir>/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)',
    '<rootDir>/tests/**/*.(test|spec).(ts|tsx|js|jsx)',
    '!<rootDir>/tests/**/*.e2e.*',
    '!<rootDir>/tests/**/e2e/**/*',
    '!<rootDir>/**/*.spec.ts' // Exclude Playwright specs
  ],
  testPathIgnorePatterns: [
    '/node_modules/', 
    '/dist/', 
    '/.next/', 
    '/e2e/', 
    '/tests/e2e/',
    '/tests/.*\\.spec\\.ts$', // Exclude all .spec.ts files (Playwright)
    '/docs/.*\\.test\\.ts$' // Exclude documentation tests with syntax errors
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/', 
    '/e2e/', 
    '/tests/e2e/',
    '/__tests__/mocks/',
    '/docs/'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.stories.{ts,tsx}',
    '!**/node_modules/**'
  ]
};
