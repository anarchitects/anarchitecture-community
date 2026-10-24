import { execFileSync } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(
  new URL('../../packages/governance/dbt-package/', import.meta.url),
);
const output = join(root, 'dist');

// Match the source inventory used by Nx rather than copying ignored dbt state.
// Include new, untracked source files so local builds work before git add.
const files = execFileSync(
  'git',
  [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '--deduplicate',
    '-z',
  ],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) {
  const destination = join(output, file);
  await mkdir(dirname(destination), { recursive: true });
  try {
    await cp(join(root, file), destination, { verbatimSymlinks: true });
  } catch (error) {
    // Git still lists tracked files deleted in the working tree.
    if (error.code !== 'ENOENT') throw error;
  }
}
console.log(`Assembled dbt source package at ${output}`);
