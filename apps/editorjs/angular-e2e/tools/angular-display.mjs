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
