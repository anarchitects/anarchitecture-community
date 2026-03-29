import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@anarchitects/better-auth-typeorm-adapter-better-auth',
    watch: false,
    globals: true,
    environment: 'node',
    server: {
      deps: {
        inline: ['better-auth', 'pg'],
      },
    },
    include: ['tests/better-auth/**/*.spec.ts'],
    reporters: ['default'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      reportsDirectory: './test-output/vitest/coverage-better-auth',
      provider: 'v8',
    },
  },
});
