import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadDbtArtifacts,
  normalizeDbtArtifacts,
  resolveDbtProjectContext,
  type DbtArtifacts,
  type DbtManifestResource,
} from './index.js';

const fixturesRoot = fileURLToPath(
  new URL('../tests/fixtures/artifacts/', import.meta.url),
);

interface DbtNodeExpansionEnvelope {
  extensionId: string;
  contractVersion: string;
  data: {
    kind: 'node';
    nodeKind: 'project' | 'resource' | 'unknown';
    resourceType?: string;
    resource?: Record<string, unknown>;
  };
}

interface DbtRelationExpansionEnvelope {
  extensionId: string;
  contractVersion: string;
  data: {
    kind: 'relation';
    technology?: string;
    relationKind: string;
  };
}

interface DbtWorkspaceExpansionEnvelope {
  extensionId: string;
  contractVersion: string;
  data: {
    kind: 'workspace';
    technology?: string;
    projectName: string;
    project?: Record<string, unknown>;
    projectNodeIds?: string[];
    testEvidence?: Array<Record<string, unknown>>;
    semanticResources?: Array<Record<string, unknown>>;
  };
}

describe('dbt artifact normalization', () => {
  it('emits canonical workspace identity, nodes, and relations only', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);

    expect(normalized.workspaceId).toBe('dbt:valid_project');
    expect(normalized.workspaceName).toBe('valid_project');
    expect(normalized.workspaceRoot).toBe(
      path.join(fixturesRoot, 'valid-project'),
    );
    expect(normalized).not.toHaveProperty('projects');
    expect(normalized).not.toHaveProperty('dependencies');
    expect(normalized.nodes?.length).toBeGreaterThan(0);
    expect(normalized.relations?.length).toBeGreaterThan(0);
  });

  it('normalizes models, sources, seeds, and snapshots into canonical nodes while keeping project context at workspace level', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);
    const nodeIds = normalized.nodes?.map((node) => node.id) ?? [];
    const workspaceExpansion = normalized.extensions?.[
      'governance-extension:dbt'
    ] as DbtWorkspaceExpansionEnvelope | undefined;

    expect(nodeIds).toEqual(
      expect.arrayContaining([
        'model.valid_project.stg_orders',
        'model.valid_project.orders',
        'model.valid_project.orders_regional',
        'source.valid_project.raw.orders',
        'seed.valid_project.countries',
        'snapshot.valid_project.orders_snapshot',
      ]),
    );
    expect(nodeIds).not.toContain('exposure.valid_project.executive_dashboard');
    expect(nodeIds).not.toContain('dbt.project.valid_project');
    expect(nodeIds.some((nodeId) => nodeId.startsWith('dbt.project.'))).toBe(
      false,
    );
    expect(nodeIds.some((nodeId) => nodeId.startsWith('test.'))).toBe(false);

    expect(workspaceExpansion).toMatchObject({
      data: {
        kind: 'workspace',
        technology: 'dbt',
        projectName: 'valid_project',
        project: expect.objectContaining({
          name: 'valid_project',
          profile: 'analytics',
        }),
        projectNodeIds: expect.arrayContaining([
          'model.valid_project.orders',
          'source.valid_project.raw.orders',
          'seed.valid_project.countries',
        ]),
      },
    });

    expect(
      normalized.nodes?.find(
        (node) => node.id === 'model.valid_project.orders',
      ),
    ).toMatchObject({
      kind: 'resource',
      technology: 'dbt',
      sourceSystem: 'dbt',
      tags: ['finance', 'published', 'scope:analytics'],
      classification: {
        domain: 'finance',
        layer: 'transform',
        scope: 'analytics',
        tags: ['finance', 'published', 'scope:analytics'],
      },
      metadata: {
        governance: {
          kind: 'asset',
        },
        documentation: true,
      },
      extensions: {
        'governance-extension:dbt': expect.objectContaining({
          data: expect.objectContaining({
            kind: 'node',
            nodeKind: 'resource',
            resourceType: 'model',
            identity: expect.objectContaining({
              uniqueId: 'model.valid_project.orders',
              packageName: 'valid_project',
              resourceName: 'orders',
              resourceType: 'model',
              fullyQualifiedName: 'valid_project.marts.orders',
              fqn: ['valid_project', 'marts', 'orders'],
            }),
            resource: expect.objectContaining({
              materialization: 'table',
              tags: ['finance', 'published', 'scope:analytics'],
              meta: {
                governance: {
                  domain: 'finance',
                  layer: 'transform',
                  scope: 'analytics',
                },
              },
              group: 'finance',
              owner: {
                name: 'finance-platform',
                email: 'finance@example.com',
              },
            }),
            relation: expect.objectContaining({
              database: 'analytics',
              schema: 'marts',
              alias: 'orders',
              path: 'orders.sql',
              originalFilePath: 'models/marts/orders.sql',
              relationName: '"analytics"."marts"."orders"',
            }),
            validation: expect.objectContaining({
              tests: ['unique:order_id', 'not_null:order_id'],
              contract: {
                enforced: true,
                alias_types: false,
              },
            }),
            documentation: expect.objectContaining({
              description: 'Normalized orders model',
              hasDescription: true,
              docsShow: true,
            }),
          }),
        }),
      },
    });

    expect(
      normalized.nodes?.find(
        (node) => node.id === 'source.valid_project.raw.orders',
      ),
    ).toMatchObject({
      kind: 'resource',
      ownership: {
        team: 'data-eng',
      },
      metadata: {
        governance: {
          kind: 'asset',
        },
      },
      extensions: {
        'governance-extension:dbt': expect.objectContaining({
          data: expect.objectContaining({
            resourceType: 'source',
            identity: expect.objectContaining({
              uniqueId: 'source.valid_project.raw.orders',
              resourceType: 'source',
              sourceName: 'raw',
            }),
            resource: expect.objectContaining({
              group: 'raw-data',
              owner: 'data-eng',
            }),
            relation: expect.objectContaining({
              database: 'warehouse',
              schema: 'raw',
              relationName: '"warehouse"."raw"."orders"',
            }),
            validation: expect.objectContaining({
              tests: ['freshness', 'not_null:order_id'],
            }),
          }),
        }),
      },
    });
  });

  it('keeps dbt test evidence in workspace expansion instead of canonical nodes', () => {
    const context = mustResolveContext('valid-project');
    const normalized = normalizeDbtArtifacts(context, {
      manifest: buildSyntheticManifestFromResources([
        [
          'source.valid_project.raw.orders',
          {
            resource_type: 'source',
            unique_id: 'source.valid_project.raw.orders',
            package_name: 'valid_project',
            name: 'orders',
            source_name: 'raw',
            relation_name: '"warehouse"."raw"."orders"',
            original_file_path: 'models/raw/raw.yml',
            tags: ['raw'],
            tests: ['freshness'],
          },
        ],
        [
          'seed.valid_project.countries',
          {
            resource_type: 'seed',
            unique_id: 'seed.valid_project.countries',
            package_name: 'valid_project',
            name: 'countries',
            relation_name: '"analytics"."reference"."countries"',
            original_file_path: 'seeds/countries.csv',
            tests: ['unique:country_code'],
            config: {
              materialized: 'seed',
            },
          },
        ],
        [
          'model.valid_project.orders',
          {
            resource_type: 'model',
            unique_id: 'model.valid_project.orders',
            package_name: 'valid_project',
            name: 'orders',
            relation_name: '"analytics"."marts"."orders"',
            original_file_path: 'models/marts/orders.sql',
            tests: false,
            config: {
              materialized: 'table',
              contract: {
                enforced: true,
              },
            },
            depends_on: {
              nodes: [
                'source.valid_project.raw.orders',
                'seed.valid_project.countries',
              ],
            },
          },
        ],
        [
          'test.valid_project.relationships_orders_country_code',
          {
            resource_type: 'test',
            unique_id: 'test.valid_project.relationships_orders_country_code',
            package_name: 'valid_project',
            name: 'relationships_orders_country_code',
            original_file_path:
              'tests/generic/relationships_orders_country_code.sql',
            tags: ['critical', 'relationships'],
            meta: {
              severity: 'error',
            },
            test_metadata: {
              name: 'relationships',
            },
            depends_on: {
              nodes: [
                'model.valid_project.orders',
                'seed.valid_project.countries',
              ],
            },
          },
        ],
      ]),
      projectConfig: {
        name: 'valid_project',
        profile: 'analytics',
        modelPaths: ['models'],
        seedPaths: ['seeds'],
        testPaths: ['tests'],
      },
    });
    const workspaceExpansion = normalized.extensions?.[
      'governance-extension:dbt'
    ] as DbtWorkspaceExpansionEnvelope | undefined;
    const nodeIds = normalized.nodes?.map((node) => node.id) ?? [];

    expect(nodeIds).toEqual(
      expect.arrayContaining([
        'model.valid_project.orders',
        'source.valid_project.raw.orders',
        'seed.valid_project.countries',
      ]),
    );
    expect(nodeIds).not.toContain(
      'test.valid_project.relationships_orders_country_code',
    );
    expect(
      normalized.nodes?.some((node) => {
        const expansion = getDbtNodeExpansion(node);
        return expansion?.data.resourceType === 'test';
      }),
    ).toBe(false);

    expect(workspaceExpansion).toMatchObject({
      data: {
        project: expect.objectContaining({
          name: 'valid_project',
          profile: 'analytics',
          modelPaths: ['models'],
          seedPaths: ['seeds'],
          testPaths: ['tests'],
        }),
        testEvidence: [
          expect.objectContaining({
            uniqueId: 'test.valid_project.relationships_orders_country_code',
            name: 'relationships_orders_country_code',
            packageName: 'valid_project',
            resourceType: 'test',
            testType: 'relationships',
            dependsOnNodeIds: [
              'model.valid_project.orders',
              'seed.valid_project.countries',
            ],
            targetNodeIds: [
              'model.valid_project.orders',
              'seed.valid_project.countries',
            ],
            originalFilePath:
              'tests/generic/relationships_orders_country_code.sql',
            tags: ['critical', 'relationships'],
            meta: {
              severity: 'error',
            },
          }),
        ],
      },
    });
    expect(
      normalized.nodes?.every(
        (node) =>
          (node.metadata as { governance?: { kind?: string } } | undefined)
            ?.governance?.kind === 'asset',
      ),
    ).toBe(true);
    expect(normalized.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNodeId: 'model.valid_project.orders',
          targetNodeId: 'source.valid_project.raw.orders',
          kind: 'dependency',
        }),
        expect.objectContaining({
          sourceNodeId: 'model.valid_project.orders',
          targetNodeId: 'seed.valid_project.countries',
          kind: 'dependency',
        }),
      ]),
    );
    expect(normalized.relations).toHaveLength(2);
    expect(
      normalized.relations?.some(
        (relation) => relation.kind === 'traceability',
      ),
    ).toBe(false);
    expect(
      normalized.relations?.some((relation) =>
        relation.id?.startsWith('dbt:tests:'),
      ),
    ).toBe(false);
    expect(
      normalized.relations?.some((relation) => {
        const expansion = relation.extensions?.['governance-extension:dbt'] as
          | DbtRelationExpansionEnvelope
          | undefined;
        return expansion?.data.relationKind === 'tests';
      }),
    ).toBe(false);
  });

  it('makes semantic dbt resource handling explicit without polluting data-asset lineage', () => {
    const context = mustResolveContext('valid-project');
    const normalized = normalizeDbtArtifacts(context, {
      manifest: buildSyntheticManifestFromResources([
        [
          'source.valid_project.raw.orders',
          {
            resource_type: 'source',
            unique_id: 'source.valid_project.raw.orders',
            package_name: 'valid_project',
            name: 'orders',
            source_name: 'raw',
            relation_name: '"warehouse"."raw"."orders"',
            original_file_path: 'models/raw/raw.yml',
            tests: ['freshness'],
          },
        ],
        [
          'seed.valid_project.countries',
          {
            resource_type: 'seed',
            unique_id: 'seed.valid_project.countries',
            package_name: 'valid_project',
            name: 'countries',
            relation_name: '"analytics"."reference"."countries"',
            original_file_path: 'seeds/countries.csv',
            tests: ['unique:country_code'],
            config: {
              materialized: 'seed',
            },
          },
        ],
        [
          'model.valid_project.orders',
          {
            resource_type: 'model',
            unique_id: 'model.valid_project.orders',
            package_name: 'valid_project',
            name: 'orders',
            relation_name: '"analytics"."marts"."orders"',
            original_file_path: 'models/marts/orders.sql',
            tests: ['not_null:order_id'],
            config: {
              materialized: 'table',
              contract: {
                enforced: true,
              },
            },
            depends_on: {
              nodes: [
                'source.valid_project.raw.orders',
                'seed.valid_project.countries',
              ],
            },
          },
        ],
        [
          'snapshot.valid_project.orders_snapshot',
          {
            resource_type: 'snapshot',
            unique_id: 'snapshot.valid_project.orders_snapshot',
            package_name: 'valid_project',
            name: 'orders_snapshot',
            relation_name: '"analytics"."snapshots"."orders_snapshot"',
            original_file_path: 'snapshots/orders_snapshot.sql',
            tests: ['unique:order_id'],
            config: {
              materialized: 'snapshot',
              contract: {
                enforced: true,
              },
            },
            depends_on: {
              nodes: ['model.valid_project.orders'],
            },
          },
        ],
        [
          'exposure.valid_project.executive_dashboard',
          {
            resource_type: 'exposure',
            unique_id: 'exposure.valid_project.executive_dashboard',
            package_name: 'valid_project',
            name: 'executive_dashboard',
            description: 'Executive dashboard exposure',
            type: 'dashboard',
            depends_on: {
              nodes: ['model.valid_project.orders'],
            },
          },
        ],
        [
          'metric.valid_project.total_revenue',
          {
            resource_type: 'metric',
            unique_id: 'metric.valid_project.total_revenue',
            package_name: 'valid_project',
            name: 'total_revenue',
            description: 'Total revenue metric',
            meta: {
              governance: {
                domain: 'finance',
                layer: 'semantic',
              },
            },
            depends_on: {
              nodes: ['model.valid_project.orders'],
            },
          },
        ],
        [
          'semantic_model.valid_project.orders_semantic',
          {
            resource_type: 'semantic_model',
            unique_id: 'semantic_model.valid_project.orders_semantic',
            package_name: 'valid_project',
            name: 'orders_semantic',
            description: 'Orders semantic model',
            depends_on: {
              nodes: ['model.valid_project.orders'],
            },
          },
        ],
        [
          'saved_query.valid_project.orders_saved_query',
          {
            resource_type: 'saved_query',
            unique_id: 'saved_query.valid_project.orders_saved_query',
            package_name: 'valid_project',
            name: 'orders_saved_query',
            description: 'Published orders saved query',
            depends_on: {
              nodes: ['semantic_model.valid_project.orders_semantic'],
            },
          },
        ],
        [
          'test.valid_project.not_null_orders_order_id',
          {
            resource_type: 'test',
            unique_id: 'test.valid_project.not_null_orders_order_id',
            package_name: 'valid_project',
            name: 'not_null_orders_order_id',
            test_metadata: {
              name: 'not_null',
            },
            depends_on: {
              nodes: ['model.valid_project.orders'],
            },
          },
        ],
      ]),
      projectConfig: {
        name: 'valid_project',
      },
    });
    const workspaceExpansion = normalized.extensions?.[
      'governance-extension:dbt'
    ] as DbtWorkspaceExpansionEnvelope | undefined;
    const nodeIds = normalized.nodes?.map((node) => node.id) ?? [];

    expect(nodeIds).toEqual(
      expect.arrayContaining([
        'model.valid_project.orders',
        'source.valid_project.raw.orders',
        'seed.valid_project.countries',
        'snapshot.valid_project.orders_snapshot',
        'metric.valid_project.total_revenue',
        'semantic_model.valid_project.orders_semantic',
        'saved_query.valid_project.orders_saved_query',
      ]),
    );
    expect(nodeIds).not.toContain('exposure.valid_project.executive_dashboard');
    expect(nodeIds).not.toContain(
      'test.valid_project.not_null_orders_order_id',
    );
    expect(
      normalized.nodes?.find((node) => node.id === 'model.valid_project.orders')
        ?.metadata,
    ).toMatchObject({
      governance: {
        kind: 'asset',
        assetKind: 'data',
      },
    });
    expect(
      normalized.nodes?.find(
        (node) => node.id === 'metric.valid_project.total_revenue',
      )?.metadata,
    ).toMatchObject({
      governance: {
        kind: 'asset',
        assetKind: 'semantic',
      },
    });
    expect(
      normalized.nodes?.find(
        (node) => node.id === 'semantic_model.valid_project.orders_semantic',
      )?.metadata,
    ).toMatchObject({
      governance: {
        kind: 'asset',
        assetKind: 'semantic',
      },
    });
    expect(
      normalized.nodes?.find(
        (node) => node.id === 'saved_query.valid_project.orders_saved_query',
      )?.metadata,
    ).toMatchObject({
      governance: {
        kind: 'asset',
        assetKind: 'semantic',
      },
    });
    expect(normalized.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNodeId: 'model.valid_project.orders',
          targetNodeId: 'source.valid_project.raw.orders',
        }),
        expect.objectContaining({
          sourceNodeId: 'model.valid_project.orders',
          targetNodeId: 'seed.valid_project.countries',
        }),
        expect.objectContaining({
          sourceNodeId: 'snapshot.valid_project.orders_snapshot',
          targetNodeId: 'model.valid_project.orders',
        }),
      ]),
    );
    expect(
      normalized.relations?.some(
        (relation) =>
          relation.sourceNodeId ===
            'exposure.valid_project.executive_dashboard' ||
          relation.targetNodeId ===
            'exposure.valid_project.executive_dashboard' ||
          relation.sourceNodeId === 'metric.valid_project.total_revenue' ||
          relation.targetNodeId === 'metric.valid_project.total_revenue' ||
          relation.sourceNodeId ===
            'semantic_model.valid_project.orders_semantic' ||
          relation.targetNodeId ===
            'semantic_model.valid_project.orders_semantic' ||
          relation.sourceNodeId ===
            'saved_query.valid_project.orders_saved_query' ||
          relation.targetNodeId ===
            'saved_query.valid_project.orders_saved_query',
      ),
    ).toBe(false);
    expect(workspaceExpansion?.data.testEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uniqueId: 'test.valid_project.not_null_orders_order_id',
        }),
      ]),
    );
    expect(workspaceExpansion?.data.semanticResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uniqueId: 'exposure.valid_project.executive_dashboard',
          resourceType: 'exposure',
          role: 'consumer-context',
          dependsOnNodeIds: ['model.valid_project.orders'],
          subtype: 'dashboard',
        }),
        expect.objectContaining({
          uniqueId: 'metric.valid_project.total_revenue',
          resourceType: 'metric',
          role: 'semantic-asset',
          canonicalNodeId: 'metric.valid_project.total_revenue',
          dependsOnNodeIds: ['model.valid_project.orders'],
          description: 'Total revenue metric',
        }),
        expect.objectContaining({
          uniqueId: 'semantic_model.valid_project.orders_semantic',
          resourceType: 'semantic_model',
          role: 'semantic-asset',
          canonicalNodeId: 'semantic_model.valid_project.orders_semantic',
          dependsOnNodeIds: ['model.valid_project.orders'],
          description: 'Orders semantic model',
        }),
        expect.objectContaining({
          uniqueId: 'saved_query.valid_project.orders_saved_query',
          resourceType: 'saved_query',
          role: 'semantic-asset',
          canonicalNodeId: 'saved_query.valid_project.orders_saved_query',
          dependsOnNodeIds: ['semantic_model.valid_project.orders_semantic'],
          description: 'Published orders saved query',
        }),
      ]),
    );
    expect(
      normalized.diagnostics?.some(
        (diagnostic) =>
          diagnostic.code === 'governance.dbt_adapter.skipped_resource_type' ||
          diagnostic.code ===
            'governance.dbt_adapter.unsupported_resource_shape',
      ),
    ).toBe(false);
  });

  it('projects companion nested governance metadata for models into canonical fields', () => {
    const node = normalizeSyntheticNode({
      resource_type: 'model',
      unique_id: 'model.valid_project.synthetic_companion_model',
      name: 'synthetic_companion_model',
      relation_name: '"analytics"."marts"."synthetic_companion_model"',
      description: 'Synthetic companion model',
      tests: ['not_null:id'],
      config: {
        materialized: 'table',
        contract: {
          enforced: true,
        },
      },
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
        customFlag: 'preserved',
      },
    });

    expect(node.classification).toMatchObject({
      domain: 'sales',
      layer: 'marts',
    });
    expect(node.ownership).toEqual({
      team: 'analytics',
      source: 'dbt-manifest',
    });
    expect(node.metadata).toMatchObject({
      documentation: true,
    });
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
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
        customFlag: 'preserved',
      },
      resolvedGovernanceMeta: {
        domain: 'sales',
        layer: 'marts',
        owner: {
          team: 'analytics',
        },
        criticality: 'high',
        publicInterface: true,
        crossDomainApproved: false,
        provenance: {
          domain: 'table.meta.anarchitects.governance',
          layer: 'table.meta.anarchitects.governance',
          owner: 'table.meta.anarchitects.governance',
          criticality: 'table.meta.anarchitects.governance',
          publicInterface: 'table.meta.anarchitects.governance',
          crossDomainApproved: 'table.meta.anarchitects.governance',
        },
      },
    });
  });

  it('projects table-level companion metadata for source nodes into canonical fields', () => {
    const node = normalizeSyntheticNode({
      resource_type: 'source',
      unique_id: 'source.valid_project.raw.synthetic_companion_source',
      name: 'synthetic_companion_source',
      source_name: 'raw',
      relation_name: '"warehouse"."raw"."synthetic_companion_source"',
      description: 'Synthetic companion source',
      tests: ['freshness'],
      meta: {
        anarchitects: {
          governance: {
            layer: 'staging',
            domain: 'sales',
            owner: {
              team: 'analytics-engineering',
            },
            criticality: 'medium',
            publicInterface: false,
            crossDomainApproved: true,
          },
        },
      },
      source_meta: {
        anarchitects: {
          governance: {
            layer: 'landing',
            domain: 'source-sales',
          },
        },
      },
    });

    expect(node.classification).toMatchObject({
      domain: 'sales',
      layer: 'staging',
    });
    expect(node.ownership).toEqual({
      team: 'analytics-engineering',
      source: 'dbt-manifest',
    });
    expect(node.metadata).toMatchObject({
      governance: {
        kind: 'asset',
      },
      documentation: true,
    });
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
      meta: {
        anarchitects: {
          governance: {
            layer: 'staging',
            domain: 'sales',
            owner: {
              team: 'analytics-engineering',
            },
            criticality: 'medium',
            publicInterface: false,
            crossDomainApproved: true,
          },
        },
      },
      resolvedGovernanceMeta: {
        domain: 'sales',
        layer: 'staging',
        owner: {
          team: 'analytics-engineering',
        },
        criticality: 'medium',
        publicInterface: false,
        crossDomainApproved: true,
        provenance: {
          domain: 'table.meta.anarchitects.governance',
          layer: 'table.meta.anarchitects.governance',
          owner: 'table.meta.anarchitects.governance',
          criticality: 'table.meta.anarchitects.governance',
          publicInterface: 'table.meta.anarchitects.governance',
          crossDomainApproved: 'table.meta.anarchitects.governance',
        },
      },
      sourceMeta: {
        anarchitects: {
          governance: {
            layer: 'landing',
            domain: 'source-sales',
          },
        },
      },
    });
  });

  it('prefers companion governance projection over legacy governance metadata while preserving both', () => {
    const node = normalizeSyntheticNode({
      resource_type: 'model',
      unique_id: 'model.valid_project.synthetic_compatible_model',
      name: 'synthetic_compatible_model',
      relation_name: '"analytics"."marts"."synthetic_compatible_model"',
      description: 'Synthetic compatibility model',
      tests: ['not_null:id'],
      config: {
        materialized: 'table',
        contract: {
          enforced: true,
        },
      },
      meta: {
        governance: {
          layer: 'mart',
          domain: 'finance',
          owner: 'finance-platform',
        },
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
    });

    expect(node.classification).toMatchObject({
      layer: 'marts',
      domain: 'sales',
    });
    expect(node.ownership).toEqual({
      team: 'analytics',
      source: 'dbt-manifest',
    });
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
      meta: {
        governance: {
          layer: 'mart',
          domain: 'finance',
          owner: 'finance-platform',
        },
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
      resolvedGovernanceMeta: {
        domain: 'sales',
        layer: 'marts',
        owner: {
          team: 'analytics',
        },
        criticality: 'high',
        publicInterface: true,
        crossDomainApproved: false,
      },
    });
  });

  it('projects companion governance metadata from config.meta into canonical fields', () => {
    const node = normalizeSyntheticNode({
      resource_type: 'model',
      unique_id: 'model.valid_project.synthetic_config_companion_model',
      name: 'synthetic_config_companion_model',
      relation_name: '"analytics"."marts"."synthetic_config_companion_model"',
      description: 'Synthetic config companion model',
      tests: ['not_null:id'],
      config: {
        materialized: 'table',
        contract: {
          enforced: true,
        },
        meta: {
          anarchitects: {
            governance: {
              layer: 'marts',
              domain: 'operations',
              owner: {
                team: 'platform-analytics',
              },
              criticality: 'high',
            },
          },
        },
      },
    });

    expect(node.classification).toMatchObject({
      domain: 'operations',
      layer: 'marts',
    });
    expect(node.ownership).toEqual({
      team: 'platform-analytics',
      source: 'dbt-manifest',
    });
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
      meta: {},
      resolvedGovernanceMeta: {
        domain: 'operations',
        layer: 'marts',
        owner: {
          team: 'platform-analytics',
        },
        criticality: 'high',
        provenance: {
          domain: 'config.meta.anarchitects.governance',
          layer: 'config.meta.anarchitects.governance',
          owner: 'config.meta.anarchitects.governance',
          criticality: 'config.meta.anarchitects.governance',
        },
      },
    });
  });

  it('keeps normalization valid when companion metadata is absent', () => {
    const context = mustResolveContext('valid-project');
    const normalized = normalizeDbtArtifacts(context, {
      manifest: buildSyntheticManifest('model.valid_project.synthetic_plain', {
        resource_type: 'model',
        unique_id: 'model.valid_project.synthetic_plain',
        name: 'synthetic_plain',
        relation_name: '"analytics"."marts"."synthetic_plain"',
        description: 'Plain synthetic model',
        tests: ['not_null:id'],
        config: {
          materialized: 'table',
          contract: {
            enforced: true,
          },
        },
      }),
      projectConfig: {
        name: 'valid_project',
      },
    });
    const node = normalized.nodes?.find(
      (entry) => entry.id === 'model.valid_project.synthetic_plain',
    );

    expect(node).toBeDefined();
    if (!node) {
      throw new Error('Expected synthetic_plain node to normalize.');
    }
    expect(node?.classification).toBeUndefined();
    expect(node?.ownership).toBeUndefined();
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
      meta: {},
    });
    expect(normalized.diagnostics).toEqual([]);
  });

  it('maps model, seed, snapshot, and source lineage through canonical relations', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);

    expect(normalized.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dbt:lineage:model.valid_project.stg_orders->source.valid_project.raw.orders',
          sourceNodeId: 'model.valid_project.stg_orders',
          targetNodeId: 'source.valid_project.raw.orders',
          kind: 'dependency',
          extensions: {
            'governance-extension:dbt': expect.objectContaining({
              data: expect.objectContaining({
                kind: 'relation',
                relationKind: 'lineage',
                source: expect.objectContaining({
                  identity: expect.objectContaining({
                    uniqueId: 'model.valid_project.stg_orders',
                    resourceType: 'model',
                  }),
                }),
                target: expect.objectContaining({
                  identity: expect.objectContaining({
                    uniqueId: 'source.valid_project.raw.orders',
                    resourceType: 'source',
                    sourceName: 'raw',
                  }),
                }),
                lineage: expect.objectContaining({
                  dependencyKind: 'source',
                  artifactDependencyKind: 'depends_on.nodes',
                  source: {
                    packageName: 'valid_project',
                    sourceName: 'raw',
                    name: 'orders',
                  },
                }),
              }),
            }),
          },
        }),
        expect.objectContaining({
          id: 'dbt:lineage:model.valid_project.orders->model.valid_project.stg_orders',
          sourceNodeId: 'model.valid_project.orders',
          targetNodeId: 'model.valid_project.stg_orders',
          kind: 'dependency',
          extensions: {
            'governance-extension:dbt': expect.objectContaining({
              data: expect.objectContaining({
                relationKind: 'lineage',
                lineage: expect.objectContaining({
                  dependencyKind: 'ref',
                  artifactDependencyKind: 'depends_on.nodes',
                  ref: {
                    packageName: 'valid_project',
                    name: 'stg_orders',
                    fqn: ['valid_project', 'staging', 'stg_orders'],
                  },
                }),
              }),
            }),
          },
        }),
        expect.objectContaining({
          id: 'dbt:lineage:snapshot.valid_project.orders_snapshot->model.valid_project.orders',
          sourceNodeId: 'snapshot.valid_project.orders_snapshot',
          targetNodeId: 'model.valid_project.orders',
          kind: 'dependency',
        }),
      ]),
    );
    expect(normalized.relations).toHaveLength(5);
    expect(
      normalized.relations?.every((relation) => relation.kind === 'dependency'),
    ).toBe(true);
    expect(
      normalized.relations?.every(
        (relation) => !relation.id?.startsWith('dbt:tests:'),
      ),
    ).toBe(true);
    expect(
      normalized.relations?.every((relation) => {
        const expansion = relation.extensions?.['governance-extension:dbt'] as
          | DbtRelationExpansionEnvelope
          | undefined;
        return expansion?.data.relationKind !== 'tests';
      }),
    ).toBe(true);
  });

  it.each([
    {
      label: 'record.owner',
      resource: {
        owner: {
          name: 'analytics-platform',
          email: 'analytics@example.com',
        },
      },
      expected: {
        team: 'analytics-platform',
        contacts: ['analytics@example.com'],
        source: 'dbt-manifest',
      },
    },
    {
      label: 'group when record.owner is absent',
      resource: {
        group: 'finance',
      },
      expected: {
        team: 'finance',
        source: 'dbt-manifest',
      },
    },
    {
      label: 'config.meta.anarchitects.governance.owner.team',
      resource: {
        config: {
          meta: {
            anarchitects: {
              governance: {
                owner: {
                  team: 'config-companion-owner',
                },
              },
            },
          },
        },
      },
      expected: {
        team: 'config-companion-owner',
        source: 'dbt-manifest',
      },
    },
    {
      label: 'meta.anarchitects.governance.owner.team',
      resource: {
        meta: {
          anarchitects: {
            governance: {
              owner: {
                team: 'resource-companion-owner',
              },
            },
          },
        },
      },
      expected: {
        team: 'resource-companion-owner',
        source: 'dbt-manifest',
      },
    },
    {
      label: 'config.meta.anarchitects.governance.owner as string',
      resource: {
        config: {
          meta: {
            anarchitects: {
              governance: {
                owner: 'config-companion-owner-string',
              },
            },
          },
        },
      },
      expected: {
        team: 'config-companion-owner-string',
        source: 'dbt-manifest',
      },
    },
    {
      label: 'meta.anarchitects.governance.owner.name',
      resource: {
        meta: {
          anarchitects: {
            governance: {
              owner: {
                name: 'resource-companion-owner-name',
              },
            },
          },
        },
      },
      expected: {
        team: 'resource-companion-owner-name',
        source: 'dbt-manifest',
      },
    },
    {
      label: 'config.meta.governance.owner',
      resource: {
        config: {
          meta: {
            governance: {
              owner: 'platform-governance',
            },
          },
        },
      },
      expected: {
        team: 'platform-governance',
        source: 'dbt-manifest',
      },
    },
    {
      label: 'config.meta.owner',
      resource: {
        config: {
          meta: {
            owner: 'config-meta-owner',
          },
        },
      },
      expected: {
        team: 'config-meta-owner',
        source: 'dbt-manifest',
      },
    },
    {
      label: 'meta.governance.owner',
      resource: {
        meta: {
          governance: {
            owner: 'resource-governance-owner',
          },
        },
      },
      expected: {
        team: 'resource-governance-owner',
        source: 'dbt-manifest',
      },
    },
    {
      label: 'meta.owner',
      resource: {
        meta: {
          owner: 'resource-meta-owner',
        },
      },
      expected: {
        team: 'resource-meta-owner',
        source: 'dbt-manifest',
      },
    },
    {
      label: 'missing owner',
      resource: {},
      expected: undefined,
    },
  ])('maps canonical ownership from $label', ({ resource, expected }) => {
    expect(normalizeSyntheticNode(resource).ownership).toEqual(expected);
  });

  it('applies owner precedence before dbt meta ownership sources', () => {
    expect(
      normalizeSyntheticNode({
        owner: 'record-owner',
        group: 'resource-group',
        config: {
          meta: {
            anarchitects: {
              governance: {
                owner: {
                  team: 'config-companion-owner',
                },
              },
            },
            governance: {
              owner: 'config-governance-owner',
            },
            owner: 'config-meta-owner',
          },
        },
        meta: {
          anarchitects: {
            governance: {
              owner: {
                team: 'resource-companion-owner',
              },
            },
          },
          governance: {
            owner: 'resource-governance-owner',
          },
          owner: 'resource-meta-owner',
        },
      }).ownership,
    ).toEqual({
      team: 'record-owner',
      source: 'dbt-manifest',
    });

    expect(
      normalizeSyntheticNode({
        group: 'resource-group',
        config: {
          meta: {
            anarchitects: {
              governance: {
                owner: {
                  team: 'config-companion-owner',
                },
              },
            },
            governance: {
              owner: 'config-governance-owner',
            },
            owner: 'config-meta-owner',
          },
        },
        meta: {
          anarchitects: {
            governance: {
              owner: {
                team: 'resource-companion-owner',
              },
            },
          },
          governance: {
            owner: 'resource-governance-owner',
          },
          owner: 'resource-meta-owner',
        },
      }).ownership,
    ).toEqual({
      team: 'resource-group',
      source: 'dbt-manifest',
    });

    expect(
      normalizeSyntheticNode({
        config: {
          meta: {
            anarchitects: {
              governance: {
                owner: {
                  team: 'config-companion-owner',
                },
              },
            },
            governance: {
              owner: 'config-governance-owner',
            },
            owner: 'config-meta-owner',
          },
        },
        meta: {
          anarchitects: {
            governance: {
              owner: {
                team: 'resource-companion-owner',
              },
            },
          },
          governance: {
            owner: 'resource-governance-owner',
          },
          owner: 'resource-meta-owner',
        },
      }).ownership,
    ).toEqual({
      team: 'config-companion-owner',
      source: 'dbt-manifest',
    });
  });

  it('projects companion owner email into canonical ownership contacts', () => {
    const node = normalizeSyntheticNode({
      resource_type: 'model',
      unique_id: 'model.valid_project.synthetic_companion_owner_email',
      name: 'synthetic_companion_owner_email',
      relation_name: '"analytics"."marts"."synthetic_companion_owner_email"',
      description: 'Synthetic companion owner email model',
      tests: ['not_null:id'],
      config: {
        materialized: 'table',
        contract: {
          enforced: true,
        },
      },
      meta: {
        anarchitects: {
          governance: {
            owner: {
              team: 'analytics',
              email: 'analytics@example.com',
            },
          },
        },
      },
    });

    expect(node.ownership).toEqual({
      team: 'analytics',
      contacts: ['analytics@example.com'],
      source: 'dbt-manifest',
    });
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
      meta: {
        anarchitects: {
          governance: {
            owner: {
              team: 'analytics',
              email: 'analytics@example.com',
            },
          },
        },
      },
      resolvedGovernanceMeta: {
        owner: {
          team: 'analytics',
          email: 'analytics@example.com',
        },
        provenance: {
          owner: 'table.meta.anarchitects.governance',
        },
      },
    });
  });

  it('supports companion owner string, name, and source-level fallback shapes', () => {
    const stringOwnerNode = normalizeSyntheticNode({
      resource_type: 'model',
      unique_id: 'model.valid_project.synthetic_companion_owner_string',
      name: 'synthetic_companion_owner_string',
      relation_name: '"analytics"."marts"."synthetic_companion_owner_string"',
      description: 'Synthetic companion owner string model',
      tests: ['not_null:id'],
      config: {
        materialized: 'table',
        contract: {
          enforced: true,
        },
      },
      meta: {
        anarchitects: {
          governance: {
            owner: 'analytics',
          },
        },
      },
    });
    const nameOwnerNode = normalizeSyntheticNode({
      resource_type: 'model',
      unique_id: 'model.valid_project.synthetic_companion_owner_name',
      name: 'synthetic_companion_owner_name',
      relation_name: '"analytics"."marts"."synthetic_companion_owner_name"',
      description: 'Synthetic companion owner name model',
      tests: ['not_null:id'],
      config: {
        materialized: 'table',
        contract: {
          enforced: true,
        },
      },
      meta: {
        anarchitects: {
          governance: {
            owner: {
              name: 'analytics',
            },
          },
        },
      },
    });
    const sourceFallbackNode = normalizeSyntheticNode({
      resource_type: 'source',
      unique_id: 'source.valid_project.raw.synthetic_source_owner_name_case',
      name: 'synthetic_source_owner_name_case',
      source_name: 'raw',
      relation_name: '"warehouse"."raw"."synthetic_source_owner_name_case"',
      tests: ['freshness'],
      source_meta: {
        anarchitects: {
          governance: {
            owner: {
              name: 'raw-analytics',
              email: 'raw-analytics@example.com',
            },
          },
        },
      },
    });

    expect(stringOwnerNode.ownership).toEqual({
      team: 'analytics',
      source: 'dbt-manifest',
    });
    expect(nameOwnerNode.ownership).toEqual({
      team: 'analytics',
      source: 'dbt-manifest',
    });
    expect(sourceFallbackNode.ownership).toEqual({
      team: 'raw-analytics',
      contacts: ['raw-analytics@example.com'],
      source: 'dbt-manifest',
    });
    expect(
      getDbtNodeExpansion(sourceFallbackNode)?.data.resource,
    ).toMatchObject({
      resolvedGovernanceMeta: {
        owner: {
          name: 'raw-analytics',
          email: 'raw-analytics@example.com',
        },
        provenance: {
          owner: 'source.meta.anarchitects.governance',
        },
      },
    });
  });

  it('inherits source-level companion governance metadata for source tables when table metadata is absent', () => {
    const node = normalizeSyntheticNode({
      resource_type: 'source',
      unique_id: 'source.valid_project.raw.synthetic_source_companion_case',
      name: 'synthetic_source_companion_case',
      source_name: 'raw',
      meta: {
        lineage: 'external',
      },
      source_meta: {
        anarchitects: {
          governance: {
            owner: {
              team: 'raw-data-team',
            },
            domain: 'finance',
            layer: 'raw',
            criticality: 'high',
            publicInterface: true,
            crossDomainApproved: false,
          },
        },
      },
    });

    expect(node.ownership).toEqual({
      team: 'raw-data-team',
      source: 'dbt-manifest',
    });
    expect(node.classification).toMatchObject({
      domain: 'finance',
      layer: 'raw',
    });
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
      meta: {
        lineage: 'external',
      },
      sourceMeta: {
        anarchitects: {
          governance: {
            owner: {
              team: 'raw-data-team',
            },
            domain: 'finance',
            layer: 'raw',
            criticality: 'high',
            publicInterface: true,
            crossDomainApproved: false,
          },
        },
      },
      resolvedGovernanceMeta: {
        owner: {
          team: 'raw-data-team',
        },
        domain: 'finance',
        layer: 'raw',
        criticality: 'high',
        publicInterface: true,
        crossDomainApproved: false,
        provenance: {
          owner: 'source.meta.anarchitects.governance',
          domain: 'source.meta.anarchitects.governance',
          layer: 'source.meta.anarchitects.governance',
          criticality: 'source.meta.anarchitects.governance',
          publicInterface: 'source.meta.anarchitects.governance',
          crossDomainApproved: 'source.meta.anarchitects.governance',
        },
      },
    });
  });

  it('inherits source-level governance metadata for source tables', () => {
    const node = normalizeSyntheticNode({
      resource_type: 'source',
      unique_id: 'source.valid_project.raw.synthetic_source_case',
      name: 'synthetic_source_case',
      source_name: 'raw',
      meta: {
        lineage: 'external',
      },
      source_meta: {
        governance: {
          owner: 'raw-data-team',
          domain: 'finance',
          layer: 'raw',
          criticality: 'high',
        },
      },
    });

    expect(node.ownership).toEqual({
      team: 'raw-data-team',
      source: 'dbt-manifest',
    });
    expect(node.classification).toMatchObject({
      domain: 'finance',
      layer: 'raw',
    });
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
      meta: {
        lineage: 'external',
      },
      sourceMeta: {
        governance: {
          owner: 'raw-data-team',
          domain: 'finance',
          layer: 'raw',
          criticality: 'high',
        },
      },
      resolvedGovernanceMeta: {
        owner: 'raw-data-team',
        domain: 'finance',
        layer: 'raw',
        criticality: 'high',
        provenance: {
          owner: 'source.meta.governance',
          domain: 'source.meta.governance',
          layer: 'source.meta.governance',
          criticality: 'source.meta.governance',
        },
      },
    });
  });

  it('prefers table-level source metadata over source-level metadata', () => {
    const node = normalizeSyntheticNode({
      resource_type: 'source',
      unique_id: 'source.valid_project.raw.synthetic_source_precedence_case',
      name: 'synthetic_source_precedence_case',
      source_name: 'raw',
      meta: {
        governance: {
          owner: 'table-governance-owner',
          domain: 'table-domain',
          layer: 'table-layer',
          criticality: 'critical',
        },
        owner: 'table-meta-owner',
      },
      source_meta: {
        governance: {
          owner: 'source-governance-owner',
          domain: 'source-domain',
          layer: 'source-layer',
          criticality: 'high',
        },
        owner: 'source-meta-owner',
      },
    });

    expect(node.ownership).toEqual({
      team: 'table-governance-owner',
      source: 'dbt-manifest',
    });
    expect(node.classification).toMatchObject({
      domain: 'table-domain',
      layer: 'table-layer',
    });
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
      meta: {
        governance: {
          owner: 'table-governance-owner',
          domain: 'table-domain',
          layer: 'table-layer',
          criticality: 'critical',
        },
        owner: 'table-meta-owner',
      },
      sourceMeta: {
        governance: {
          owner: 'source-governance-owner',
          domain: 'source-domain',
          layer: 'source-layer',
          criticality: 'high',
        },
        owner: 'source-meta-owner',
      },
      resolvedGovernanceMeta: {
        owner: 'table-governance-owner',
        domain: 'table-domain',
        layer: 'table-layer',
        criticality: 'critical',
        provenance: {
          owner: 'table.meta.governance',
          domain: 'table.meta.governance',
          layer: 'table.meta.governance',
          criticality: 'table.meta.governance',
        },
      },
    });
  });

  it('inherits plain source-level metadata when governance namespace is absent', () => {
    const node = normalizeSyntheticNode({
      resource_type: 'source',
      unique_id: 'source.valid_project.raw.synthetic_source_plain_meta_case',
      name: 'synthetic_source_plain_meta_case',
      source_name: 'raw',
      meta: {
        lineage: 'external',
      },
      source_meta: {
        owner: 'source-meta-owner',
        domain: 'source-meta-domain',
        layer: 'source-meta-layer',
        criticality: 'medium',
      },
    });

    expect(node.ownership).toEqual({
      team: 'source-meta-owner',
      source: 'dbt-manifest',
    });
    expect(node.classification).toMatchObject({
      domain: 'source-meta-domain',
      layer: 'source-meta-layer',
    });
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
      meta: {
        lineage: 'external',
      },
      sourceMeta: {
        owner: 'source-meta-owner',
        domain: 'source-meta-domain',
        layer: 'source-meta-layer',
        criticality: 'medium',
      },
      resolvedGovernanceMeta: {
        owner: 'source-meta-owner',
        domain: 'source-meta-domain',
        layer: 'source-meta-layer',
        criticality: 'medium',
        provenance: {
          owner: 'source.meta',
          domain: 'source.meta',
          layer: 'source.meta',
          criticality: 'source.meta',
        },
      },
    });
  });

  it('prefers governance namespaced source table metadata over plain meta at the same level', () => {
    const node = normalizeSyntheticNode({
      resource_type: 'source',
      unique_id:
        'source.valid_project.raw.synthetic_source_governance_namespace_case',
      name: 'synthetic_source_governance_namespace_case',
      source_name: 'raw',
      meta: {
        governance: {
          owner: 'table-governance-owner',
          domain: 'table-governance-domain',
          layer: 'table-governance-layer',
          criticality: 'critical',
        },
        owner: 'table-meta-owner',
        domain: 'table-meta-domain',
        layer: 'table-meta-layer',
        criticality: 'high',
      },
      source_meta: {
        governance: {
          owner: 'source-governance-owner',
        },
        owner: 'source-meta-owner',
      },
    });

    expect(node.ownership).toEqual({
      team: 'table-governance-owner',
      source: 'dbt-manifest',
    });
    expect(node.classification).toMatchObject({
      domain: 'table-governance-domain',
      layer: 'table-governance-layer',
    });
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
      meta: {
        governance: {
          owner: 'table-governance-owner',
          domain: 'table-governance-domain',
          layer: 'table-governance-layer',
          criticality: 'critical',
        },
        owner: 'table-meta-owner',
        domain: 'table-meta-domain',
        layer: 'table-meta-layer',
        criticality: 'high',
      },
      sourceMeta: {
        governance: {
          owner: 'source-governance-owner',
        },
        owner: 'source-meta-owner',
      },
      resolvedGovernanceMeta: {
        owner: 'table-governance-owner',
        domain: 'table-governance-domain',
        layer: 'table-governance-layer',
        criticality: 'critical',
        provenance: {
          owner: 'table.meta.governance',
          domain: 'table.meta.governance',
          layer: 'table.meta.governance',
          criticality: 'table.meta.governance',
        },
      },
    });
  });

  it('keeps dbt source metadata missing when no table or source governance fields are present', () => {
    const node = normalizeSyntheticNode({
      resource_type: 'source',
      unique_id:
        'source.valid_project.raw.synthetic_source_missing_metadata_case',
      name: 'synthetic_source_missing_metadata_case',
      source_name: 'raw',
      meta: {
        lineage: 'external',
      },
      source_meta: {
        freshness: 'daily',
      },
    });

    expect(node.ownership).toBeUndefined();
    expect(node.classification).toBeUndefined();
    expect(getDbtNodeExpansion(node)?.data.resource).toMatchObject({
      meta: {
        lineage: 'external',
      },
      sourceMeta: {
        freshness: 'daily',
      },
    });
    expect(getDbtNodeExpansion(node)?.data.resource).not.toHaveProperty(
      'resolvedGovernanceMeta',
    );
  });

  it('keeps relation ids deterministic for equivalent manifest input orderings', () => {
    const context = mustResolveContext('layered-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);
    const reordered = normalizeDbtArtifacts(context, {
      ...artifacts,
      manifest: {
        ...artifacts.manifest,
        nodes: Object.fromEntries(
          Object.entries(artifacts.manifest.nodes).reverse(),
        ),
        sources: Object.fromEntries(
          Object.entries(artifacts.manifest.sources ?? {}).reverse(),
        ),
      },
    });

    expect(reordered.nodes).toEqual(normalized.nodes);
    expect(reordered.relations).toEqual(normalized.relations);
    expect(
      normalized.relations?.filter(
        (relation) =>
          relation.targetNodeId === 'model.layered_project.int_orders_enriched',
      ),
    ).toHaveLength(1);
    expect(normalized.relations?.map((relation) => relation.id)).toEqual(
      expect.arrayContaining([
        'dbt:lineage:model.layered_project.fct_orders->model.layered_project.int_orders_enriched',
        'dbt:lineage:model.layered_project.int_orders_enriched->model.layered_project.stg_orders',
        'dbt:lineage:model.layered_project.int_orders_enriched->model.layered_project.stg_customers',
        'dbt:lineage:model.layered_project.int_orders_enriched->seed.layered_project.country_codes',
      ]),
    );
  });

  it('emits node and relation diagnostics with canonical references', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);

    expect(normalized.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.incomplete_metadata',
          severity: 'info',
          kind: 'observation',
          dbtUniqueId: 'model.valid_project.unresolved_consumer',
          reference: {
            nodeId: 'model.valid_project.unresolved_consumer',
          },
          details: expect.objectContaining({
            uniqueId: 'model.valid_project.unresolved_consumer',
            missingFields: expect.arrayContaining([
              'relation.relationName',
              'validation.tests',
              'validation.contract',
              'documentation.description',
            ]),
          }),
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.partial_normalization',
          message: expect.stringContaining('normalization'),
          details: expect.objectContaining({
            normalizedCount: 9,
            skippedCount: 1,
            invalidCount: 1,
          }),
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.unresolved_dependency_target',
          severity: 'warning',
          dbtUniqueId: 'model.valid_project.unresolved_consumer',
          reference: {
            nodeId: 'model.valid_project.unresolved_consumer',
            relatedNodeIds: [
              'model.valid_project.unresolved_consumer',
              'model.valid_project.missing_upstream',
            ],
          },
          message: expect.stringContaining('relation target node'),
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.dependency_target_not_normalized',
          severity: 'warning',
          dbtUniqueId: 'model.valid_project.invalid_target_consumer',
          reference: {
            nodeId: 'model.valid_project.invalid_target_consumer',
            relatedNodeIds: [
              'model.valid_project.invalid_target_consumer',
              'model.valid_project.missing_identity',
            ],
          },
          message: expect.stringContaining('relation target node'),
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.unsupported_dependency_shape',
          severity: 'warning',
          dbtUniqueId: 'model.valid_project.malformed_depends_on',
          reference: {
            nodeId: 'model.valid_project.malformed_depends_on',
          },
          message: expect.stringContaining('relation metadata'),
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.partial_dependency_mapping',
          message: expect.stringContaining('relation mapping'),
          details: expect.objectContaining({
            mappedCount: 5,
            unresolvedCount: 1,
            notNormalizedCount: 1,
            unsupportedCount: 1,
          }),
        }),
      ]),
    );
  });

  it('emits dbt expansion envelopes using the stable extension protocol shape', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);

    const workspaceExpansion = normalized.extensions?.[
      'governance-extension:dbt'
    ] as DbtWorkspaceExpansionEnvelope | undefined;
    const resourceNodeExpansion = normalized.nodes
      ?.flatMap((node) => {
        const expansion = node.extensions?.['governance-extension:dbt'] as
          | DbtNodeExpansionEnvelope
          | undefined;
        return expansion?.data.kind === 'node' &&
          expansion.data.nodeKind === 'resource'
          ? [expansion]
          : [];
      })
      .at(0);
    const relationExpansion = normalized.relations
      ?.flatMap((relation) => {
        const expansion = relation.extensions?.['governance-extension:dbt'] as
          | DbtRelationExpansionEnvelope
          | undefined;
        return expansion?.data.kind === 'relation' ? [expansion] : [];
      })
      .at(0);

    [workspaceExpansion, resourceNodeExpansion, relationExpansion].forEach(
      (expansion) => {
        expect(expansion).toBeDefined();
        expect(expansion).toMatchObject({
          extensionId: 'governance-extension:dbt',
          contractVersion: '1',
        });
      },
    );

    expect(workspaceExpansion).toMatchObject({
      data: {
        kind: 'workspace',
        technology: 'dbt',
        projectName: 'valid_project',
      },
    });
    expect(resourceNodeExpansion).toMatchObject({
      data: {
        kind: 'node',
        technology: 'dbt',
        nodeKind: 'resource',
      },
    });
    expect(relationExpansion).toMatchObject({
      data: {
        kind: 'relation',
        technology: 'dbt',
      },
    });
  });
});

