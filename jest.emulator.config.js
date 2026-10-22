// Emulator-backed tests (rules and Firestore data paths). These need the
// Firebase emulators, so run them with `npm run test:emulator`, which starts
// auth/firestore/storage for the demo-sbhra project and then runs this config.
// The default `npm test` (jest-expo) ignores __emulator__.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__emulator__'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  globals: { __DEV__: true },
  testTimeout: 30000,
};
