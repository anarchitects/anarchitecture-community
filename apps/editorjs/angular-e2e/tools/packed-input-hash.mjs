import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import {
  pathsFor,
  readSnapshot,
  sourceFingerprint,
} from './packed-artifacts.mjs';

const [mode, cell] = process.argv.slice(2);
const runId = process.env.EDITORJS_PACKED_RUN_ID;
const workspace = resolve(import.meta.dirname, '../../../..');
const { input } = pathsFor(workspace, runId, mode, cell);
const snapshot = await readSnapshot(input, runId, mode, cell);
assert.equal(
  snapshot.sources,
  await sourceFingerprint(workspace),
  'Prepare a new snapshot after package or fixture changes',
);
console.log(JSON.stringify(snapshot));
