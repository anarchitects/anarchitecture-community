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
    // Nest 12 uses ESM and import.meta; SWC bridges both for CommonJS Jest.
    '^.+/node_modules/(?:@nestjs|content-disposition)/.+\\.js$': [
      '@swc/jest',
      {
        swcrc: false,
        jsc: { target: 'es2022' },
      },
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(?:@nestjs|content-disposition)/)',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
