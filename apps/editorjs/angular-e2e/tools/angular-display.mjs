import assert from 'node:assert/strict';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Add a private display observer; archived save/load/Forms logic stays intact. */
export async function prepareAngularDisplay(root) {
  await copyFile(
    new URL('./composed-display.txt', import.meta.url),
    join(root, 'examples/composed-display.ts'),
  );
  for (const [file, path, expression, external] of [
    [
      'src/app/editor-card.ts',
      '../../examples/composed-display',
      '[snapshot]="saved()"',
      'src/app/editor-card.html',
    ],
    [
      'src/app/forms-card.ts',
      '../../examples/composed-display',
      '[snapshot]="captured()"',
      'src/app/forms-card.html',
    ],
    [
      'src/upload/upload-editor.ts',
      '../../examples/composed-display',
      '[snapshot]="saved()"',
    ],
    [
      'src/upload/forms-upload-editor.ts',
      '../../examples/composed-display',
      '[snapshot]="saved()"',
    ],
    ['examples/custom-editor.ts', './composed-display', '[snapshot]="saved()"'],
    ['examples/custom-form.ts', './composed-display', '[snapshot]="saved()"'],
    [
      'examples/notebook/notebook-editor.ts',
      '../composed-display',
      '[loaded]="record()?.document"',
    ],
    [
      'examples/notebook/notebook-form.ts',
      '../composed-display',
      '[loaded]="record()?.document"',
    ],
  ]) {
    let source = await readFile(join(root, file), 'utf8');
    assert.equal(
      source.split('imports: [').length,
      2,
      `One component import list: ${file}`,
    );
    source =
      `import { PackedDisplay } from '${path}.js';\n` +
      source.replace('imports: [', 'imports: [PackedDisplay, ');
    const element = `<packed-display ${expression} />`;
    if (external) {
      const template = await readFile(join(root, external), 'utf8');
      assert.equal(template.split('</section>').length, 2);
      await writeFile(
        join(root, external),
        template.replace('</section>', `${element}</section>`),
      );
    } else {
      const anchor = file.includes('notebook')
        ? '<pre aria-label="Acknowledged record">'
        : file.includes('upload')
          ? '<pre data-testid="saved">'
          : '<pre aria-label="Saved document">';
      assert.equal(source.split(anchor).length, 2, `One saved output: ${file}`);
      source = source.replace(anchor, element + anchor);
    }
    await writeFile(join(root, file), source);
  }
  // Real served asset: data URLs are deliberately rejected by the renderer.
  const file = join(root, 'src/image/definition.ts');
  const source = await readFile(file, 'utf8');
  const start = source.indexOf('export const asset =');
  const end = source.indexOf('export const imageData');
  assert(start >= 0 && end > start);
  await writeFile(
    file,
    source.slice(0, start) +
      "export const asset = '/packed-image.svg';\n" +
      source.slice(end),
  );
  await writeFile(
    join(root, 'public/packed-image.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="red"/></svg>',
  );
}

export async function prepareAngularDisplaySsr(root) {
  const host = join(root, 'apps/editorjs/angular-host/src/ssr');
  await copyFile(
    new URL('./display-page.txt', import.meta.url),
    join(host, 'display-page.ts'),
  );
  const config = join(host, 'app.config.ts');
  let source = await readFile(config, 'utf8');
  // The host's upload override currently puts the authoring provider in the
  // public entry. Keep the override, but make its owning route lazy as well.
  const start = source.indexOf("  {\n    path: 'upload',");
  const end = source.indexOf("  {\n    path: 'tools',", start);
  assert(start >= 0 && end > start, 'Expected the upload route boundary');
  const upload = source.slice(start, end).replace("path: 'upload'", "path: ''");
  await writeFile(
    join(host, 'display-upload-routes.ts'),
    `import { provideEditorJsTools } from '@anarchitects/editorjs-angular';\nimport type { Routes } from '@angular/router';\nexport const routes: Routes = [${upload}];\n`,
  );
  source =
    source.slice(0, start) +
    "  { path: 'upload', loadChildren: () => import('./display-upload-routes').then(m => m.routes) },\n" +
    source.slice(end);
  const providerImport =
    "import { provideEditorJsTools } from '@anarchitects/editorjs-angular';\n";
  assert(source.includes(providerImport));
  source = source
    .replace(providerImport, '')
    .replace(
      'const routes: Routes = [',
      "const routes: Routes = [\n  { path: 'display', loadComponent: () => import('./display-page').then(m => m.DisplayPage) },",
    );
  await writeFile(config, source);
  const app = join(host, 'app.ts');
  const template = await readFile(app, 'utf8');
  assert(template.includes('<nav aria-label="Fixture routes">'));
  await writeFile(
    app,
    template.replace(
      '<nav aria-label="Fixture routes">',
      '<nav aria-label="Fixture routes"><a routerLink="/display">Stored display</a>',
    ),
  );
}
