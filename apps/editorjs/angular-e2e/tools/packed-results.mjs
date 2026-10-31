import assert from 'node:assert/strict';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  pathsFor,
  readSnapshot,
  sourceFingerprint,
  verifyArtifacts,
} from './packed-artifacts.mjs';
import { phasesFor } from './packed-phases.mjs';

const [runId, selectedMode = 'all', selectedCell = 'all'] =
  process.argv.slice(2);
const workspace = resolve(import.meta.dirname, '../../../..');
const matrix = JSON.parse(
  await readFile(
    new URL('./compatibility-matrix.json', import.meta.url),
    'utf8',
  ),
);
const modes = selectedMode === 'all' ? ['csr', 'ssr'] : [selectedMode];
const cells = selectedCell === 'all' ? Object.keys(matrix) : [selectedCell];
let failed = false;
for (const mode of modes)
  for (const cell of cells) {
    const { input, output } = pathsFor(workspace, runId, mode, cell, 'collect');
    const errors = [];
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    let snapshot;
    try {
      snapshot = await readSnapshot(input, runId, mode, cell);
      assert.equal(
        snapshot.sources,
        await sourceFingerprint(workspace),
        'Prepare a new snapshot after package or fixture changes',
      );
      await cp(join(input, 'evidence'), join(output, 'preparation'), {
        recursive: true,
      });
    } catch (error) {
      errors.push(`Preparation: ${error}`);
    }
    // Inspect every required atom even after failures. Nx skips dependants of
    // failed builds; absent records must never be interpreted as passing checks.
    for (const phase of phasesFor(mode, cell)) {
      try {
        const { output: phaseOutput } = pathsFor(
          workspace,
          runId,
          mode,
          cell,
          phase,
        );
        await cp(phaseOutput, join(output, 'phases', phase), {
          recursive: true,
        });
        const result = JSON.parse(
          await readFile(join(phaseOutput, 'result.json'), 'utf8'),
        );
        assert.equal(result.runId, runId);
        assert.equal(result.mode, mode);
        assert.equal(result.cell, cell);
        assert.equal(result.phase, phase);
        assert.equal(result.snapshot, snapshot?.sha256);
        assert.equal(result.status, 'passed', result.error);
        await verifyArtifacts(join(output, 'phases', phase), result.artifacts);
      } catch (error) {
        errors.push(`${phase}: ${error}`);
      }
    }
    const result = {
      runId,
      mode,
      cell,
      phase: 'collect',
      status: errors.length ? 'failed' : 'passed',
      errors,
    };
    await writeFile(
      join(output, 'result.json'),
      JSON.stringify(result, null, 2) + '\n',
    );
    if (errors.length) {
      failed = true;
      console.error(
        `Packed ${mode} ${cell}: failed or missing evidence:\n${errors.join('\n')}`,
      );
    } else {
      console.log(`Packed ${mode} ${cell}: passed`);
    }
  }
process.exitCode = failed ? 1 : 0;
