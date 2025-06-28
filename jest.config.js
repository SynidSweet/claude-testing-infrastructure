/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
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
  testTimeout: 10000,
};