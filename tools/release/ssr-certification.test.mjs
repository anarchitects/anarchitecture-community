import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { certifySsrArchive } from './ssr-certification.mjs';
import { sha256 } from './execution.mjs';

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'ssr-release-test-'));
  const bytes = Buffer.from('final retained archive');
  const pkg = {
    project: 'nest-angular-ssr',
    files: [{ name: 'candidate.tgz', sha256: sha256(bytes) }],
  };
  mkdirSync(join(directory, pkg.project));
  writeFileSync(join(directory, pkg.project, pkg.files[0].name), bytes);
  try {
    run({ directory, pkg });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function report(hash) {
  const direct = ['install', 'dependency-tree', 'runtime-audit'];
  for (const mode of ['cjs', 'esm'])
    direct.push(
      ...[
        'declarations',
        'build',
        'exports-security',
        'module-http',
        'async-http',
        'explicit-http',
      ].map((check) => `${mode}-${check}`),
    );
  const split = [
    'install',
    'dependency-tree',
    'runtime-audit',
    'split-build',
    'split-output-boundary',
    'split-http-hydration',
  ];
  return {
    status: 'passed',
    archive: { source: 'external-verified-archive', sha256: hash },
    cells: [
      ['N12-current', direct],
      ['N12-split', split],
    ].map(([name, checks]) => ({
      name,
      status: 'passed',
      checks: checks.map((name) => ({ name, status: 'passed' })),
    })),
  };
}

test('final SSR archive is selected by hash and all retained certification evidence is recorded', () => {
  fixture(({ directory, pkg }) => {
    const evidence = certifySsrArchive(
      pkg,
      directory,
      (executable, args, options) => {
        assert.equal(executable, 'yarn');
        assert.ok(args.includes('--cell=nest12'));
        assert.ok(args.includes(`--archive-sha256=${pkg.files[0].sha256}`));
        assert.ok(
          args.includes(
            `--archive=${join(directory, pkg.project, 'candidate.tgz')}`,
          ),
        );
        assert.equal(options.env.NX_NO_CLOUD, 'true');
        const output = args
          .find((a) => a.startsWith('--output-directory='))
          .split('=')[1];
        mkdirSync(output);
        writeFileSync(
          join(output, 'result.json'),
          JSON.stringify(report(pkg.files[0].sha256)),
        );
        mkdirSync(join(output, 'N12-current'));
        writeFileSync(
          join(output, 'N12-current', 'runtime-audit.json'),
          '{"ok":true}',
        );
      },
    );
    assert.equal(evidence.length, 2);
    assert.ok(evidence.every((e) => e.sha256.length === 64 && e.size > 0));
  });
});

for (const [name, mutate] of [
  [
    'different bytes',
    (r) => {
      r.archive.sha256 = '0'.repeat(64);
    },
  ],
  [
    'repacked candidate',
    (r) => {
      r.archive.source = 'working-tree-pack';
    },
  ],
  [
    'failed aggregate',
    (r) => {
      r.status = 'failed';
    },
  ],
  [
    'missing split cell',
    (r) => {
      r.cells.pop();
    },
  ],
  [
    'missing hydration check',
    (r) => {
      r.cells[1].checks.pop();
    },
  ],
  [
    'failed security check',
    (r) => {
      r.cells[0].checks.find((c) => c.name === 'cjs-exports-security').status =
        'failed';
    },
  ],
])
  test(`release certification rejects ${name}`, () => {
    fixture(({ directory, pkg }) => {
      assert.throws(() =>
        certifySsrArchive(pkg, directory, (_, args) => {
          const output = args
            .find((a) => a.startsWith('--output-directory='))
            .split('=')[1];
          mkdirSync(output);
          const result = report(pkg.files[0].sha256);
          mutate(result);
          writeFileSync(join(output, 'result.json'), JSON.stringify(result));
        }),
      );
    });
  });

test('changed archive fails before starting a consumer process', () => {
  fixture(({ directory, pkg }) => {
    writeFileSync(join(directory, pkg.project, 'candidate.tgz'), 'changed');
    assert.throws(
      () =>
        certifySsrArchive(pkg, directory, () => {
          assert.fail('must not start');
        }),
      /SSR archive changed/,
    );
  });
});