function mustResolveContext(fixtureName: string) {
  const context = resolveDbtProjectContext({
    paths: {
      projectDir: path.join(fixturesRoot, fixtureName),
    },
  });

  expect(context).toBeDefined();
  if (!context) {
    throw new Error(
      `Expected fixture "${fixtureName}" to resolve a dbt context.`,
    );
  }

  return context;
}

function mustLoadArtifacts(
  context: NonNullable<ReturnType<typeof resolveDbtProjectContext>>,
) {
  const loaded = loadDbtArtifacts(context);

  expect(loaded.artifacts).toBeDefined();
  if (!loaded.artifacts) {
    throw new Error('Expected fixture to load dbt artifacts.');
  }

  return loaded.artifacts;
}

function normalizeSyntheticNode(resource: DbtManifestResource) {
  const context = mustResolveContext('valid-project');
  const uniqueId =
    typeof resource.unique_id === 'string'
      ? resource.unique_id
      : resource.resource_type === 'source'
        ? 'source.valid_project.raw.synthetic_source_case'
        : 'model.valid_project.synthetic_owner_case';
  const normalized = normalizeDbtArtifacts(context, {
    manifest: buildSyntheticManifest(uniqueId, resource),
    projectConfig: {
      name: 'valid_project',
    },
  });
  const node = normalized.nodes?.find((entry) => entry.id === uniqueId);

  expect(node).toBeDefined();
  if (!node) {
    throw new Error('Expected synthetic dbt resource node to normalize.');
  }

  return node;
}

