import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import * as jsonBoundaryModule from '../json-boundary.js';
import {
  readUtf8Stdin,
  runDbtGovernanceRuntimeExecutable,
} from './dbt-governance-runtime.js';

const fixturesRoot = fileURLToPath(
  new URL('../../../adapter-dbt/tests/fixtures/artifacts/', import.meta.url),
);

describe('dbt-governance-runtime executable boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads full UTF-8 stdin and writes a JSON success result to stdout', async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    stdin.end(
      JSON.stringify({
        adapter: {
          paths: {
            projectDir: './layered-project',
          },
        },
        runtime: {
          workingDirectory: fixturesRoot,
          requestId: 'req-bin-success',
          dryRun: true,
        },
      }),
    );

    const exitCode = await runDbtGovernanceRuntimeExecutable({
      stdin,
      stdout,
      stderr,
    });
    const stdoutJson = stdout.read()?.toString('utf8') ?? '';
    const result = JSON.parse(stdoutJson) as Awaited<
      ReturnType<typeof jsonBoundaryModule.runDbtGovernanceRuntimeFromJson>
    >;

    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdoutJson)).not.toThrow();
    expect(stdoutJson).toBe(JSON.stringify(JSON.parse(stdoutJson)));
    expect(result).toMatchObject({
      ok: true,
      runtime: {
        packageName: '@anarchitects/governance-runtime-dbt',
      },
      workspace: {
        id: 'dbt:layered_project',
        root: path.join(fixturesRoot, 'layered-project'),
      },
      metadata: {
        runtime: {
          requestId: 'req-bin-success',
          invocationId: 'req-bin-success',
          dryRun: true,
        },
      },
    });
    expect(stderr.read()?.toString('utf8') ?? '').toBe('');
  });

  it('returns a structured JSON runtime error for invalid JSON input', async () => {
    const { exitCode, stdout, stderr } = await runExecutableWithInput(
      '{"adapter":{"paths":}',
    );

    const result = JSON.parse(stdout);

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'governance.runtime.invalid_input',
        stage: 'input',
        message: 'Runtime input JSON is invalid.',
      },
    });
    expect(stderr).toBe('');
  });

  it('returns a structured JSON runtime error for missing adapter.paths', async () => {
    const { exitCode, stdout, stderr } = await runExecutableWithInput(
      JSON.stringify({
        adapter: {},
      }),
    );

    const result = JSON.parse(stdout);

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'governance.runtime.invalid_input',
        stage: 'input',
        details: {
          inputField: 'adapter.paths',
        },
      },
    });
    expect(stderr).toBe('');
  });

  it('represents unexpected process exceptions deterministically', async () => {
    vi.spyOn(
      jsonBoundaryModule,
      'runDbtGovernanceRuntimeFromJson',
    ).mockRejectedValue(new Error('process boom'));

    const { exitCode, stdout, stderr } = await runExecutableWithInput(
      JSON.stringify({
        adapter: {
          paths: {},
        },
      }),
    );

    const result = JSON.parse(stdout);

    expect(exitCode).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      runtime: {
        packageName: '@anarchitects/governance-runtime-dbt',
      },
      error: {
        code: 'governance.runtime.internal_error',
        stage: 'runtime',
        message: 'Unexpected process failure.',
        details: {
          operation: 'dbt-governance-runtime',
          reason: 'process boom',
        },
      },
    });
    expect(stderr).toBe('');
  });

  it('declares the package bin path for the built executable', async () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as {
      bin?: Record<string, string>;
    };

    expect(packageJson.bin).toEqual({
      'dbt-governance-runtime': './dist/bin/dbt-governance-runtime.js',
    });
  });

  it('reads the full stdin payload as UTF-8 text', async () => {
    const stdin = new PassThrough();

    const inputPromise = readUtf8Stdin(stdin);

    stdin.write(Buffer.from('{"adapter":'));
    stdin.write(Buffer.from('{"paths":{}}}'));
    stdin.end();

    await expect(inputPromise).resolves.toBe('{"adapter":{"paths":{}}}');
  });
});

async function runExecutableWithInput(input: string): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  stdin.end(input);

  const exitCode = await runDbtGovernanceRuntimeExecutable({
    stdin,
    stdout,
    stderr,
  });

  return {
    exitCode,
    stdout: stdout.read()?.toString('utf8') ?? '',
    stderr: stderr.read()?.toString('utf8') ?? '',
  };
}
