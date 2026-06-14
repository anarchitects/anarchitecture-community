import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runDbtGovernanceRuntime } from './runtime.js';

const fixturesRoot = fileURLToPath(
  new URL('../../adapter-dbt/tests/fixtures/artifacts/', import.meta.url),
);

describe('runDbtGovernanceRuntime', () => {
  it('returns a canonical workspace with nodes, relations, and runtime metadata for the layered fixture', async () => {
    const result = await runLayeredProjectFixture();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    expect(result.workspace).toMatchObject({
      id: 'dbt:layered_project',
      name: 'layered_project',
      root: path.join(fixturesRoot, 'layered-project'),
    });
    expect(result.workspace?.nodes.length).toBeGreaterThan(0);
    expect(result.workspace?.relations.length).toBeGreaterThan(0);
    expect(result.workspace?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dbt.project.layered_project',
          kind: 'project',
        }),
        expect.objectContaining({
          id: 'model.layered_project.fct_orders',
          kind: 'resource',
        }),
      ]),
    );
    expect(result.workspace?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNodeId: 'model.layered_project.fct_orders',
          targetNodeId: 'model.layered_project.int_orders_enriched',
          kind: 'dependency',
        }),
      ]),
    );
    expect(result.metadata?.runtime).toEqual({
      packageName: '@anarchitects/governance-runtime-dbt',
      id: 'governance-runtime:dbt',
      version: '0.0.1',
      adapterPackageName: '@anarchitects/governance-adapter-dbt',
      extensionPackageName: '@anarchitects/governance-extension-dbt',
      generatedAt: expect.any(String),
      invocationId: 'req-extension-1',
      requestId: 'req-extension-1',
      workingDirectory: path.resolve(fixturesRoot),
      dryRun: true,
    });
  });

  it('preserves extension contributions for the layered fixture runtime flow', async () => {
    const result = await runLayeredProjectFixture();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    expect(result.extensionRegistrationDiagnostics).toEqual([]);
    expect(result.extensionDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DBT_DOMAIN_UNRESOLVED',
        }),
      ]),
    );
    expect(result.metadata?.extension).toEqual({
      registeredExtensionIds: ['governance-extension:dbt'],
      sourcePluginIds: ['governance-extension:dbt'],
      rulePackCount: 1,
      signalProviderCount: 1,
      metricProviderCount: 1,
      enricherCount: 0,
      diagnosticProviderCount: 1,
      recommendationProviderCount: 1,
    });
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
  });

  it('assembles a governance assessment for the layered fixture', async () => {
    const result = await runLayeredProjectFixture();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    expect(result.assessment).toBeDefined();
    expect(result.assessment).toMatchObject({
      workspace: expect.objectContaining({
        id: 'dbt:layered_project',
        name: 'layered_project',
      }),
      profile: 'dbt',
      violations: expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'dbt/no-disallowed-layer-dependency',
          sourcePluginId: 'governance-extension:dbt',
        }),
      ]),
      signals: expect.arrayContaining([
        expect.objectContaining({
          source: 'extension',
          sourcePluginId: 'governance-extension:dbt',
        }),
      ]),
      measurements: expect.arrayContaining([
        expect.objectContaining({
          id: 'dbt-model-count',
          sourcePluginId: 'governance-extension:dbt',
        }),
      ]),
      recommendations: expect.any(Array),
      health: expect.objectContaining({
        score: expect.any(Number),
        status: expect.any(String),
      }),
      extensions: expect.objectContaining({
        'governance-extension:dbt': expect.any(Object),
      }),
      metadata: expect.objectContaining({
        runtime: expect.objectContaining({
          packageName: '@anarchitects/governance-runtime-dbt',
          id: 'governance-runtime:dbt',
          version: '0.0.1',
          adapterPackageName: '@anarchitects/governance-adapter-dbt',
          extensionPackageName: '@anarchitects/governance-extension-dbt',
          invocationId: 'req-extension-1',
        }),
      }),
    });
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

  it('returns a structured runtime error for a malformed manifest fixture', async () => {
    const result = await runDbtGovernanceRuntime({
      adapter: {
        paths: {
          projectDir: './malformed-manifest',
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
          code: 'governance.dbt_adapter.malformed_manifest_json',
          severity: 'error',
          inputField: 'paths.manifestPath',
        }),
      ]),
    );
  });
});

async function runLayeredProjectFixture() {
  return runDbtGovernanceRuntime({
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
}
