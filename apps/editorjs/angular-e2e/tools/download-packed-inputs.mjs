import assert from 'node:assert/strict';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { commandRunner } from './packed-process.mjs';
import { pathsFor, readSnapshot } from './packed-artifacts.mjs';

const {
  GITHUB_REPOSITORY: repository,
  EDITORJS_PACKED_ARTIFACT_ID: id,
  EDITORJS_PACKED_RUN_ID: runId,
  GH_TOKEN: token,
} = process.env;
assert(
  /^[\w.-]+\/[\w.-]+$/.test(repository ?? ''),
  'Missing artifact repository',
);
assert(/^\d+$/.test(id ?? ''), 'Missing packed input artifact ID');
assert(token, 'Missing read-only Actions artifact token');
const workspace = resolve(import.meta.dirname, '../../../..');
const destination = join(workspace, 'dist/editorjs-packed-inputs');
const scratch = await mkdtemp(join(tmpdir(), 'editorjs-packed-download-'));
const runner = commandRunner({});
try {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/actions/artifacts/${id}/zip`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(10 * 60_000),
    },
  );
  assert(
    response.ok,
    `Input artifact download failed: HTTP ${response.status}`,
  );
  const archive = join(scratch, 'inputs.zip');
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
  await mkdir(destination, { recursive: true });
  await runner.run('unzip', ['-q', archive, '-d', destination], workspace);
  const matrix = JSON.parse(
    await readFile(
      new URL('./compatibility-matrix.json', import.meta.url),
      'utf8',
    ),
  );
  for (const mode of ['csr', 'ssr'])
    for (const cell of Object.keys(matrix)) {
      const { input } = pathsFor(workspace, runId, mode, cell);
      await readSnapshot(input, runId, mode, cell);
    }
} finally {
  runner.dispose();
  await rm(scratch, { recursive: true, force: true });
}
