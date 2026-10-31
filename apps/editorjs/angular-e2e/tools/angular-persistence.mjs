import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function prepareAngularPersistence({ root, workspace }) {
  const directory = join(root, 'examples/notebook');
  await mkdir(join(directory, 'custom'), { recursive: true });
  const sources = new Map();
  for (const [name, guide] of [
    ['angular', 'persistence.md'],
    ['core', 'persistence.md'],
    ['core', 'service.md'],
    ['core', 'custom-tools.md'],
  ]) {
    const text = await readFile(
      join(root, `node_modules/@anarchitects/editorjs-${name}`, guide),
      'utf8',
    );
    assert.equal(
      text,
      await readFile(join(workspace, 'packages/editorjs', name, guide), 'utf8'),
    );
    for (const [, file, code] of text.matchAll(
      /<!-- (?:persistence-angular|persistence-example|service-neutral|neutral-example|browser-example)-file: ([\w.-]+) -->\s*```(?:ts|js)\n([\s\S]*?)```/g,
    )) {
      assert(!sources.has(file), `Duplicate archived source: ${file}`);
      sources.set(file, code);
    }
  }
  for (const file of [
    'persistence.ts',
    'evolution.ts',
    'notebook-service.ts',
    'notebook-browser.ts',
    'notebook-editor.ts',
    'notebook-form.ts',
  ]) {
    assert(sources.has(file), `Missing archived source: ${file}`);
    await writeFile(join(directory, file), sources.get(file));
  }
  for (const file of [
    'callout-data.ts',
    'callout-tool.ts',
    'editorial-data.ts',
    'flag-tune.ts',
  ]) {
    assert(sources.has(file), `Missing archived tool: ${file}`);
    await writeFile(join(directory, 'custom', file), sources.get(file));
  }
  await cp(
    join(root, 'src/main.ts'),
    join(root, 'src/main.before-notebook.ts'),
  );
  await writeFile(
    join(root, 'src/main.ts'),
    `
    import { bootstrapApplication } from '@angular/platform-browser';
    const mode = new URL(location.href).searchParams.get('notebook');
    if (mode === 'forms') {
      const { NotebookForm, NOTEBOOK_REVIEW } = await import('../examples/notebook/notebook-form');
      document.querySelector('aa-root')!.replaceWith(document.createElement('app-notebook-form'));
      const review = async (document: unknown, signal: AbortSignal) => {
        const response = await fetch('/notebook-review', { method: 'POST', signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(document) });
        if (!response.ok) throw new Error('Review unavailable');
        const accepted: unknown = await response.json();
        if (typeof accepted !== 'boolean') throw new Error('Invalid review response');
        return accepted;
      };
      bootstrapApplication(NotebookForm, {
        providers: new URL(location.href).searchParams.has('review') ? [{ provide: NOTEBOOK_REVIEW, useValue: review }] : [],
      }).catch(console.error);
    } else if (mode === 'editor') {
      const { NotebookEditor } = await import('../examples/notebook/notebook-editor');
      document.querySelector('aa-root')!.replaceWith(document.createElement('app-notebook-editor'));
      bootstrapApplication(NotebookEditor).catch(console.error);
    } else await import('./main.before-notebook');
  `,
  );
}

export async function checkAngularPersistenceImports({ root, node, run }) {
  await run(
    node,
    [
      '--input-type=module',
      '--eval',
      `
    import assert from 'node:assert/strict';
    import '@angular/compiler';
    import '@angular/core';
    import '@angular/common';
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'localStorage'])
      Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('Browser access: ' + name); } });
    assert.throws(() => import.meta.resolve('@angular/forms'), { code: 'ERR_MODULE_NOT_FOUND' });
    await import('./out-tsc/examples/notebook/notebook-editor.js');
    await import('./out-tsc/examples/notebook/notebook-browser.js');
    console.log('Archived notebook module evaluation is inert and Forms-absent');
  `,
    ],
    root,
  );
}

export async function prepareAngularPersistenceSsr(root) {
  // prepareAngularCustomSsr already copied the complete extracted examples tree.
  const host = join(root, 'apps/editorjs/angular-host/src/ssr');
  const config = join(host, 'app.config.ts');
  const text = await readFile(config, 'utf8');
  assert(text.includes('const routes: Routes = ['));
  await writeFile(
    config,
    text.replace(
      'const routes: Routes = [',
      `const routes: Routes = [
    { path: 'notebook', loadComponent: () => import('../../../../../examples/notebook/notebook-editor').then(m => m.NotebookEditor) },
    { path: 'notebook-forms', loadComponent: () => import('../../../../../examples/notebook/notebook-form').then(m => m.NotebookForm) },
  `,
    ),
  );
  const app = join(host, 'app.ts');
  await writeFile(
    app,
    (await readFile(app, 'utf8')).replace(
      '<nav aria-label="Fixture routes">',
      '<nav aria-label="Fixture routes"><a routerLink="/notebook">Notebook</a><a routerLink="/notebook-forms">Notebook Forms</a>',
    ),
  );
}
