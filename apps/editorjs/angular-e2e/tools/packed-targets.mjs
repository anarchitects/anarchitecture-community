import { readFile } from 'node:fs/promises';
import { phasesFor, targetFor } from './packed-phases.mjs';

const matrix = JSON.parse(
  await readFile(
    new URL('./compatibility-matrix.json', import.meta.url),
    'utf8',
  ),
);
// Request every atom explicitly so the coordinator restores every report,
// including intermediate build outputs and failed-task diagnostics.
console.log(
  ['csr', 'ssr']
    .flatMap((mode) =>
      Object.keys(matrix).flatMap((cell) =>
        phasesFor(mode, cell).map((phase) => targetFor(mode, cell, phase)),
      ),
    )
    .join(','),
);
