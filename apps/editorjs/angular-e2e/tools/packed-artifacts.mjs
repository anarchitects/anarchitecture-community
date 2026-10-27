import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export function pathsFor(workspace, runId, mode, cell, phase) {
  assert(
    /^[a-zA-Z0-9-]{1,80}$/.test(runId ?? ''),
    'Supply a unique --runId (letters, digits, hyphens)',
  );
  assert(['csr', 'ssr'].includes(mode), 'Unknown consumer mode');
  assert(
    /^angular22-(minimum|reference|current)$/.test(cell),
    'Unknown compatibility cell',
  );
  if (phase) assert(/^[a-z-]+$/.test(phase), 'Unknown phase');
  return {
    input: join(workspace, 'dist/editorjs-packed-inputs', runId, mode, cell),
    output: join(
      workspace,
      'dist/editorjs-packed-results',
      runId,
      mode,
      cell,
      phase ?? '',
    ),
  };
}

export function platformIdentity() {
  return {
    os: process.platform,
    arch: process.arch,
    libc: process.report.getReport().header.glibcVersionRuntime ?? null,
  };
}

export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function readSnapshot(input, runId, mode, cell) {
  const snapshot = JSON.parse(
    await readFile(join(input, 'snapshot.json'), 'utf8'),
  );
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.runId, runId);
  assert.equal(snapshot.mode, mode);
  assert.equal(snapshot.cell, cell);
  assert.deepEqual(
    snapshot.platform,
    platformIdentity(),
    'Consumer snapshots require matching OS, architecture and libc',
  );
  assert.equal(
    await sha256(join(input, 'consumer.tar.gz')),
    snapshot.sha256,
    'Consumer snapshot was modified',
  );
  return snapshot;
}

/** Reject a snapshot prepared from different package/fixture sources. */
export async function sourceFingerprint(workspace) {
  const paths = [
    'yarn.lock',
    'package.json',
    'tsconfig.base.json',
    'packages/editorjs/core/src',
    'packages/editorjs/core/package.json',
    'packages/editorjs/core/README.md',
    'packages/editorjs/core/tsconfig.json',
    'packages/editorjs/core/tsconfig.lib.json',
    'packages/editorjs/core/vite.config.mts',
    'packages/editorjs/tool-paragraph/src',
    'packages/editorjs/tool-paragraph/package.json',
    'packages/editorjs/tool-paragraph/README.md',
    'packages/editorjs/tool-paragraph/LICENSE',
    'packages/editorjs/tool-paragraph/tsconfig.json',
    'packages/editorjs/tool-paragraph/tsconfig.lib.json',
    'packages/editorjs/tool-paragraph/vite.config.mts',
    'packages/editorjs/tool-header/src',
    'packages/editorjs/tool-header/package.json',
    'packages/editorjs/tool-header/README.md',
    'packages/editorjs/tool-header/LICENSE',
    'packages/editorjs/tool-header/tsconfig.json',
    'packages/editorjs/tool-header/tsconfig.lib.json',
    'packages/editorjs/tool-header/vite.config.mts',
    'packages/editorjs/tool-list/src',
    'packages/editorjs/tool-list/package.json',
    'packages/editorjs/tool-list/README.md',
    'packages/editorjs/tool-list/LICENSE',
    'packages/editorjs/tool-list/tsconfig.json',
    'packages/editorjs/tool-list/tsconfig.lib.json',
    'packages/editorjs/tool-list/vite.config.mts',
    'packages/editorjs/angular/src',
    'packages/editorjs/angular/forms',
    'packages/editorjs/angular/package.json',
    'packages/editorjs/angular/README.md',
    'packages/editorjs/angular/project.json',
    'packages/editorjs/angular/ng-package.json',
    'packages/editorjs/angular/tsconfig.json',
    'packages/editorjs/angular/tsconfig.lib.json',
    'packages/editorjs/angular/tsconfig.lib.prod.json',
    'packages/editorjs/angular/tests/fixtures',
    'packages/editorjs/angular/tests/forms-interop.spec.ts',
    'apps/editorjs/angular-host/src',
    'apps/editorjs/angular-host/public',
    'apps/editorjs/angular-host/project.json',
    'apps/editorjs/angular-e2e/tools/prepare-packed.mjs',
    'apps/editorjs/angular-e2e/tools/portable-consumer.mjs',
    'apps/editorjs/angular-e2e/tools/packed-ssr.mjs',
    'apps/editorjs/angular-e2e/tools/readme-ssr.mjs',
    'apps/editorjs/angular-e2e/tools/compatibility-matrix.json',
    'apps/editorjs/angular-e2e/tools/serve-packed.mjs',
  ];
  const hash = createHash('sha256');
  async function add(path) {
    let entries;
    try {
      entries = await readdir(join(workspace, path), { withFileTypes: true });
    } catch (error) {
      if (error.code !== 'ENOTDIR') throw error;
      hash
        .update(path)
        .update('\0')
        .update(await readFile(join(workspace, path)))
        .update('\0');
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name)))
      await add(`${path}/${entry.name}`);
  }
  for (const path of paths) await add(path);
  return hash.digest('hex');
}
