// CI environment detection - inline to avoid TypeScript import issues
function isCIEnvironment() {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.TRAVIS ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL
  );
}

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testPathIgnorePatterns: [
    '/node_modules/',
    'tests/fixtures/.*\\.claude-testing/',
    ...(isCIEnvironment() ? ['tests/validation/ai-agents/'] : [])
  ],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@cli/(.*)$': '<rootDir>/src/cli/$1',
    '^@analyzers/(.*)$': '<rootDir>/src/analyzers/$1',
    '^@generators/(.*)$': '<rootDir>/src/generators/$1',
    '^@runners/(.*)$': '<rootDir>/src/runners/$1',
    '^@adapters/(.*)$': '<rootDir>/src/adapters/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  testTimeout: 10000
};