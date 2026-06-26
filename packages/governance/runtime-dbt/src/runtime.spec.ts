import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DbtGovernanceRuntimeInput } from './contracts.js';
import { runDbtGovernanceRuntime } from './runtime.js';

const fixturesRoot = fileURLToPath(
  new URL('../../adapter-dbt/tests/fixtures/artifacts/', import.meta.url),
);
const runtimePackageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

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
          id: 'model.layered_project.fct_orders',
          kind: 'resource',
        }),
      ]),
    );
    expect(
      result.workspace?.nodes.some(
        (node) => node.id === 'dbt.project.layered_project',
      ),
    ).toBe(false);
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
      version: runtimePackageJson.version,
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
      enricherCount: 1,
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

  it('disables core layer-boundary by default in dbt runtime while keeping the dbt layer rule active', async () => {
    const result = await runFixture(
      'valid-project',
      buildLayerOverlapProfile(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    const ruleIds = getViolationRuleIds(result);

    expect(ruleIds).toContain('dbt/no-disallowed-layer-dependency');
    expect(ruleIds).not.toContain('layer-boundary');
  });

  it('disables core ownership and documentation rules by default in dbt runtime', async () => {
    const result = await runFixture('valid-project', {
      name: 'dbt',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    const ruleIds = getViolationRuleIds(result);

    expect(ruleIds).not.toContain('ownership-presence');
    expect(ruleIds).not.toContain('documentation-gap');
  });

  it('lets explicit user layer-boundary config override dbt runtime defaults', async () => {
    const result = await runFixture('valid-project', {
      ...buildLayerOverlapProfile(),
      rules: {
        ...(buildLayerOverlapProfile().rules as Record<string, unknown>),
        'layer-boundary': {
          severity: 'warning',
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    const ruleIds = getViolationRuleIds(result);

    expect(ruleIds).toContain('dbt/no-disallowed-layer-dependency');
    expect(ruleIds).toContain('layer-boundary');
  });

  it('lets explicit user ownership and documentation config override dbt runtime defaults', async () => {
    const result = await runFixture('valid-project', {
      name: 'dbt',
      rules: {
        'ownership-presence': {
          severity: 'warning',
        },
        'documentation-gap': {
          severity: 'warning',
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    const ruleIds = getViolationRuleIds(result);

    expect(ruleIds).toContain('ownership-presence');
    expect(ruleIds).toContain('documentation-gap');
  });

  it('loads governance profile settings from profile.path and overlays explicit inline fields', async () => {
    const tempRoot = mkdtempSync(
      path.join(tmpdir(), 'governance-runtime-dbt-profile-'),
    );
    const profilePath = path.join(tempRoot, 'governance.profile.yml');

    writeFileSync(
      profilePath,
      [
        'name: file-backed-profile',
        'layers:',
        '  - raw',
        '  - staging',
        '  - intermediate',
        '  - marts',
        'rules:',
        '  dbt/no-disallowed-layer-dependency:',
        '    options:',
        '      allowedUpstreamByLayer:',
        '        raw:',
        '          - raw',
        '        staging:',
        '          - raw',
        '          - staging',
        '        intermediate:',
        '          - staging',
        '          - intermediate',
        '        marts:',
        '          - intermediate',
        '          - marts',
      ].join('\n'),
      'utf8',
    );

    try {
      const result = await runFixtureWithProfileConfig('valid-project', {
        path: profilePath,
        format: 'yaml',
        document: {
          name: 'dbt-demo',
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('Expected runtime result to succeed.');
      }

      expect(result.metadata?.profile).toEqual({
        name: 'dbt-demo',
      });
      expect(getViolationRuleIds(result)).not.toContain(
        'dbt/no-disallowed-layer-dependency',
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('returns a structured profile error for an unreadable explicit profile.path', async () => {
    const result = await runFixtureWithProfileConfig('valid-project', {
      path: path.join(fixturesRoot, 'missing.profile.yml'),
      format: 'yaml',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected invalid profile path to fail.');
    }

    expect(result.error).toEqual({
      code: 'governance.runtime.profile_invalid',
      stage: 'profile',
      message: 'Governance profile input is invalid.',
      details: {
        inputField: 'profile.path',
        path: path.join(fixturesRoot, 'missing.profile.yml'),
        reason: expect.any(String),
      },
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.runtime.profile_invalid',
          message: expect.stringContaining('could not be read'),
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
          version: runtimePackageJson.version,
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

  it('keeps metadata-rich runtime health out of the artificially low critical band', async () => {
    const result = await runFixture('metadata-rich', {
      name: 'dbt',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    expect(result.assessment?.health.status).toBe('warning');
    expect(result.assessment?.health.grade).toBe('C');
    expect(result.assessment?.health.score).toBeGreaterThanOrEqual(70);
  });

  it('flows companion metadata through assessment workspace and extension outputs', async () => {
    const result = await runCompanionConventionFixture();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    const assessmentModel = findAssessmentNode(result, 'model.demo.fct_orders');
    const assessmentSource = findAssessmentNode(
      result,
      'source.demo.raw.orders',
    );

    expect(assessmentModel).toMatchObject({
      extensions: {
        'governance-extension:dbt': expect.objectContaining({
          data: expect.objectContaining({
            resourceType: 'model',
            resource: expect.objectContaining({
              meta: {
                anarchitects: {
                  governance: {
                    layer: 'marts',
                    domain: 'sales',
                    owner: {
                      team: 'analytics',
                    },
                    criticality: 'high',
                    publicInterface: true,
                    crossDomainApproved: false,
                  },
                },
              },
            }),
          }),
        }),
      },
    });
    expect(assessmentSource).toMatchObject({
      extensions: {
        'governance-extension:dbt': expect.objectContaining({
          data: expect.objectContaining({
            resourceType: 'source',
            resource: expect.objectContaining({
              meta: {
                anarchitects: {
                  governance: {
                    layer: 'staging',
                    domain: 'sales',
                    owner: {
                      team: 'analytics',
                    },
                    criticality: 'medium',
                    publicInterface: false,
                    crossDomainApproved: true,
                  },
                },
              },
            }),
          }),
        }),
      },
    });

    expect(getNodeDiagnosticCodes(result, 'model.demo.fct_orders')).not.toEqual(
      expect.arrayContaining([
        'DBT_LAYER_UNRESOLVED',
        'DBT_DOMAIN_UNRESOLVED',
        'DBT_OWNER_MISSING',
      ]),
    );
    expect(
      getNodeDiagnosticCodes(result, 'source.demo.raw.orders'),
    ).not.toEqual(
      expect.arrayContaining([
        'DBT_LAYER_UNRESOLVED',
        'DBT_DOMAIN_UNRESOLVED',
        'DBT_OWNER_MISSING',
        'DBT_PUBLIC_MARKER_INVALID',
      ]),
    );
    expect(
      getNodeRecommendationCodes(result, 'model.demo.fct_orders'),
    ).not.toEqual(expect.arrayContaining(['ADD_OWNER']));

    expect(
      hasNodeSignal(result, 'model.demo.fct_orders', 'DBT_LAYER_RESOLVED', {
        sourceLayer: 'marts',
      }),
    ).toBe(true);
    expect(
      hasNodeSignal(result, 'model.demo.fct_orders', 'DBT_DOMAIN_RESOLVED', {
        sourceDomain: 'sales',
      }),
    ).toBe(true);
    expect(
      hasNodeSignal(result, 'model.demo.fct_orders', 'DBT_OWNER_RESOLVED', {
        sourceOwner: 'analytics',
      }),
    ).toBe(true);
    expect(
      hasNodeSignal(result, 'source.demo.raw.orders', 'DBT_LAYER_RESOLVED', {
        sourceLayer: 'staging',
      }),
    ).toBe(true);
    expect(
      hasNodeSignal(result, 'source.demo.raw.orders', 'DBT_DOMAIN_RESOLVED', {
        sourceDomain: 'sales',
      }),
    ).toBe(true);
    expect(
      hasNodeSignal(result, 'source.demo.raw.orders', 'DBT_OWNER_RESOLVED', {
        sourceOwner: 'analytics',
      }),
    ).toBe(true);
    expect(
      hasNodeSignal(result, 'model.demo.fct_orders', 'DBT_CONTRACT_ENABLED', {
        contractPresent: true,
      }),
    ).toBe(true);
    expect(
      hasNodeSignal(
        result,
        'model.demo.fct_orders',
        'DBT_CONTRACT_MISSING_FOR_PUBLIC_MODEL_CANDIDATE',
      ),
    ).toBe(false);
    expect(
      hasNodeSignal(
        result,
        'model.demo.fct_orders',
        'DBT_CRITICAL_MODEL_WITHOUT_TESTS_CANDIDATE',
        {
          criticality: 'high',
          testsPresent: false,
        },
      ),
    ).toBe(true);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'dbt/critical-models-require-tests',
          subjectId: 'model.demo.fct_orders',
        }),
      ]),
    );
  });

  it('reflects companion cross-domain approval metadata in runtime rule output', async () => {
    const result = await runCompanionConventionFixture();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected runtime result to succeed.');
    }

    expect(
      result.signals?.filter(
        (signal) =>
          signal.metadata?.code === 'DBT_CROSS_DOMAIN_DEPENDENCY_DETECTED',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relationId:
            'dbt:lineage:model.demo.fct_orders->model.demo.dim_customers',
        }),
        expect.objectContaining({
          relationId:
            'dbt:lineage:model.demo.fct_shipments->model.demo.dim_customers',
        }),
      ]),
    );

    const approvalViolationSubjects = (result.violations ?? [])
      .filter(
        (violation) =>
          violation.ruleId === 'dbt/cross-domain-dependencies-require-approval',
      )
      .map((violation) => violation.subjectId);

    expect(approvalViolationSubjects).toContain(
      'dbt:lineage:model.demo.fct_orders->model.demo.dim_customers',
    );
    expect(approvalViolationSubjects).not.toContain(
      'dbt:lineage:model.demo.fct_shipments->model.demo.dim_customers',
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

function getViolationRuleIds(
  result: Awaited<ReturnType<typeof runDbtGovernanceRuntime>>,
) {
  return [...new Set(result.violations?.map((violation) => violation.ruleId))];
}

async function runFixture(
  fixtureName: string,
  profileDocument?: Record<string, unknown>,
  requestId = `req-${fixtureName}`,
) {
  return runFixtureWithProfileConfig(
    fixtureName,
    profileDocument ? { document: profileDocument } : undefined,
    requestId,
  );
}

async function runFixtureWithProfileConfig(
  fixtureName: string,
  profile?: DbtGovernanceRuntimeInput['profile'],
  requestId = `req-${fixtureName}`,
) {
  return runDbtGovernanceRuntime({
    ...(profile ? { profile } : {}),
    adapter: {
      paths: {
        projectDir: `./${fixtureName}`,
      },
    },
    extension: {
      options: {
        createdAt: '2026-06-14T12:00:00.000Z',
      },
    },
    runtime: {
      workingDirectory: fixturesRoot,
      requestId,
      dryRun: true,
    },
  });
}

async function runLayeredProjectFixture() {
  return runFixture(
    'layered-project',
    {
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
    'req-extension-1',
  );
}

async function runCompanionConventionFixture() {
  return runFixture('companion-convention', {
    name: 'dbt',
    layers: ['staging', 'intermediate', 'marts'],
    rules: {
      'dbt/no-disallowed-layer-dependency': {
        options: {
          allowedUpstreamByLayer: {
            staging: ['staging'],
            intermediate: ['staging', 'intermediate'],
            marts: ['staging', 'intermediate', 'marts'],
          },
        },
      },
    },
  });
}

function findAssessmentNode(
  result: Awaited<ReturnType<typeof runDbtGovernanceRuntime>>,
  nodeId: string,
) {
  const node = result.assessment?.workspace.nodes.find(
    (entry) => entry.id === nodeId,
  );

  expect(node).toBeDefined();
  if (!node) {
    throw new Error(`Expected assessment workspace node "${nodeId}".`);
  }

  return node;
}

function getNodeDiagnosticCodes(
  result: Awaited<ReturnType<typeof runDbtGovernanceRuntime>>,
  nodeId: string,
) {
  return (result.extensionDiagnostics ?? [])
    .filter((diagnostic) => diagnostic.reference?.nodeId === nodeId)
    .map((diagnostic) => diagnostic.code);
}

function getNodeRecommendationCodes(
  result: Awaited<ReturnType<typeof runDbtGovernanceRuntime>>,
  nodeId: string,
) {
  return (result.assessment?.recommendations ?? [])
    .filter(
      (recommendation) =>
        asRecord(recommendation.metadata)?.governanceNodeId === nodeId,
    )
    .map(
      (recommendation) =>
        asRecord(recommendation.metadata)?.code as string | undefined,
    )
    .filter((code): code is string => code !== undefined);
}

function hasNodeSignal(
  result: Awaited<ReturnType<typeof runDbtGovernanceRuntime>>,
  nodeId: string,
  code: string,
  metadata: Record<string, unknown> = {},
) {
  return (result.signals ?? []).some(
    (signal) =>
      signal.nodeId === nodeId &&
      signal.metadata?.code === code &&
      Object.entries(metadata).every(
        ([key, value]) => signal.metadata?.[key] === value,
      ),
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function buildLayerOverlapProfile(): Record<string, unknown> {
  return {
    name: 'dbt',
    layers: ['staging', 'transform', 'mart', 'history'],
    rules: {
      'dbt/no-disallowed-layer-dependency': {
        options: {
          allowedUpstreamByLayer: {
            staging: [],
            transform: ['transform'],
            mart: ['mart'],
            history: ['history'],
          },
        },
      },
    },
  };
}
