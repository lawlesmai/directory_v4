const { createJestConfig } = require('next/dist/config/default-test-config');

const nextJestConfig = createJestConfig({
  dir: './'
});

// Custom RBAC test configuration
const customJestConfig = {
  ...nextJestConfig,
  displayName: 'RBAC Components',
  testMatch: [
    '<rootDir>/__tests__/components/auth/rbac/**/*.test.{ts,tsx}'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/components/auth/rbac/setup.ts'
  ],
  collectCoverageFrom: [
    'components/auth/rbac/**/*.{ts,tsx}',
    '!components/auth/rbac/**/*.d.ts',
    '!components/auth/rbac/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'components/auth/rbac/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  testEnvironment: 'jsdom',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/__tests__/components/auth/rbac/setup.ts'
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(@testing-library|lucide-react|framer-motion)/)'
  ]
};

module.exports = customJestConfig;