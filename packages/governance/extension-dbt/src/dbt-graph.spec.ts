import {
  attachDbtGovernanceModelExpansion,
  getDbtConsumerContextResources,
  getDbtSemanticAssetResources,
  getDbtSemanticResources,
} from './index.js';
import { createCompatibilityWorkspace } from './test-workspace.js';

describe('dbt graph semantic resource helpers', () => {
  it('reads semantic resources from workspace expansion and preserves roles', () => {
    const workspace = attachDbtGovernanceModelExpansion(
      createCompatibilityWorkspace({
        id: 'workspace',
        name: 'workspace',
        root: '/repo',
        projects: [
          {
            id: 'metric.analytics.total_revenue',
            name: 'total_revenue',
            root: '/repo/metrics',
            type: 'library',
            tags: [],
            metadata: {
              dbt: {
                identity: {
                  resourceType: 'metric',
                },
              },
            },
          },
        ],
        dependencies: [],
      }),
      {
        kind: 'workspace',
        technology: 'dbt',
        projectName: 'analytics',
        semanticResources: [
          {
            uniqueId: 'metric.analytics.total_revenue',
            resourceType: 'metric',
            role: 'semantic-asset',
            name: 'total_revenue',
            packageName: 'analytics',
            canonicalNodeId: 'metric.analytics.total_revenue',
            dependsOnNodeIds: ['model.analytics.orders'],
            payload: {
              type: 'simple',
            },
          },
          {
            uniqueId: 'exposure.analytics.executive_dashboard',
            resourceType: 'exposure',
            role: 'consumer-context',
            name: 'executive_dashboard',
            packageName: 'analytics',
            dependsOnNodeIds: ['model.analytics.orders'],
            payload: {
              type: 'dashboard',
            },
          },
        ],
      },
    );

    expect(getDbtSemanticResources(workspace)).toEqual([
      expect.objectContaining({
        uniqueId: 'metric.analytics.total_revenue',
        role: 'semantic-asset',
        canonicalNodeId: 'metric.analytics.total_revenue',
      }),
      expect.objectContaining({
        uniqueId: 'exposure.analytics.executive_dashboard',
        role: 'consumer-context',
      }),
    ]);
    expect(getDbtSemanticAssetResources(workspace)).toEqual([
      expect.objectContaining({
        uniqueId: 'metric.analytics.total_revenue',
      }),
    ]);
    expect(getDbtConsumerContextResources(workspace)).toEqual([
      expect.objectContaining({
        uniqueId: 'exposure.analytics.executive_dashboard',
      }),
    ]);
  });

  it('works when semantic resources are present without matching canonical nodes', () => {
    const workspace = attachDbtGovernanceModelExpansion(
      createCompatibilityWorkspace({
        id: 'workspace',
        name: 'workspace',
        root: '/repo',
        projects: [],
        dependencies: [],
      }),
      {
        kind: 'workspace',
        technology: 'dbt',
        projectName: 'analytics',
        semanticResources: [
          {
            uniqueId: 'semantic_model.analytics.orders',
            resourceType: 'semantic_model',
            role: 'semantic-asset',
            name: 'orders',
            packageName: 'analytics',
            dependsOnNodeIds: ['model.analytics.orders'],
            payload: {
              entities: [{ name: 'order' }],
            },
          },
        ],
      },
    );

    expect(getDbtSemanticResources(workspace)).toEqual([
      expect.objectContaining({
        uniqueId: 'semantic_model.analytics.orders',
        role: 'semantic-asset',
        payload: {
          entities: [{ name: 'order' }],
        },
      }),
    ]);
  });

  it('returns an empty array when semantic resources are absent or the expansion is incomplete', () => {
    const withoutExpansion = createCompatibilityWorkspace({
      id: 'workspace',
      name: 'workspace',
      root: '/repo',
      projects: [],
      dependencies: [],
    });
    const withoutSemanticResources = attachDbtGovernanceModelExpansion(
      createCompatibilityWorkspace({
        id: 'workspace',
        name: 'workspace',
        root: '/repo',
        projects: [],
        dependencies: [],
      }),
      {
        kind: 'workspace',
        technology: 'dbt',
        projectName: 'analytics',
      },
    );

    expect(getDbtSemanticResources(withoutExpansion)).toEqual([]);
    expect(getDbtSemanticResources(withoutSemanticResources)).toEqual([]);
    expect(getDbtSemanticAssetResources(withoutSemanticResources)).toEqual([]);
    expect(getDbtConsumerContextResources(withoutSemanticResources)).toEqual(
      [],
    );
  });
});
