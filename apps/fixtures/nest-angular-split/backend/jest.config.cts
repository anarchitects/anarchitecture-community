module.exports = {
  displayName: 'nest-angular-split-backend',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
    '^.+/node_modules/content-disposition/.+\\.js$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest-esm.json',
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!content-disposition/)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
