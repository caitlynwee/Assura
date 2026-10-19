/** Jest configuration — ts-jest, Node environment, PGlite ESM support. */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // pglite ships ESM + a wasm asset; give DB-backed suites room to boot.
  testTimeout: 30000,
};
