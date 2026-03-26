import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/packages/nest/angular-ssr',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'nest-angular-ssr',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [
        /^@angular\/ssr(?:\/.*)?$/,
        /^@nestjs\/common(?:\/.*)?$/,
        /^@nestjs\/core(?:\/.*)?$/,
        /^@nestjs\/platform-fastify(?:\/.*)?$/,
        /^fastify(?:\/.*)?$/,
        /^@fastify\/static(?:\/.*)?$/,
        /^node:.+$/,
        'tslib',
      ],
    },
  },
  test: {
    name: 'nest-angular-ssr',
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
