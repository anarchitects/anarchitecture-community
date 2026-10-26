import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { commandRunner } from './packed-process.mjs';
import { parallelism, phasesFor, targetFor } from './packed-phases.mjs';

const workspace = resolve(import.meta.dirname, '../../../..');
const matrix = JSON.parse(
  await readFile(
    new URL('./compatibility-matrix.json', import.meta.url),
    'utf8',
  ),
);
const [selected = 'all', mode = 'csr', concurrency] = process.argv.slice(2);
assert(['csr', 'ssr'].includes(mode));
const cells = selected === 'all' ? Object.keys(matrix) : [selected];
assert(
  cells.every((cell) => Object.hasOwn(matrix, cell)),
  'Unknown compatibility cell',
);
const runId = randomUUID();
const runner = commandRunner({});
const targets = (phase) =>
  cells
    .flatMap((cell) =>
      (phase === 'prepare' ? ['prepare'] : phasesFor(mode)).map((atom) =>
        targetFor(mode, cell, atom),
      ),
    )
    .join(',');
console.log(`Packed run: ${runId}`);
try {
  let validationError;
  for (const phase of ['prepare', 'validate']) {
    try {
      await runner.run(
        'yarn',
        [
          'nx',
          'run-many',
          '--projects=editorjs-angular-e2e',
          `--targets=${targets(phase)}`,
          `--parallel=${parallelism(concurrency)}`,
          `--runId=${runId}`,
          '--outputStyle=stream',
        ],
        workspace,
        false,
        {
          EDITORJS_PACKED_RUN_ID: runId,
          NX_CLOUD_DISTRIBUTED_EXECUTION: 'false',
          NX_CACHE_FAILURES: 'true',
        },
        60 * 60_000,
      );
    } catch (error) {
      if (phase === 'prepare' || runner.interrupted) throw error;
      validationError = error;
    }
  }
  await runner.run(
    process.execPath,
    [
      'apps/editorjs/angular-e2e/tools/packed-results.mjs',
      runId,
      mode,
      selected,
    ],
    workspace,
  );
  if (validationError) throw validationError;
  console.log(`Packed evidence: dist/editorjs-packed-results/${runId}/${mode}`);
} finally {
  runner.dispose();
}
