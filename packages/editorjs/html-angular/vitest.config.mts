import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@anarchitects/editorjs-html-angular',
    environment: 'jsdom',
    watch: false,
    globals: false,
    include: ['tests/**/*.spec.ts'],
    reporters: ['default'],
  },
});
