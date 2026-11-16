import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

const yaml = createRequire(import.meta.resolve('nx/package.json'))('yaml');
const job = yaml.parse(
  readFileSync(
    new URL('../../.github/workflows/release-prepare.yml', import.meta.url),
    'utf8',
  ),
).jobs.prepare;

test('preparation runs each line in its own checkout and uploads the same output directory', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'release checkouts-')));
  try {
    const checkouts = job.steps.filter((step) =>
      step.uses?.startsWith('actions/checkout'),
    );
    const controller = resolve(root, checkouts[0].with.path ?? '.');
    const candidate = resolve(root, checkouts[1].with.path);
    assert.notEqual(controller, candidate);
    assert.equal(
      dirname(controller),
      root,
      'Controller must be a sibling checkout',
    );
    assert.equal(
      dirname(candidate),
      root,
      'Candidate must be a sibling checkout',
    );
    assert.equal(checkouts[0].with.ref, '${{ github.sha }}');
    assert.equal(checkouts[0].with['persist-credentials'], false);
    mkdirSync(join(controller, 'tools/release'), { recursive: true });
    mkdirSync(candidate, { recursive: true });
    writeFileSync(
      join(controller, 'tools/release/prepare.mjs'),
      'controller entry',
    );
    writeFileSync(join(controller, 'yarn.lock'), 'controller lock');
    const workingDirectory = resolve(
      root,
      job.defaults.run['working-directory'],
    );
    assert.equal(workingDirectory, controller);
    const cache = job.steps.find((step) =>
      step.uses?.startsWith('actions/setup-node'),
    );
    assert.equal(
      readFileSync(resolve(root, cache.with['cache-dependency-path']), 'utf8'),
      'controller lock',
    );
    const install = job.steps.find((step) =>
      step.name?.startsWith('Install maintenance'),
    );
    assert.equal(resolve(root, install['working-directory']), candidate);

    // Execute the actual workflow shell, replacing build tools with argument
    // recorders. This catches cwd, quoting and output-path regressions without
    // contacting GitHub, building packages or invoking a release controller.
    const bin = join(root, 'bin');
    mkdirSync(bin);
    for (const command of ['node', 'yarn']) {
      writeFileSync(
        join(bin, command),
        '#!/bin/sh\nprintf "%s\\n" "$PWD" "$@" > "$TRACE"\n',
        { mode: 0o755 },
      );
    }
    const freeze = job.steps.find((step) => step.id === 'freeze');
    const upload = resolve(
      root,
      job.steps.find((step) => step.id === 'record').with.path,
    );
    for (const line of ['standard', 'nest12', 'nest11']) {
      const trace = join(root, `${line}.trace`);
      execFileSync('bash', ['-e', '-o', 'pipefail', '-c', freeze.run], {
        cwd: workingDirectory,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          RELEASE_LINE: line,
          TRACE: trace,
        },
      });
      const [cwd, ...args] = readFileSync(trace, 'utf8').trim().split('\n');
      assert.equal(cwd, line === 'nest11' ? candidate : controller);
      assert.equal(
        resolve(cwd, args.find((arg) => arg.startsWith('--out=')).slice(6)),
        upload,
      );
      assert.equal(relative(controller, upload).startsWith('../'), true);
      if (line === 'nest11') {
        assert.equal(
          readFileSync(resolve(cwd, args[0]), 'utf8'),
          'controller entry',
        );
        assert.deepEqual(args.slice(1, 3), ['freeze', '--line=nest11']);
      } else {
        assert.deepEqual(args.slice(0, 3), [
          'nx',
          'run',
          '@anarchitecture-community/source:freeze-release-record',
        ]);
        assert.equal(args.includes('--line=nest12'), line === 'nest12');
      }
    }
    assert.throws(() =>
      execFileSync('bash', ['-e', '-o', 'pipefail', '-c', freeze.run], {
        cwd: workingDirectory,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          RELEASE_LINE: 'unknown',
        },
        stdio: 'pipe',
      }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
