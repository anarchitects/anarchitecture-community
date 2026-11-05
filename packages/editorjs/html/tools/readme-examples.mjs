import assert from 'node:assert/strict';

export const headlessRecipes = [
  'quick-start.mts',
  'preview.mts',
  'list-image.mts',
  'configuration.mts',
  'alias.mts',
  'custom.mts',
];

// Validation tooling only: read the installed README before writing any files.
export function readmeExamples(readme, required) {
  const examples = new Map();
  const matches = readme.matchAll(
    /<!-- example: ([\w.-]+) -->\s*```ts\r?\n([\s\S]*?)```/g,
  );
  for (const [, name, source] of matches) {
    assert(!examples.has(name), `Duplicate README recipe: ${name}`);
    assert(source.trim(), `Empty README recipe: ${name}`);
    examples.set(name, source);
  }
  assert.deepEqual(
    [...examples.keys()].sort(),
    [...required].sort(),
    'Missing or unexpected README recipe',
  );
  assert.equal(
    [...readme.matchAll(/^```ts\r?$/gm)].length,
    examples.size,
    'Unmarked README TypeScript recipe',
  );
  return examples;
}
