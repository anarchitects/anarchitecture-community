import type {
  GovernanceWorkspaceAdapterResult,
  GovernanceSignal,
  GovernanceSignalCategory,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
} from './index.js';
import {
  coreTestAdapterResult,
  coreTestWorkspace,
  coreTestWorkspaceWithDanglingDependency,
  findDanglingDependencies,
} from '../../tests/workspace.fixtures.js';

describe('Core fixtures', () => {
  it('provide a plain governance workspace with valid dependency references', () => {
    expect(coreTestWorkspace.projects).toHaveLength(3);
    expect(coreTestWorkspace.dependencies).toHaveLength(2);
    expect(findDanglingDependencies(coreTestWorkspace)).toEqual([]);
  });

  it('includes an edge-case workspace with a dangling dependency target', () => {
    const danglingDependencies = findDanglingDependencies(
      coreTestWorkspaceWithDanglingDependency,
    );

    expect(danglingDependencies).toHaveLength(1);
    expect(danglingDependencies[0]).toMatchObject({
      source: 'booking-ui',
      target: 'missing-project',
      type: 'static',
    });
  });
});

describe('Core signal contracts', () => {
  it('support plain signal data through the core boundary', () => {
    const category: GovernanceSignalCategory = 'boundary';
    const severity: GovernanceSignalSeverity = 'warning';
    const source: GovernanceSignalSource = 'policy';
    const type: GovernanceSignalType = 'domain-boundary-violation';

    const signal: GovernanceSignal = {
      id: 'signal-domain-boundary',
      type,
      sourceProjectId: 'platform-shell',
      targetProjectId: 'booking-ui',
      relatedProjectIds: ['platform-shell', 'booking-ui'],
      severity,
      category,
      message: 'Platform shell should not depend on booking UI directly.',
      source,
      createdAt: '2026-05-13T00:00:00.000Z',
    };

    expect(signal).toMatchObject({
      type: 'domain-boundary-violation',
      category: 'boundary',
      severity: 'warning',
      source: 'policy',
    });
  });
});

describe('Core adapter contract coverage', () => {
  it('supports plain adapter result data through the core boundary', () => {
    const adapterResult: GovernanceWorkspaceAdapterResult = {
      ...coreTestAdapterResult,
      capabilities: [
        {
          id: 'capability:test-fixture',
          version: '1',
          data: {
            origin: 'core-fixture',
          },
        },
      ],
      diagnostics: [
        {
          code: 'fixture-warning',
          message: 'Fixture diagnostic',
          source: 'test',
        },
      ],
    };

    expect(adapterResult.projects).toHaveLength(3);
    expect(adapterResult.dependencies).toHaveLength(2);
    expect(adapterResult.capabilities?.[0]?.id).toBe('capability:test-fixture');
    expect(adapterResult.diagnostics?.[0]?.code).toBe('fixture-warning');
  });
});
