module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@supabase/supabase-js$': '<rootDir>/__mocks__/@supabase/supabase-js',
    '^@/components/admin/(.*)$': '<rootDir>/__mocks__/components/admin/$1'
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@supabase|uuid)/)'
  ]
};
