import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@anarchitects/editorjs-angular',
    environment: 'node',
    watch: false,
    globals: false,
    include: ['tests/**/*.spec.ts'],
    reporters: ['default'],
  },
});
