import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { sha256 } from './execution.mjs';

// The release gate before packing proves readiness. This gate proves the final
// retained bytes after the last build/pack, without repacking or publication.
export function certifySsrArchive(pkg, directory, execute = execFileSync) {
  assert.equal(pkg.files.length, 1, 'SSR release must contain one npm archive');
  const archive = resolve(directory, pkg.project, pkg.files[0].name);
  const expected = pkg.files[0].sha256;
  assert.equal(sha256(readFileSync(archive)), expected, 'SSR archive changed');
  const relative = 'evidence/nest-angular-ssr-certification';
  mkdirSync(resolve(directory, 'evidence'), { recursive: true });
  const output = resolve(directory, relative);
  execute(
    'yarn',
    [
      'nx',
      'run',
      'nest-angular-ssr:validate-locked-consumers',
      '--cell=nest12',
      `--archive=${archive}`,
      `--archive-sha256=${expected}`,
      `--output-directory=${output}`,
    ],
    {
      stdio: 'inherit',
      timeout: 1_200_000,
      env: { ...process.env, NX_NO_CLOUD: 'true', NX_DAEMON: 'false' },
    },
  );
  const report = JSON.parse(readFileSync(join(output, 'result.json'), 'utf8'));
  assert.equal(report.status, 'passed', 'SSR certification did not pass');
  assert.equal(report.archive?.source, 'external-verified-archive');
  assert.equal(
    report.archive.sha256,
    expected,
    'SSR certification tested different bytes',
  );
  assert.deepEqual(report.cells.map((c) => c.name).sort(), [
    'N12-current',
    'N12-split',
  ]);
  for (const cell of report.cells) {
    assert.equal(cell.status, 'passed', cell.name);
    const names = ['install', 'dependency-tree', 'runtime-audit'];
    if (cell.name === 'N12-current')
      for (const mode of ['cjs', 'esm'])
        names.push(
          ...[
            'declarations',
            'build',
            'exports-security',
            'module-http',
            'async-http',
            'explicit-http',
          ].map((check) => `${mode}-${check}`),
        );
    else
      names.push(
        'split-build',
        'split-output-boundary',
        'split-http-hydration',
      );
    for (const name of names)
      assert.equal(
        cell.checks.find((c) => c.name === name)?.status,
        'passed',
        `Missing SSR certification: ${cell.name}/${name}`,
      );
  }
  const evidence = [];
  const visit = (path) => {
    for (const entry of readdirSync(resolve(directory, path), {
      withFileTypes: true,
    })) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) visit(child);
      else {
        assert.ok(entry.isFile(), 'Unexpected certification evidence link');
        // The archive is already retained and hashed in the release package.
        if (entry.name.endsWith('.tgz')) continue;
        const bytes = readFileSync(resolve(directory, child));
        evidence.push({
          project: pkg.project,
          kind: 'locked SSR certification',
          path: child,
          sha256: sha256(bytes),
          size: bytes.length,
        });
      }
    }
  };
  visit(relative);
  return evidence.sort((a, b) => a.path.localeCompare(b.path));
}
