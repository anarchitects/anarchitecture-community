import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@anarchitects/better-auth-typeorm-adapter-postgres',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/postgres/**/*.spec.ts'],
    reporters: ['default'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    coverage: {
      reportsDirectory: './test-output/vitest/coverage-postgres',
      provider: 'v8',
    },
  },
});