function getDbtNodeExpansion(node: { extensions?: Record<string, unknown> }) {
  return node.extensions?.['governance-extension:dbt'] as
    | DbtNodeExpansionEnvelope
    | undefined;
}

function buildSyntheticManifest(
  uniqueId: string,
  resource: DbtManifestResource,
): DbtArtifacts['manifest'] {
  return buildSyntheticManifestFromResources([[uniqueId, resource]]);
}

function buildSyntheticManifestFromResources(
  resources: ReadonlyArray<readonly [string, DbtManifestResource]>,
): DbtArtifacts['manifest'] {
  const nodes: Record<string, DbtManifestResource> = {};
  const sources: Record<string, DbtManifestResource> = {};

  for (const [uniqueId, resource] of resources) {
    const resourceType =
      typeof resource.resource_type === 'string'
        ? resource.resource_type
        : 'model';
    const entry = {
      resource_type: resourceType,
      unique_id: uniqueId,
      package_name: 'valid_project',
      name: 'synthetic_owner_case',
      ...(resourceType === 'source' ? { source_name: 'synthetic_source' } : {}),
      ...resource,
    };

    if (resourceType === 'source') {
      sources[uniqueId] = entry;
      continue;
    }

    nodes[uniqueId] = entry;
  }

  return {
    metadata: {
      dbt_schema_version: 'https://schemas.getdbt.com/dbt/manifest/v12.json',
      project_name: 'valid_project',
    },
    nodes,
    ...(Object.keys(sources).length > 0 ? { sources } : {}),
  };
}
