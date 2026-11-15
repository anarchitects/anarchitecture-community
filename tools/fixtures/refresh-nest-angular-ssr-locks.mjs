import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertFastifyTree,
  command,
  environmentManifest,
  json,
  readJson,
} from './nest-angular-ssr-locked-support.mjs';

const matrix = await readJson(
  new URL('./nest-angular-ssr-locked-matrix.json', import.meta.url),
);
const selected = process.argv[2] ?? 'all';
if (selected !== 'all' && !Object.hasOwn(matrix, selected))
  throw new Error(`Unknown cell ${selected}`);
for (const [name, versions] of Object.entries(matrix)) {
  if (selected !== 'all' && name !== selected) continue;
  const root = await mkdtemp(join(tmpdir(), 'ssr-lock-'));
  try {
    const manifest = environmentManifest(name, versions);
    await writeFile(join(root, 'package.json'), json(manifest));
    await command(
      'npm',
      ['install', '--package-lock-only', '--ignore-scripts'],
      root,
    );
    const lock = await readJson(join(root, 'package-lock.json'));
    assertFastifyTree(lock);
    const destination = new URL(
      `./nest-angular-ssr-locks/${name}/`,
      import.meta.url,
    );
    await mkdir(destination, { recursive: true });
    await writeFile(new URL('package.json', destination), json(manifest));
    await writeFile(
      new URL('package-lock.json', destination),
      await readFile(join(root, 'package-lock.json')),
    );
    console.log(`Frozen ${name}: ${Object.keys(lock.packages).length} entries`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
