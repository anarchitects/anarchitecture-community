import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { chmodSync } from 'node:fs';

function governanceRuntimeDbtBinPlugin() {
  return {
    name: 'governance-runtime-dbt-bin',
    renderChunk(code: string, chunk: { fileName: string }) {
      if (
        chunk.fileName !== 'bin/dbt-governance-runtime.js' ||
        code.startsWith('#!/usr/bin/env node')
      ) {
        return null;
      }

      return {
        code: `#!/usr/bin/env node\n${code}`,
        map: null,
      };
    },
    writeBundle(
      options: { dir?: string },
      bundle: Record<string, { fileName: string }>,
    ) {
      const chunk = bundle['bin/dbt-governance-runtime.js'];

      if (!chunk || !options.dir) {
        return;
      }

      chmodSync(path.join(options.dir, chunk.fileName), 0o755);
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/packages/governance/runtime-dbt',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
    governanceRuntimeDbtBinPlugin(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: {
        index: path.join(import.meta.dirname, 'src/index.ts'),
        'bin/dbt-governance-runtime': path.join(
          import.meta.dirname,
          'src/bin/dbt-governance-runtime.ts',
        ),
      },
      name: 'governance-runtime-dbt',
      fileName: (_format, entryName) => `${entryName}.js`,
      formats: ['es' as const],
    },
    rolldownOptions: {
      external: [
        /^node:.+$/,
        'tslib',
        '@anarchitects/governance-adapter-dbt',
        '@anarchitects/governance-core',
        '@anarchitects/governance-extension-dbt',
      ],
    },
  },
  test: {
    name: '@anarchitects/governance-runtime-dbt',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
