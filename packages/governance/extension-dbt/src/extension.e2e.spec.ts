import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DefaultGovernanceCapabilityRegistry,
  collectGovernanceMeasurements,
  collectGovernanceSignals,
  evaluateGovernanceRulePacks,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceExtensionHostContext,
  type GovernanceProfile,
  type Ownership,
} from '@anarchitects/governance-core';

import {
  collectDbtGovernanceDiagnostics,
  collectDbtGovernanceRecommendations,
  dbtGovernanceExtension,
  getDbtGovernanceDiagnosticProviders,
  getDbtGovernanceRecommendationProviders,
  resolveDbtGovernanceMetadata,
  type DbtGovernanceDiagnosticProviderInput,
  type DbtGovernanceMetricProviderInput,
  type DbtGovernanceRecommendationProviderInput,
  type DbtGovernanceRulePackInput,
  type DbtGovernanceSignalProviderInput,
  type DbtGovernanceMetadataResolverInput,
} from './index.js';

type FixtureWorkspaceProject = {
  id: string;
  name: string;
  root: string;
  type: 'application' | 'library' | 'tool' | 'unknown';
  tags: string[];
  domain?: string;
  layer?: string;
  ownership?: Ownership;
  metadata: Record<string, unknown>;
};

type FixtureWorkspaceDependency = {
  source: string;
  target: string;
  type: 'static' | 'dynamic' | 'implicit' | 'unknown';
  sourceFile?: string;
};

type FixtureWorkspace = {
  id: string;
  name: string;
  root: string;
  projects: FixtureWorkspaceProject[];
  dependencies: FixtureWorkspaceDependency[];
};

const fixturesRoot = fileURLToPath(
  new URL('../fixtures/normalized/', import.meta.url),
);

