import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadDbtArtifacts,
  normalizeDbtArtifacts,
  resolveDbtProjectContext,
} from './index.js';

const fixturesRoot = fileURLToPath(
  new URL('../tests/fixtures/artifacts/', import.meta.url),
);

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

  it('normalizes the dbt project, models, sources, seeds, snapshots, and exposures into canonical nodes', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);
    const nodeIds = normalized.nodes?.map((node) => node.id) ?? [];

    expect(nodeIds).toEqual(
      expect.arrayContaining([
        'dbt.project.valid_project',
        'model.valid_project.stg_orders',
        'model.valid_project.orders',
        'model.valid_project.orders_regional',
        'source.valid_project.raw.orders',
        'seed.valid_project.countries',
        'snapshot.valid_project.orders_snapshot',
        'exposure.valid_project.executive_dashboard',
      ]),
    );

    expect(
      normalized.nodes?.find((node) => node.id === 'dbt.project.valid_project'),
    ).toMatchObject({
      kind: 'dbt-project',
      technology: 'dbt',
      sourceSystem: 'dbt',
      metadata: {
        dbt: {
          identity: {
            projectName: 'valid_project',
            resourceType: 'project',
          },
          project: {
            name: 'valid_project',
            profile: 'analytics',
          },
        },
      },
    });

    expect(
      normalized.nodes?.find(
        (node) => node.id === 'model.valid_project.orders',
      ),
    ).toMatchObject({
      kind: 'dbt-model',
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
        dbt: {
          identity: {
            uniqueId: 'model.valid_project.orders',
            packageName: 'valid_project',
            resourceName: 'orders',
            resourceType: 'model',
            fullyQualifiedName: 'valid_project.marts.orders',
            fqn: ['valid_project', 'marts', 'orders'],
          },
          resource: {
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
          },
          relation: {
            database: 'analytics',
            schema: 'marts',
            alias: 'orders',
            path: 'orders.sql',
            originalFilePath: 'models/marts/orders.sql',
            relationName: '"analytics"."marts"."orders"',
          },
          validation: {
            tests: ['unique:order_id', 'not_null:order_id'],
            contract: {
              enforced: true,
              alias_types: false,
            },
          },
          documentation: {
            description: 'Normalized orders model',
            hasDescription: true,
            docsShow: true,
          },
        },
      },
    });

    expect(
      normalized.nodes?.find(
        (node) => node.id === 'source.valid_project.raw.orders',
      ),
    ).toMatchObject({
      kind: 'dbt-source',
      ownership: {
        team: 'data-eng',
      },
      metadata: {
        dbt: {
          identity: {
            uniqueId: 'source.valid_project.raw.orders',
            resourceType: 'source',
            sourceName: 'raw',
          },
          resource: {
            group: 'raw-data',
            owner: 'data-eng',
          },
          relation: {
            database: 'warehouse',
            schema: 'raw',
            relationName: '"warehouse"."raw"."orders"',
          },
          validation: {
            tests: ['freshness', 'not_null:order_id'],
          },
        },
      },
    });
  });

  it('preserves stable dbt identifiers and metadata on canonical nodes', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);
    const node = normalized.nodes?.find(
      (entry) => entry.id === 'exposure.valid_project.executive_dashboard',
    );

    expect(node).toMatchObject({
      id: 'exposure.valid_project.executive_dashboard',
      name: 'executive_dashboard',
      kind: 'dbt-exposure',
      metadata: {
        dbt: {
          identity: {
            uniqueId: 'exposure.valid_project.executive_dashboard',
            packageName: 'valid_project',
            resourceName: 'executive_dashboard',
            fullyQualifiedName: 'valid_project.executive_dashboard',
            resourceType: 'exposure',
          },
          resource: {
            owner: {
              name: 'analytics-team',
            },
            subtype: 'dashboard',
          },
        },
      },
    });
  });

  it('maps model, seed, snapshot, source, and exposure lineage through canonical relations', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);

    expect(normalized.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dbt:lineage:model.valid_project.stg_orders->source.valid_project.raw.orders',
          sourceNodeId: 'model.valid_project.stg_orders',
          targetNodeId: 'source.valid_project.raw.orders',
          kind: 'lineage',
          metadata: {
            dbt: expect.objectContaining({
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
                relationKind: 'lineage',
                dependencyKind: 'source',
                artifactDependencyKind: 'depends_on.nodes',
                source: {
                  packageName: 'valid_project',
                  sourceName: 'raw',
                  name: 'orders',
                },
              }),
            }),
          },
        }),
        expect.objectContaining({
          id: 'dbt:lineage:model.valid_project.orders->model.valid_project.stg_orders',
          sourceNodeId: 'model.valid_project.orders',
          targetNodeId: 'model.valid_project.stg_orders',
          kind: 'lineage',
          metadata: {
            dbt: expect.objectContaining({
              lineage: expect.objectContaining({
                relationKind: 'lineage',
                dependencyKind: 'ref',
                artifactDependencyKind: 'depends_on.nodes',
                ref: {
                  packageName: 'valid_project',
                  name: 'stg_orders',
                  fqn: ['valid_project', 'staging', 'stg_orders'],
                },
              }),
            }),
          },
        }),
        expect.objectContaining({
          id: 'dbt:lineage:snapshot.valid_project.orders_snapshot->model.valid_project.orders',
          sourceNodeId: 'snapshot.valid_project.orders_snapshot',
          targetNodeId: 'model.valid_project.orders',
          kind: 'lineage',
        }),
        expect.objectContaining({
          id: 'dbt:exposes:exposure.valid_project.executive_dashboard->model.valid_project.orders',
          sourceNodeId: 'exposure.valid_project.executive_dashboard',
          targetNodeId: 'model.valid_project.orders',
          kind: 'exposes',
        }),
      ]),
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
            normalizedCount: 10,
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
            mappedCount: 6,
            unresolvedCount: 1,
            notNormalizedCount: 1,
            unsupportedCount: 1,
          }),
        }),
      ]),
    );
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
