import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runDbtGovernanceRuntime } from './runtime.js';

const fixturesRoot = fileURLToPath(
  new URL('../../adapter-dbt/tests/fixtures/artifacts/', import.meta.url),
);

describe('runDbtGovernanceRuntime', () => {
  it('composes adapter loading and dbt extension execution into a runtime result', async () => {
    const result = await runDbtGovernanceRuntime({
      profile: {
        document: {
          rules: {
            'dbt/no-disallowed-layer-dependency': {
              options: {
                allowedUpstreamByLayer: {
                  staging: [],
                  intermediate: [],
                  marts: ['marts'],
                },
              },
            },
          },
        },
      },
      adapter: {
        paths: {
          projectDir: './layered-project',
        },
      },
      extension: {
        options: {
          createdAt: '2026-06-14T12:00:00.000Z',
        },
      },
      runtime: {
        workingDirectory: fixturesRoot,
        requestId: 'req-extension-1',
        dryRun: true,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    expect(result.workspace).toMatchObject({
      id: 'dbt:layered_project',
      name: 'layered_project',
      root: path.join(fixturesRoot, 'layered-project'),
    });
    expect(result.extensionRegistrationDiagnostics).toEqual([]);
    expect(result.extensionDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DBT_DOMAIN_UNRESOLVED',
        }),
      ]),
    );
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'extension',
          sourcePluginId: 'governance-extension:dbt',
        }),
      ]),
    );
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'dbt/no-disallowed-layer-dependency',
          sourcePluginId: 'governance-extension:dbt',
        }),
      ]),
    );
    expect(result.measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dbt-model-count',
          sourcePluginId: 'governance-extension:dbt',
        }),
      ]),
    );
    expect(result.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining(
            'capability:governance:extension:dbt:diagnostic-provider:',
          ),
        }),
        expect.objectContaining({
          id: expect.stringContaining(
            'capability:governance:extension:dbt:recommendation-provider:',
          ),
        }),
      ]),
    );
    expect(result.metadata).toEqual({
      profile: {
        name: 'dbt',
      },
      adapter: {
        adapter: 'dbt',
        paths: expect.objectContaining({
          projectDir: path.join(fixturesRoot, 'layered-project'),
        }),
      },
      extension: {
        registeredExtensionIds: ['governance-extension:dbt'],
        sourcePluginIds: ['governance-extension:dbt'],
        rulePackCount: 1,
        signalProviderCount: 1,
        metricProviderCount: 1,
        enricherCount: 0,
        diagnosticProviderCount: 1,
        recommendationProviderCount: 1,
      },
      runtime: {
        requestId: 'req-extension-1',
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
