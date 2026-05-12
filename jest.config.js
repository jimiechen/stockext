/** Jest configuration for StockExt project */

module.exports = {
  testEnvironment: "jsdom",
  testMatch: [
    "**/tests/**/*.js",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
