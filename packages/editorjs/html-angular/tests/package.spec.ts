import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, expectTypeOf } from 'vitest';
import type { InputSignal, OutputEmitterRef, Signal } from '@angular/core';
import type {
  EditorJsHtmlComponent,
  HtmlRendererOptions,
  HtmlRenderResult,
  HtmlDiagnostic,
} from '../src/index.js';
const root = resolve(
  import.meta.dirname,
  '../../../../dist/packages/editorjs/html-angular',
);
describe('published Angular boundary', () => {
  it('exposes signal inputs, readonly results and a typed output', () => {
    expectTypeOf<EditorJsHtmlComponent['data']>().toEqualTypeOf<
      InputSignal<unknown>
    >();
    expectTypeOf<EditorJsHtmlComponent['options']>().toEqualTypeOf<
      InputSignal<HtmlRendererOptions | undefined>
    >();
    expectTypeOf<EditorJsHtmlComponent['result']>().toEqualTypeOf<
      Signal<HtmlRenderResult>
    >();
    expectTypeOf<EditorJsHtmlComponent['resultChange']>().toEqualTypeOf<
      OutputEmitterRef<HtmlRenderResult>
    >();
    expectTypeOf<HtmlRenderResult['diagnostics']>().toEqualTypeOf<
      readonly HtmlDiagnostic[]
    >();
    type Custom = EditorJsHtmlComponent<{ code: { text: string } }>;
    expectTypeOf<Custom['options']>().toEqualTypeOf<
      InputSignal<HtmlRendererOptions<{ code: { text: string } }> | undefined>
    >();
  });
  it('ships an APF entry with no authoring, Forms or platform dependency', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8'),
    );
    expect(manifest.version).toBe('0.0.1');
    expect(manifest.dependencies).toEqual({
      '@anarchitects/editorjs-html': '^0.0.1',
      tslib: '^2.3.0',
    });
    expect(manifest.peerDependencies).toEqual({ '@angular/core': '22.1.4' });
    expect(manifest.sideEffects).toBe(false);
    expect(manifest.exports['.'].default).toBe(
      './fesm2022/anarchitects-editorjs-html-angular.mjs',
    );
    const js = readFileSync(
      resolve(root, manifest.exports['.'].default),
      'utf8',
    );
    expect(js).not.toMatch(
      /bypassSecurityTrust|innerHTML\s*=|@angular\/forms|@editorjs\/|provideClientHydration|document\.|window\./,
    );
    expect(js).toContain('ɵɵngDeclareComponent');
  });
});
