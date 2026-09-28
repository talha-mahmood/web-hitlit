// Deliberately narrow: this project's UI is React Native/Expo (no jest-expo
// preset installed), so this config only ever targets pure, framework-free
// TypeScript modules under src/lib/**/__tests__ — see mentionParser.test.ts.
// It is not set up to render React Native components.
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
  clearMocks: true,
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.jest.json" }],
  },
};
