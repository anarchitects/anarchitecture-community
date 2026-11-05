import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Compile the shipped core recipes; execute only public archived package APIs. */
export function persistenceContracts({ temporary, root, run, compiler, sha }) {
  const sources = new Map();
  const guides = {};
  for (const guide of ['persistence.md', 'service.md']) {
    const text = readFileSync(
      join(temporary, 'node_modules/@anarchitects/editorjs-core', guide),
      'utf8',
    );
    assert.equal(text, readFileSync(join(root, 'core', guide), 'utf8'));
    guides[guide] = sha(text);
    for (const [, name, code] of text.matchAll(
      /<!-- (?:persistence-example|service-neutral)-file: ([\w.-]+) -->\s*```(?:ts|js)\n([\s\S]*?)```/g,
    )) {
      assert(!sources.has(name), `Duplicate archived source: ${name}`);
      sources.set(name, code);
    }
  }
  assert.deepEqual(
    [...sources.keys()],
    [
      'persistence.ts',
      'memory-store.ts',
      'main.mjs',
      'evolution.ts',
      'migration-fixtures.ts',
      'migrate.mjs',
      'notebook-service.ts',
      'service-main.mjs',
    ],
  );
  const results = [];
  let rendered;
  for (const mode of ['NodeNext', 'Bundler']) {
    const directory = join(temporary, `persistence-${mode}`);
    mkdirSync(directory, { recursive: true });
    for (const [name, code] of sources)
      writeFileSync(join(directory, name), code);
    writeFileSync(
      join(directory, 'contracts.mjs'),
      readFileSync(join(root, 'html/tests/persistence-consumer.mjs')),
    );
    writeFileSync(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: mode === 'NodeNext' ? mode : 'ESNext',
          moduleResolution: mode,
          lib: ['ES2022'],
          types: [],
          strict: true,
          skipLibCheck: false,
          outDir: 'compiled',
        },
        files: [...sources.keys()].filter((name) => name.endsWith('.ts')),
      }),
    );
    run(process.execPath, [compiler, '-p', 'tsconfig.json'], directory);
    const output = run(
      process.execPath,
      ['--test', '--test-reporter=tap', 'contracts.mjs'],
      directory,
    );
    assert.match(output, /# fail 0\b/);
    const tests = Number(output.match(/# tests (\d+)/)?.[1]);
    assert(tests > 0, 'Missing persistence/rendering checks');
    const current = JSON.parse(
      readFileSync(join(directory, 'persistence-rendered.json'), 'utf8'),
    );
    assert.deepEqual(Object.keys(current).sort(), [
      'authored',
      'common',
      'customUnsafe',
      'decorative',
      'migrated',
      'unsafe',
    ]);
    if (rendered) assert.deepEqual(current, rendered);
    rendered = current;
    results.push({ mode, tests, status: 'passed' });
  }
  return { guides, results, rendered };
}

/** Inspect DOM from the actual saved/loaded Node results, not substitute fixtures. */
export async function persistenceDom(page, rendered) {
  await page.setContent(rendered.common);
  assert.deepEqual(
    await page.evaluate(() => ({
      heading: document.querySelector('h2')?.textContent,
      quote: document.querySelector('blockquote')?.textContent,
      attribution: document
        .querySelector('blockquote')
        ?.parentElement.querySelector('figcaption')?.textContent,
      start: document.querySelector('ol')?.start,
      type: document.querySelector('ol')?.type,
      nestedStart: document.querySelector('ol ol')?.start,
      nestedType: document.querySelector('ol ol')?.type,
      marker: document.querySelector('section aside mark')?.textContent,
      code: document.querySelector('pre code')?.textContent,
      alt: document.querySelector('img')?.alt,
      caption: document
        .querySelector('img')
        ?.parentElement.querySelector('figcaption')?.textContent,
      metadata: document.querySelector('img')?.hasAttribute('id'),
      active: document.querySelectorAll(
        'script, input, button, [contenteditable], [onerror]',
      ).length,
    })),
    {
      heading: 'Title',
      quote: 'Quotation',
      attribution: 'Attribution',
      start: 3,
      type: 'I',
      nestedStart: 2,
      nestedType: 'a',
      marker: 'Callout',
      code: '<script>literal & code</script>',
      alt: 'A "literal" <alt>',
      caption: 'Caption is not alt',
      metadata: false,
      active: 0,
    },
  );
  const accessibility = await page.locator('body').ariaSnapshot();
  assert.ok(accessibility.includes('[Completed]'));
  assert.ok(accessibility.includes('[Not completed]'));
  for (const [name, alt] of [
    ['decorative', ''],
    ['authored', 'A "literal" <alt>'],
  ]) {
    await page.setContent(rendered[name]);
    assert.equal(await page.locator('img').getAttribute('alt'), alt);
    assert.equal(
      await page.locator('figcaption').textContent(),
      'Caption is not alt',
    );
  }
  await page.setContent(rendered.migrated);
  assert.equal(
    await page.locator('section aside mark').textContent(),
    'reader',
  );
  for (const [name, text] of [
    ['unsafe', 'Visible'],
    ['customUnsafe', 'Safe'],
  ]) {
    await page.setContent(rendered[name]);
    assert.equal(await page.locator('body').textContent(), text);
    assert.equal(
      await page.locator('script,img,[onclick],[onerror]').count(),
      0,
    );
  }
  return { cases: Object.keys(rendered), status: 'passed' };
}
