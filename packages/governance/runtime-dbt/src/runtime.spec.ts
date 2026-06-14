import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runDbtGovernanceRuntime } from './runtime.js';

const fixturesRoot = fileURLToPath(
  new URL('../../adapter-dbt/tests/fixtures/artifacts/', import.meta.url),
);

describe('runDbtGovernanceRuntime', () => {
  it('composes the public dbt adapter flow into a canonical workspace result', async () => {
    const result = await runDbtGovernanceRuntime({
      adapter: {
        paths: {
          projectDir: './simple-project',
        },
      },
      runtime: {
        workingDirectory: fixturesRoot,
        requestId: 'req-runtime-1',
        dryRun: true,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    expect(result.workspace).toMatchObject({
      id: 'dbt:simple_project',
      name: 'simple_project',
      root: path.join(fixturesRoot, 'simple-project'),
    });
    expect(result.workspace?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dbt.project.simple_project',
          kind: 'project',
          technology: 'dbt',
        }),
        expect.objectContaining({
          id: 'model.simple_project.hello_world',
          kind: 'resource',
          technology: 'dbt',
        }),
      ]),
    );
    expect(result.workspace?.extensions).toEqual(
      expect.objectContaining({
        'governance-extension:dbt': expect.any(Object),
      }),
    );
    expect(
      result.workspace?.nodes.find(
        (node) => node.id === 'model.simple_project.hello_world',
      )?.extensions,
    ).toEqual(
      expect.objectContaining({
        'governance-extension:dbt': expect.any(Object),
      }),
    );
    expect(result.metadata).toEqual({
      adapter: {
        adapter: 'dbt',
        paths: expect.objectContaining({
          projectDir: path.join(fixturesRoot, 'simple-project'),
          dbtProjectPath: path.join(
            fixturesRoot,
            'simple-project',
            'dbt_project.yml',
          ),
          manifestPath: path.join(
            fixturesRoot,
            'simple-project',
            'target',
            'manifest.json',
          ),
        }),
      },
      runtime: {
        requestId: 'req-runtime-1',
        workingDirectory: path.resolve(fixturesRoot),
        dryRun: true,
      },
    });
    expect(result.assessment).toBeUndefined();
  });

  it('returns a structured runtime error when dbt artifacts cannot be loaded', async () => {
    const result = await runDbtGovernanceRuntime({
      adapter: {
        paths: {
          projectDir: './missing-manifest',
        },
      },
      runtime: {
        workingDirectory: fixturesRoot,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected runtime result to fail.');
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
    expect(result.workspace).toBeUndefined();
    expect(result.capabilities).toEqual([]);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.missing_artifact_file',
          severity: 'error',
          inputField: 'paths.manifestPath',
        }),
      ]),
    );
  });

  it('returns a structured runtime error for invalid adapter option input', async () => {
    const result = await runDbtGovernanceRuntime({
      adapter: {
        paths: {},
        options: {
          validationMode: 'unsupported',
        },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected runtime result to fail.');
    }

    expect(result.error).toEqual({
      code: 'governance.runtime.invalid_input',
      stage: 'input',
      message: 'Runtime adapter input is invalid.',
      details: {
        inputField: 'adapter.options.validationMode',
      },
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'governance.runtime.invalid_input',
        inputField: 'options.validationMode',
      }),
    ]);
  });
});
