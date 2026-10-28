import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/packages/editorjs/upload-fetch',
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
      entry: { browser: 'src/browser.ts' },
      name: 'editorjs-upload-fetch',
      fileName: (_format, entry) => `${entry}.js`,
      formats: ['es' as const],
    },
    rolldownOptions: {
      // Keep imports visible to the isolated package smoke test.
      external: [/^[^./]/],
    },
  },
  test: {
    name: '@anarchitects/editorjs-upload-fetch',
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
