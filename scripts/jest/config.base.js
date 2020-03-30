// const dynamoDb = require("@shelf/jest-dynamodb/dynamodb-preset");


module.exports = {
    rootDir: process.cwd(),
    testRegex: `packages/.*/.*test.js$`,
    collectCoverageFrom: [`packages/**/src/**/*.js`],
    coverageReporters: ["lcov", "html"],
    testEnvironment: "node",
    preset: "@shelf/jest-dynamodb"

    // ...dynamoDb
};
