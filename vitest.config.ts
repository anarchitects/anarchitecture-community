import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      './packages/better-auth/typeorm-adapter/vite.config.mts',
      './packages/governance/adapter-dbt/vite.config.mts',
      './packages/governance/adapter-typescript/vite.config.mts',
      './packages/governance/cli/vite.config.mts',
      './packages/governance/core/vite.config.mts',
      './packages/governance/extension-dbt/vite.config.mts',
      './packages/governance/extension-typescript/vite.config.mts',
      './packages/governance/runtime-dbt/vite.config.mts',
      './packages/nest/angular-ssr/vite.config.mts',
    ],
  },
});
