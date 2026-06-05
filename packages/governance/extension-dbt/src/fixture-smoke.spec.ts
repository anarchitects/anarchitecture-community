import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  GovernanceExtensionHostContext,
  GovernanceProfile,
  Ownership,
} from '@anarchitects/governance-core';

import {
  buildDbtGovernanceDiagnostics,
  buildDbtGovernanceMetrics,
  buildDbtGovernanceRecommendations,
  buildDbtGovernanceSignals,
  evaluateDbtArchitectureViolations,
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

describe('dbt extension fixture smoke coverage', () => {
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
      capabilities: {
        register: () => undefined,
        add: () => undefined,
        list: () => [],
        has: () => false,
        require: () => undefined,
      },
    };
  }

  function loadFixture(fileName: string): FixtureWorkspace {
    return JSON.parse(
      readFileSync(path.join(fixturesRoot, fileName), 'utf8'),
    ) as FixtureWorkspace;
  }

  function analyzeFixture(fileName: string) {
    const workspace = loadFixture(fileName);
    const profile = createProfile();
    const context = createContext(workspace);
    const diagnostics = buildDbtGovernanceDiagnostics({
      workspace,
      profile,
      context,
      diagnostics: [],
      signals: [],
      measurements: [],
      violations: [],
    });
    const signals = buildDbtGovernanceSignals({
      workspace,
      profile,
      context,
      diagnostics,
      signals: [],
      violations: [],
    });
    const violations = evaluateDbtArchitectureViolations({
      workspace,
      profile,
      context,
      diagnostics,
      signals,
    });
    const measurements = buildDbtGovernanceMetrics({
      workspace,
      profile,
      context,
      diagnostics,
      signals,
      violations,
      measurements: [],
    });
    const recommendations = buildDbtGovernanceRecommendations({
      workspace,
      profile,
      context,
      diagnostics,
      signals,
      violations,
      measurements,
      recommendations: [],
    });

    return {
      workspace,
      diagnostics,
      diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
      signals,
      signalCodes: signals.map((signal) => String(signal.metadata?.code ?? '')),
      violations,
      violationRuleIds: violations.map((violation) => violation.ruleId),
      measurements,
      recommendations,
      recommendationCodes: recommendations.map((recommendation) =>
        String(recommendation.metadata?.code ?? ''),
      ),
    };
  }

  it('loads all normalized workspace fixtures from disk', () => {
    const fixtureNames = readdirSync(fixturesRoot)
      .filter((entry) => entry.endsWith('.workspace.json'))
      .sort((left, right) => left.localeCompare(right));

    expect(fixtureNames).toEqual([
      'cross-domain.workspace.json',
      'hotspot.workspace.json',
      'invalid-owner.workspace.json',
      'layered.workspace.json',
      'missing-docs-tests-contracts.workspace.json',
      'missing-owner.workspace.json',
      'public-critical.workspace.json',
      'simple-valid.workspace.json',
      'unresolved-metadata.workspace.json',
    ]);

    for (const fixtureName of fixtureNames) {
      const workspace = loadFixture(fixtureName);

      expect(typeof workspace.id).toBe('string');
      expect(typeof workspace.name).toBe('string');
      expect(typeof workspace.root).toBe('string');
      expect(Array.isArray(workspace.projects)).toBe(true);
      expect(Array.isArray(workspace.dependencies)).toBe(true);
      expect(
        workspace.projects.every(
          (project) =>
            typeof project.id === 'string' &&
            Array.isArray(project.tags) &&
            typeof project.metadata === 'object' &&
            project.metadata !== null,
        ),
      ).toBe(true);
      expect(
        workspace.projects.some(
          (project) =>
            typeof project.metadata?.dbt === 'object' &&
            project.metadata.dbt !== null,
        ),
      ).toBe(true);
    }
  });

  it('keeps each fixture structurally consumable by the current dbt extension helpers', () => {
    const simpleValid = analyzeFixture('simple-valid.workspace.json');
    expect(simpleValid.diagnosticCodes).not.toEqual(
      expect.arrayContaining([
        'DBT_OWNER_MISSING',
        'DBT_OWNER_INVALID',
        'DBT_LAYER_UNRESOLVED',
        'DBT_DOMAIN_UNRESOLVED',
      ]),
    );
    expect(simpleValid.violationRuleIds).toEqual([]);
    expect(simpleValid.recommendationCodes).toEqual([]);

    const layered = analyzeFixture('layered.workspace.json');
    expect(layered.violationRuleIds).not.toContain(
      'dbt/no-disallowed-layer-dependency',
    );

    const crossDomain = analyzeFixture('cross-domain.workspace.json');
    expect(crossDomain.signalCodes).toContain(
      'DBT_CROSS_DOMAIN_DEPENDENCY_DETECTED',
    );
    expect(crossDomain.recommendationCodes).toContain(
      'REVIEW_CROSS_DOMAIN_DEPENDENCY',
    );

    const missingOwner = analyzeFixture('missing-owner.workspace.json');
    expect(missingOwner.diagnosticCodes).toContain('DBT_OWNER_MISSING');
    expect(missingOwner.recommendationCodes).toContain('ADD_OWNER');

    const invalidOwner = analyzeFixture('invalid-owner.workspace.json');
    expect(invalidOwner.diagnosticCodes).toContain('DBT_OWNER_INVALID');

    const missingQuality = analyzeFixture(
      'missing-docs-tests-contracts.workspace.json',
    );
    expect(missingQuality.recommendationCodes).toEqual(
      expect.arrayContaining([
        'ADD_DESCRIPTION',
        'ADD_TESTS',
        'ENABLE_CONTRACT',
      ]),
    );

    const publicCritical = analyzeFixture('public-critical.workspace.json');
    expect(publicCritical.violationRuleIds).toContain(
      'dbt/no-disallowed-layer-dependency',
    );
    expect(publicCritical.recommendationCodes).toContain(
      'FIX_LAYER_DEPENDENCY',
    );

    const hotspot = analyzeFixture('hotspot.workspace.json');
    expect(hotspot.signalCodes).toEqual(
      expect.arrayContaining([
        'DBT_HIGH_FAN_IN',
        'DBT_HIGH_FAN_OUT',
        'DBT_ARCHITECTURAL_HOTSPOT_CANDIDATE',
      ]),
    );
    expect(
      hotspot.measurements.find(
        (measurement) => measurement.id === 'dbt-hotspot-count',
      )?.value,
    ).toBeGreaterThan(0);
    expect(hotspot.recommendationCodes).toContain('REDUCE_HIGH_FAN_IN');

    const unresolved = analyzeFixture('unresolved-metadata.workspace.json');
    expect(unresolved.diagnosticCodes).toEqual(
      expect.arrayContaining(['DBT_LAYER_UNRESOLVED', 'DBT_DOMAIN_UNRESOLVED']),
    );
  });
});
