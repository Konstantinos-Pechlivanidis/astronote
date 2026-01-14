export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Unit tests only. Integration tests require a migrated database and should be run
  // explicitly via `npm run test:integration`.
  testMatch: ['**/tests/unit/**/*.test.js'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/scripts/**',
    '!**/prisma/**',
  ],
};

