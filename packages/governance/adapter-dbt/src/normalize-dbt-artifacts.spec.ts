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
  it('maps the dbt project to a governance workspace result', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);

    expect(normalized.workspaceId).toBe('dbt:valid_project');
    expect(normalized.workspaceName).toBe('valid_project');
    expect(normalized.workspaceRoot).toBe(
      path.join(fixturesRoot, 'valid-project'),
    );
  });

  it('normalizes models, sources, seeds, snapshots, and exposures into governance nodes', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);
    const nodeIds = normalized.nodes?.map((node) => node.id) ?? [];

    expect(nodeIds).toEqual(
      expect.arrayContaining([
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
      normalized.nodes?.find(
        (node) => node.id === 'model.valid_project.orders',
      ),
    ).toMatchObject({
      kind: 'asset',
      technology: 'dbt',
      sourceSystem: 'dbt',
      tags: ['finance', 'published', 'scope:analytics'],
      metadata: {
        dbt: {
          resourceType: 'model',
          packageName: 'valid_project',
          resourceName: 'orders',
          materialization: 'table',
          fullyQualifiedName: 'valid_project.marts.orders',
          database: 'analytics',
          schema: 'marts',
          alias: 'orders',
          originalFilePath: 'models/marts/orders.sql',
          hasDescription: true,
          docsShow: true,
        },
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
        dbt: {
          resourceType: 'source',
          group: 'raw-data',
          database: 'warehouse',
          schema: 'raw',
        },
      },
    });
  });

  it('preserves stable dbt identifiers and metadata on compatibility projects', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);
    const project = normalized.projects?.find(
      (entry) => entry.id === 'exposure.valid_project.executive_dashboard',
    );

    expect(project).toMatchObject({
      id: 'exposure.valid_project.executive_dashboard',
      name: 'executive_dashboard',
      type: 'resource',
      metadata: {
        dbt: {
          uniqueId: 'exposure.valid_project.executive_dashboard',
          packageName: 'valid_project',
          resourceName: 'executive_dashboard',
          fullyQualifiedName: 'valid_project.executive_dashboard',
          resourceType: 'exposure',
          owner: {
            name: 'analytics-team',
          },
        },
      },
    });
  });

  it('maps model-to-model and model-to-source dependencies from manifest DAG metadata', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);

    expect(normalized.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceProjectId: 'model.valid_project.stg_orders',
          targetProjectId: 'source.valid_project.raw.orders',
          type: 'static',
          metadata: {
            dbt: expect.objectContaining({
              sourceUniqueId: 'model.valid_project.stg_orders',
              targetUniqueId: 'source.valid_project.raw.orders',
              dependencyKind: 'source',
              artifactDependencyKind: 'depends_on.nodes',
              source: {
                packageName: 'valid_project',
                sourceName: 'raw',
                name: 'orders',
              },
            }),
          },
        }),
        expect.objectContaining({
          sourceProjectId: 'model.valid_project.orders',
          targetProjectId: 'model.valid_project.stg_orders',
          type: 'static',
          metadata: {
            dbt: expect.objectContaining({
              sourceUniqueId: 'model.valid_project.orders',
              targetUniqueId: 'model.valid_project.stg_orders',
              dependencyKind: 'ref',
              artifactDependencyKind: 'depends_on.nodes',
              ref: {
                packageName: 'valid_project',
                name: 'stg_orders',
                fqn: ['valid_project', 'staging', 'stg_orders'],
              },
            }),
          },
        }),
      ]),
    );
  });

  it('maps layered, fan-in, fan-out, seed, snapshot, and exposure dependencies', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);
    const dependencies = normalized.dependencies ?? [];
    const relationIds =
      normalized.relations?.map((relation) => relation.id) ?? [];

    expect(dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceProjectId: 'model.valid_project.orders',
          targetProjectId: 'seed.valid_project.countries',
        }),
        expect.objectContaining({
          sourceProjectId: 'model.valid_project.orders_regional',
          targetProjectId: 'model.valid_project.orders',
        }),
        expect.objectContaining({
          sourceProjectId: 'snapshot.valid_project.orders_snapshot',
          targetProjectId: 'model.valid_project.orders',
        }),
        expect.objectContaining({
          sourceProjectId: 'exposure.valid_project.executive_dashboard',
          targetProjectId: 'model.valid_project.orders',
        }),
      ]),
    );

    expect(
      dependencies.filter(
        (dependency) =>
          dependency.targetProjectId === 'model.valid_project.orders',
      ),
    ).toHaveLength(3);
    expect(relationIds.length).toBe(dependencies.length);
    expect(relationIds[0]).toContain('legacy:');
  });

  it('emits dependency diagnostics for unresolved, unnormalized, unsupported, and partial mapping cases', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);

    expect(normalized.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.skipped_resource_type',
          details: expect.objectContaining({
            resourceType: 'analysis',
          }),
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.missing_resource_identity',
          details: expect.objectContaining({
            resourceType: 'model',
            field: 'name',
          }),
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.partial_normalization',
          details: expect.objectContaining({
            normalizedCount: 10,
            skippedCount: 1,
            invalidCount: 1,
          }),
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.unresolved_dependency_target',
          details: expect.objectContaining({
            sourceUniqueId: 'model.valid_project.unresolved_consumer',
            targetUniqueId: 'model.valid_project.missing_upstream',
          }),
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.dependency_target_not_normalized',
          details: expect.objectContaining({
            sourceUniqueId: 'model.valid_project.invalid_target_consumer',
            targetUniqueId: 'model.valid_project.missing_identity',
          }),
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.unsupported_dependency_shape',
          details: expect.objectContaining({
            sourceUniqueId: 'model.valid_project.malformed_depends_on',
            field: 'depends_on.nodes',
          }),
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.partial_dependency_mapping',
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
