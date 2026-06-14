import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runDbtGovernanceRuntimeFromJson } from './json-boundary.js';
import * as runtimeModule from './runtime.js';

const fixturesRoot = fileURLToPath(
  new URL('../../adapter-dbt/tests/fixtures/artifacts/', import.meta.url),
);

describe('runDbtGovernanceRuntimeFromJson', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes a successful runtime result from valid JSON input', async () => {
    const resultJson = await runDbtGovernanceRuntimeFromJson(
      JSON.stringify({
        adapter: {
          paths: {
            projectDir: './layered-project',
          },
        },
        runtime: {
          workingDirectory: fixturesRoot,
          requestId: 'req-json-success',
          dryRun: true,
        },
      }),
    );

    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof runtimeModule.runDbtGovernanceRuntime>
    >;

    expect(result.ok).toBe(true);
    expect(result.runtime).toMatchObject({
      id: 'governance-runtime:dbt',
      packageName: '@anarchitects/governance-runtime-dbt',
    });
    expect(result.workspace).toMatchObject({
      id: 'dbt:layered_project',
      root: path.join(fixturesRoot, 'layered-project'),
    });
    expect(result.metadata?.runtime).toMatchObject({
      requestId: 'req-json-success',
      invocationId: 'req-json-success',
      dryRun: true,
    });
  });

  it('returns a structured JSON error result for invalid JSON input', async () => {
    const resultJson = await runDbtGovernanceRuntimeFromJson(
      '{"adapter":{"paths":}',
    );
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof runtimeModule.runDbtGovernanceRuntime>
    >;

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected invalid JSON input to fail.');
    }

    expect(result.error).toEqual({
      code: 'governance.runtime.invalid_input',
      stage: 'input',
      message: 'Runtime input JSON is invalid.',
      details: {
        format: 'json',
        reason: expect.any(String),
      },
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.capabilities).toEqual([]);
    expect(result.metadata?.runtime).toMatchObject({
      packageName: '@anarchitects/governance-runtime-dbt',
      generatedAt: expect.any(String),
    });
  });

  it('returns a structured JSON error result for missing runtime input sections', async () => {
    const resultJson = await runDbtGovernanceRuntimeFromJson(
      JSON.stringify({
        runtime: {
          requestId: 'req-json-invalid',
        },
      }),
    );
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof runtimeModule.runDbtGovernanceRuntime>
    >;

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected missing adapter input to fail.');
    }

    expect(result.error).toEqual({
      code: 'governance.runtime.invalid_input',
      stage: 'input',
      message: 'Runtime input is missing or invalid.',
      details: {
        inputField: 'adapter',
      },
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'governance.runtime.invalid_input',
        message: 'Runtime input must include an adapter object.',
        details: {
          inputField: 'adapter',
        },
      }),
    ]);
    expect(result.metadata?.runtime).toMatchObject({
      requestId: 'req-json-invalid',
      invocationId: 'req-json-invalid',
    });
  });

  it('propagates known runtime failures as structured JSON', async () => {
    const resultJson = await runDbtGovernanceRuntimeFromJson(
      JSON.stringify({
        adapter: {
          paths: {
            projectDir: './missing-manifest',
          },
        },
        runtime: {
          workingDirectory: fixturesRoot,
        },
      }),
    );
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof runtimeModule.runDbtGovernanceRuntime>
    >;

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected adapter failure to remain structured.');
    }

    expect(result.error).toEqual({
      code: 'governance.runtime.adapter_failed',
      stage: 'adapter',
      message: 'dbt artifacts could not be loaded.',
      details: {
        operation: 'loadDbtArtifacts',
        supported: false,
      },
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.missing_artifact_file',
        }),
      ]),
    );
  });

  it('returns a structured JSON error result for unexpected runtime exceptions', async () => {
    vi.spyOn(runtimeModule, 'runDbtGovernanceRuntime').mockRejectedValue(
      new Error('boom'),
    );

    const resultJson = await runDbtGovernanceRuntimeFromJson(
      JSON.stringify({
        adapter: {
          paths: {},
        },
      }),
    );
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof runtimeModule.runDbtGovernanceRuntime>
    >;

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected thrown runtime failure to be serialized.');
    }

    expect(result.error).toEqual({
      code: 'governance.runtime.internal_error',
      stage: 'runtime',
      message: 'Unexpected runtime failure.',
      details: {
        operation: 'runDbtGovernanceRuntime',
        reason: 'boom',
      },
    });
  });
});
