import '@angular/compiler';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
export const api = createRequire(import.meta.url)(
  resolve(
    import.meta.dirname,
    '../dist/fesm2022/anarchitects-editorjs-html-angular.mjs',
  ),
) as typeof import('../src/index.js');
export const paragraph = (text: string) => ({
  blocks: [{ type: 'paragraph', data: { text } }],
});
