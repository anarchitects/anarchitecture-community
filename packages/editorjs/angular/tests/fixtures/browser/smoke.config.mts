import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      '@anarchitects/editorjs-angular': resolve(
        import.meta.dirname,
        '../../../../../../dist/packages/editorjs/angular/fesm2022/anarchitects-editorjs-angular.mjs',
      ),
    },
  },
  server: { host: '127.0.0.1', port: 4317, strictPort: true },
});
