import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { chmodSync } from 'node:fs';

function governanceCliBinPlugin() {
  return {
    name: 'governance-cli-bin',
    renderChunk(code: string, chunk: { fileName: string }) {
      if (
        chunk.fileName !== 'bin/agov.js' ||
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
      const chunk = bundle['bin/agov.js'];

      if (!chunk || !options.dir) {
        return;
      }

      chmodSync(path.join(options.dir, chunk.fileName), 0o755);
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/packages/governance/cli',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
    governanceCliBinPlugin(),
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
        'bin/agov': path.join(import.meta.dirname, 'src/bin/agov.ts'),
      },
      name: 'governance-cli',
      fileName: (_format, entryName) => `${entryName}.js`,
      formats: ['es' as const],
    },
    rolldownOptions: {
      external: [/^node:.+$/, 'tslib', '@anarchitects/governance-core', 'yaml'],
    },
  },
  test: {
    name: '@anarchitects/governance-cli',
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
