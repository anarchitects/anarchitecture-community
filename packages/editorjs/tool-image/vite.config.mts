import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/packages/editorjs/tool-image',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    target: 'es2022',
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: { index: 'src/index.ts', browser: 'src/browser.ts' },
      name: 'editorjs-tool-image',
      fileName: (_format, entry) => `${entry}.js`,
      formats: ['es' as const],
    },
    rolldownOptions: {
      // Keep imports visible to the isolated package smoke test.
      external: [/^[^./]/],
    },
  },
  test: {
    name: '@anarchitects/editorjs-tool-image',
    watch: false,
    globals: false,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
