module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/'
  },
  transform: {
    '^.+\.(ts|tsx)$': 'ts-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!@faker-js/faker)/'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/tests/e2e/'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    }
  }
};
