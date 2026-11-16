import assert from 'node:assert/strict';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function buildMetadata(output) {
  try {
    return JSON.parse(await readFile(join(output, 'stats.json'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Angular 22.2 separates browser/server metafiles. Keep both originals and
  // expose their unchanged output records to the existing graph assertions.
  const sources = ['browser-stats.json', 'server-stats.json'];
  const [browser, server] = await Promise.all(
    sources.map(async (file) =>
      JSON.parse(await readFile(join(output, file), 'utf8')),
    ),
  );
  for (const name of Object.keys(browser.outputs))
    assert(
      !(name in server.outputs),
      `Ambiguous browser/server output: ${name}`,
    );
  const combined = {
    sources,
    inputs: { ...browser.inputs, ...server.inputs },
    outputs: { ...browser.outputs, ...server.outputs },
  };
  // Multiple validation suites can share this build. Publish a complete file.
  const temporary = join(output, `stats-${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify(combined, null, 2) + '\n');
  await rename(temporary, join(output, 'stats.json'));
  return combined;
}