describe('dbt Governance extension end-to-end flow', () => {
  function createProfile(
    overrides: Partial<GovernanceProfile> = {},
  ): GovernanceProfile {
    return {
      name: 'dbt',
      boundaryPolicySource: 'profile',
      layers: ['staging', 'intermediate', 'marts'],
      allowedDomainDependencies: {
        customer: ['customer'],
        finance: ['finance'],
        sales: ['sales'],
      },
      ownership: {
        required: true,
        metadataField: 'ownership.team',
      },
      health: {
        statusThresholds: {
          goodMinScore: 85,
          warningMinScore: 70,
        },
      },
      metrics: {},
      ...overrides,
    };
  }

  function createContext(
    workspace: FixtureWorkspace,
  ): GovernanceExtensionHostContext {
    return {
      workspaceRoot: workspace.root,
      profileName: 'dbt',
      options: {},
      inventory: workspace,
      capabilities: new DefaultGovernanceCapabilityRegistry(),
    };
  }

  function loadFixture(fileName: string): FixtureWorkspace {
    return JSON.parse(
      readFileSync(path.join(fixturesRoot, fileName), 'utf8'),
    ) as FixtureWorkspace;
  }

  async function runExtensionFlow(options: {
    fixtureName: string;
    workspace?: FixtureWorkspace;
    profile?: GovernanceProfile;
  }) {
    const workspace = options.workspace ?? loadFixture(options.fixtureName);
    const profile = options.profile ?? createProfile();
    const context = createContext(workspace);
    const metadataResolutions = workspace.projects
      .filter((project) => hasDbtMetadata(project.metadata))
      .map((project) => resolveDbtGovernanceMetadata(toResolverInput(project)));

    const registration =
      await registerLoadedGovernanceExtensionsWithDiagnostics(context, [
        {
          sourceSpecifier: '@anarchitects/governance-extension-dbt',
          moduleSpecifier: '@anarchitects/governance-extension-dbt',
          definition: dbtGovernanceExtension,
        },
      ]);

    const discoveryHost = {
      context,
      registerRulePack: () => undefined,
      registerSignalProvider: () => undefined,
      registerMetricProvider: () => undefined,
      registerEnricher: () => undefined,
    };

    const diagnosticProviders =
      getDbtGovernanceDiagnosticProviders(discoveryHost);
    const recommendationProviders =
      getDbtGovernanceRecommendationProviders(discoveryHost);

    const diagnosticInput: DbtGovernanceDiagnosticProviderInput = {
      workspace,
      profile,
      context,
      diagnostics: [],
      signals: [],
      measurements: [],
      violations: [],
      metadataResolutions,
    };
    const diagnostics = await collectDbtGovernanceDiagnostics(
      diagnosticProviders,
      diagnosticInput,
    );

    const signalInput: DbtGovernanceSignalProviderInput = {
      workspace,
      profile,
      context,
      violations: [],
      signals: [],
      diagnostics,
      metadataResolutions,
    };
    const signals = await collectGovernanceSignals(
      registration.registry,
      signalInput,
    );

    const ruleInput: DbtGovernanceRulePackInput = {
      workspace,
      profile,
      context,
      diagnostics,
      signals,
      metadataResolutions,
    };
    const violations = await evaluateGovernanceRulePacks(
      registration.registry,
      ruleInput,
    );

    const metricInput: DbtGovernanceMetricProviderInput = {
      workspace,
      profile,
      context,
      diagnostics,
      signals,
      violations,
      measurements: [],
      metadataResolutions,
    };
    const measurements = await collectGovernanceMeasurements(
      registration.registry,
      metricInput,
    );

    const recommendationInput: DbtGovernanceRecommendationProviderInput = {
      workspace,
      profile,
      context,
      diagnostics,
      signals,
      violations,
      measurements,
      recommendations: [],
      metadataResolutions,
    };
    const recommendations = await collectDbtGovernanceRecommendations(
      recommendationProviders,
      recommendationInput,
    );

    return {
      workspace,
      profile,
      registration,
      metadataResolutions,
      diagnostics,
      diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
      signals,
      signalCodes: signals.map((signal) => String(signal.metadata?.code ?? '')),
      violations,
      violationRuleIds: violations.map((violation) => violation.ruleId),
      measurements,
      measurementIds: measurements.map((measurement) => measurement.id),
      recommendations,
      recommendationCodes: recommendations.map((recommendation) =>
        String(recommendation.metadata?.code ?? ''),
      ),
    };
  }

  it('runs the healthy layered fixture through the full extension flow', async () => {
    const result = await runExtensionFlow({
      fixtureName: 'layered.workspace.json',
    });

    expect(result.registration.diagnostics).toEqual([]);
    expect(result.metadataResolutions).toHaveLength(4);
    expect(
      result.metadataResolutions.map((resolution) => resolution.layer.status),
    ).toEqual(['resolved', 'resolved', 'resolved', 'resolved']);
    expect(
      result.metadataResolutions.map((resolution) => resolution.domain.status),
    ).toEqual(['resolved', 'resolved', 'resolved', 'resolved']);
    expect(result.diagnosticCodes).not.toEqual(
      expect.arrayContaining([
        'DBT_LAYER_UNRESOLVED',
        'DBT_DOMAIN_UNRESOLVED',
        'DBT_OWNER_MISSING',
        'DBT_CRITICALITY_INVALID',
      ]),
    );
    expect(result.signalCodes).toEqual(
      expect.arrayContaining([
        'DBT_LAYER_RESOLVED',
        'DBT_DOMAIN_RESOLVED',
        'DBT_OWNER_RESOLVED',
        'DBT_DESCRIPTION_PRESENT',
        'DBT_TESTS_PRESENT',
        'DBT_CONTRACT_ENABLED',
      ]),
    );
    expect(result.violationRuleIds).toEqual([]);
    expect(result.measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dbt-model-count',
          value: 3,
        }),
        expect.objectContaining({
          id: 'dbt-dependency-count',
          value: 2,
        }),
        expect.objectContaining({
          id: 'dbt-ownership-completeness-ratio',
          value: 1,
        }),
        expect.objectContaining({
          id: 'dbt-documentation-coverage-ratio',
          value: 1,
        }),
        expect.objectContaining({
          id: 'dbt-test-coverage-ratio',
          value: 1,
        }),
        expect.objectContaining({
          id: 'dbt-contract-adoption-ratio',
          value: 1,
        }),
      ]),
    );
    expect(result.recommendations).toEqual([]);
  });

  it('surfaces layer violation, bypass signals, metrics, and recommendations', async () => {
    const result = await runExtensionFlow({
      fixtureName: 'public-critical.workspace.json',
    });

    expect(result.signalCodes).toEqual(
      expect.arrayContaining([
        'DBT_LAYER_DEPENDENCY_DETECTED',
        'DBT_LAYER_DIRECTION_CANDIDATE',
        'DBT_LAYER_BYPASS_CANDIDATE',
        'DBT_CRITICAL_MODEL_WITHOUT_TESTS_CANDIDATE',
      ]),
    );
    expect(result.violationRuleIds).toEqual(
      expect.arrayContaining([
        'dbt/no-disallowed-layer-dependency',
        'dbt/critical-models-require-tests',
      ]),
    );
    expect(
      result.measurements.find(
        (measurement) => measurement.id === 'dbt-layer-violation-count',
      ),
    ).toMatchObject({
      value: 1,
    });
    expect(result.recommendationCodes).toEqual(
      expect.arrayContaining(['FIX_LAYER_DEPENDENCY', 'ADD_TESTS']),
    );
  });

  it('surfaces cross-domain dependency interpretation end to end', async () => {
    const result = await runExtensionFlow({
      fixtureName: 'cross-domain.workspace.json',
    });

    expect(result.signalCodes).toContain(
      'DBT_CROSS_DOMAIN_DEPENDENCY_DETECTED',
    );
    expect(result.violationRuleIds).toContain(
      'dbt/cross-domain-dependencies-require-approval',
    );
    expect(
      result.measurements.find(
        (measurement) => measurement.id === 'dbt-cross-domain-dependency-count',
      ),
    ).toMatchObject({
      value: 1,
    });
    expect(result.recommendationCodes).toContain(
      'REVIEW_CROSS_DOMAIN_DEPENDENCY',
    );
  });

  it('surfaces missing owner diagnostics, signals, metrics, and recommendations', async () => {
    const result = await runExtensionFlow({
      fixtureName: 'missing-owner.workspace.json',
    });

    expect(result.metadataResolutions[0]?.owner.status).toBe('unresolved');
    expect(result.diagnosticCodes).toEqual(
      expect.arrayContaining([
        'DBT_OWNER_MISSING',
        'DBT_RULE_SKIPPED_MISSING_METADATA',
      ]),
    );
    expect(result.signalCodes).toContain('DBT_OWNER_MISSING');
    expect(
      result.measurements.find(
        (measurement) => measurement.id === 'dbt-ownership-completeness-ratio',
      ),
    ).toMatchObject({
      value: 0,
    });
    expect(result.recommendationCodes).toContain('ADD_OWNER');
  });

  it('surfaces invalid criticality diagnostics when normalized metadata is malformed', async () => {
    const fixture = loadFixture('simple-valid.workspace.json');
    const mutatedWorkspace: FixtureWorkspace = {
      ...fixture,
      projects: fixture.projects.map((project) =>
        project.id === 'model.simple_valid.orders_mart'
          ? {
              ...project,
              metadata: {
                ...project.metadata,
                dbt: {
                  ...(project.metadata.dbt as Record<string, unknown>),
                  resource: {
                    ...((project.metadata.dbt as Record<string, unknown>)
                      .resource as Record<string, unknown>),
                    meta: {
                      ...(((
                        (project.metadata.dbt as Record<string, unknown>)
                          .resource as Record<string, unknown>
                      ).meta as Record<string, unknown>) ?? {}),
                      criticality: ['high'],
                    },
                  },
                },
              },
            }
          : project,
      ),
    };

    const result = await runExtensionFlow({
      fixtureName: 'simple-valid.workspace.json',
      workspace: mutatedWorkspace,
    });

    expect(result.diagnosticCodes).toContain('DBT_CRITICALITY_INVALID');
  });

  it('surfaces missing documentation, tests, and contracts for public/governed critical models', async () => {
    const result = await runExtensionFlow({
      fixtureName: 'missing-docs-tests-contracts.workspace.json',
    });

    expect(result.signalCodes).toEqual(
      expect.arrayContaining([
        'DBT_DESCRIPTION_MISSING',
        'DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE',
        'DBT_TESTS_MISSING',
        'DBT_CRITICAL_MODEL_WITHOUT_TESTS_CANDIDATE',
        'DBT_CONTRACT_MISSING_FOR_PUBLIC_MODEL_CANDIDATE',
      ]),
    );
    expect(result.violationRuleIds).toEqual(
      expect.arrayContaining([
        'dbt/public-models-require-description',
        'dbt/critical-models-require-tests',
        'dbt/public-models-require-contract',
      ]),
    );
    expect(result.measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dbt-documentation-coverage-ratio',
          value: 0,
        }),
        expect.objectContaining({
          id: 'dbt-test-coverage-ratio',
          value: 0,
        }),
        expect.objectContaining({
          id: 'dbt-contract-adoption-ratio',
          value: 0,
        }),
      ]),
    );
    expect(result.recommendationCodes).toEqual(
      expect.arrayContaining([
        'ADD_DESCRIPTION',
        'ADD_TESTS',
        'ENABLE_CONTRACT',
      ]),
    );
  });

  it('surfaces public/governed and critical model checks from normalized fixtures', async () => {
    const result = await runExtensionFlow({
      fixtureName: 'public-critical.workspace.json',
    });

    expect(result.signalCodes).toEqual(
      expect.arrayContaining(['DBT_CONTRACT_ENABLED', 'DBT_TESTS_PRESENT']),
    );
    expect(result.metadataResolutions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          governanceNodeId: 'model.public_critical.customer_public_mart',
          publicInterface: expect.objectContaining({
            status: 'resolved',
            value: true,
          }),
          criticality: expect.objectContaining({
            status: 'resolved',
            value: 'high',
          }),
        }),
      ]),
    );
  });

  it('surfaces high fan-in, high fan-out, hotspot metrics, and hotspot recommendations', async () => {
    const result = await runExtensionFlow({
      fixtureName: 'hotspot.workspace.json',
    });

    expect(result.signalCodes).toEqual(
      expect.arrayContaining([
        'DBT_HIGH_FAN_IN',
        'DBT_HIGH_FAN_OUT',
        'DBT_ARCHITECTURAL_HOTSPOT_CANDIDATE',
      ]),
    );
    expect(
      result.measurements.find(
        (measurement) => measurement.id === 'dbt-hotspot-count',
      ),
    ).toMatchObject({
      value: 1,
    });
    expect(result.recommendationCodes).toContain('REDUCE_HIGH_FAN_IN');
  });

  it('surfaces skipped-rule diagnostics and unresolved metrics when metadata cannot be resolved', async () => {
    const result = await runExtensionFlow({
      fixtureName: 'unresolved-metadata.workspace.json',
    });

    expect(result.metadataResolutions[0]).toMatchObject({
      layer: {
        status: 'unresolved',
      },
      domain: {
        status: 'unresolved',
      },
    });
    expect(result.diagnosticCodes).toEqual(
      expect.arrayContaining([
        'DBT_LAYER_UNRESOLVED',
        'DBT_DOMAIN_UNRESOLVED',
        'DBT_RULE_SKIPPED_MISSING_METADATA',
      ]),
    );
    expect(
      result.measurements.find(
        (measurement) => measurement.id === 'dbt-unresolved-layer-count',
      ),
    ).toMatchObject({
      value: 1,
    });
    expect(
      result.measurements.find(
        (measurement) => measurement.id === 'dbt-unresolved-domain-count',
      ),
    ).toMatchObject({
      value: 1,
    });
  });
});

function hasDbtMetadata(
  metadata: unknown,
): metadata is Record<string, unknown> {
  return typeof metadata === 'object' && metadata !== null && 'dbt' in metadata;
}

function toResolverInput(
  project: FixtureWorkspaceProject,
): DbtGovernanceMetadataResolverInput {
  return {
    id: project.id,
    name: project.name,
    root: project.root,
    tags: project.tags,
    domain: project.domain,
    layer: project.layer,
    ownership: project.ownership,
    metadata: project.metadata,
  };
}
