import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  mkdirSync,
  realpathSync,
  mkdtempSync,
  readFileSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const source = resolve(import.meta.dirname, '..');
export const workspace = resolve(source, '../../..');
/** Install real archives from lockfile-selected local packages, with no registry access. */
export function packConsumer(withImage = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'editorjs-fetch-')));
  const archiveDir = join(root, 'archives');
  mkdirSync(archiveDir);
  const dependencies = {};
  const packed = new Map();
  const env = {
    ...process.env,
    npm_config_cache: join(root, 'cache'),
    NODE_OPTIONS: '',
  };
  const pack = (directory) => {
    const manifest = JSON.parse(
      readFileSync(join(directory, 'package.json'), 'utf8'),
    );
    if (packed.has(manifest.name)) return;
    const [archive] = JSON.parse(
      execFileSync(
        'npm',
        [
          'pack',
          '--offline',
          '--ignore-scripts',
          '--json',
          '--pack-destination',
          archiveDir,
        ],
        { cwd: directory, env, encoding: 'utf8' },
      ),
    );
    packed.set(manifest.name, archive);
    dependencies[manifest.name] = `file:archives/${archive.filename}`;
    const require = createRequire(join(directory, 'package.json'));
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      if (packed.has(name)) continue;
      let location = dirname(require.resolve(name));
      while (
        !existsSync(join(location, 'package.json')) ||
        JSON.parse(readFileSync(join(location, 'package.json'), 'utf8'))
          .name !== name
      ) {
        const parent = dirname(location);
        if (parent === location) throw new Error(`Cannot locate ${name}`);
        location = parent;
      }
      pack(location);
    }
  };
  pack(resolve(source, '../core'));
  pack(source);
  if (withImage) {
    pack(resolve(source, '../tool-image'));
    const require = createRequire(
      join(workspace, 'packages/editorjs/tool-image/package.json'),
    );
    let editor = dirname(require.resolve('@editorjs/editorjs'));
    while (!existsSync(join(editor, 'package.json'))) editor = dirname(editor);
    pack(editor);
  }
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ private: true, type: 'module', dependencies }),
  );
  execFileSync(
    'npm',
    ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: root, env, stdio: 'pipe' },
  );
  return { root, packed };
}
