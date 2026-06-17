import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateDbtGovernanceModelExpansion } from '@anarchitects/governance-extension-dbt';

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
    resource?: Record<string, unknown>;
  };
}

interface DbtRelationExpansionEnvelope {
  extensionId: string;
  contractVersion: string;
  data: {
    kind: 'relation';
    relationKind: string;
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
      kind: 'project',
      technology: 'dbt',
      sourceSystem: 'dbt',
      extensions: {
        'governance-extension:dbt': expect.objectContaining({
          data: expect.objectContaining({
            kind: 'node',
            nodeKind: 'project',
            resourceType: 'project',
            identity: expect.objectContaining({
              projectName: 'valid_project',
              resourceType: 'project',
            }),
            project: expect.objectContaining({
              name: 'valid_project',
              profile: 'analytics',
            }),
          }),
        }),
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
      kind: 'resource',
      extensions: {
        'governance-extension:dbt': expect.objectContaining({
          data: expect.objectContaining({
            resourceType: 'exposure',
            identity: expect.objectContaining({
              uniqueId: 'exposure.valid_project.executive_dashboard',
              packageName: 'valid_project',
              resourceName: 'executive_dashboard',
              fullyQualifiedName: 'valid_project.executive_dashboard',
              resourceType: 'exposure',
            }),
            resource: expect.objectContaining({
              owner: {
                name: 'analytics-team',
              },
              subtype: 'dashboard',
            }),
          }),
        }),
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
        expect.objectContaining({
          id: 'dbt:exposes:exposure.valid_project.executive_dashboard->model.valid_project.orders',
          sourceNodeId: 'exposure.valid_project.executive_dashboard',
          targetNodeId: 'model.valid_project.orders',
          kind: 'dependency',
        }),
      ]),
    );
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
            governance: {
              owner: 'config-governance-owner',
            },
            owner: 'config-meta-owner',
          },
        },
        meta: {
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
            governance: {
              owner: 'config-governance-owner',
            },
            owner: 'config-meta-owner',
          },
        },
        meta: {
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
        owner: 'raw-data-team',
        domain: 'finance',
        layer: 'raw',
        criticality: 'high',
      },
      sourceMeta: {
        governance: {
          owner: 'raw-data-team',
          domain: 'finance',
          layer: 'raw',
          criticality: 'high',
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
        owner: 'table-governance-owner',
        domain: 'table-domain',
        layer: 'table-layer',
        criticality: 'critical',
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
        owner: 'source-meta-owner',
        domain: 'source-meta-domain',
        layer: 'source-meta-layer',
        criticality: 'medium',
      },
      sourceMeta: {
        owner: 'source-meta-owner',
        domain: 'source-meta-domain',
        layer: 'source-meta-layer',
        criticality: 'medium',
      },
    });
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

  it('emits dbt expansion envelopes that remain valid for the extension validator', () => {
    const context = mustResolveContext('valid-project');
    const artifacts = mustLoadArtifacts(context);
    const normalized = normalizeDbtArtifacts(context, artifacts);

    const workspaceExpansion =
      normalized.extensions?.['governance-extension:dbt'];
    const projectNodeExpansion = normalized.nodes
      ?.flatMap((node) => {
        const expansion = node.extensions?.['governance-extension:dbt'] as
          | DbtNodeExpansionEnvelope
          | undefined;
        return expansion?.data.kind === 'node' &&
          expansion.data.nodeKind === 'project'
          ? [expansion]
          : [];
      })
      .at(0);
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

    [
      workspaceExpansion,
      projectNodeExpansion,
      resourceNodeExpansion,
      relationExpansion,
    ].forEach((expansion) => {
      expect(expansion).toBeDefined();
      expect(expansion).toMatchObject({
        extensionId: 'governance-extension:dbt',
        contractVersion: '1',
      });
      expect(validateDbtGovernanceModelExpansion(expansion)).toEqual([]);
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

  return {
    metadata: {
      dbt_schema_version: 'https://schemas.getdbt.com/dbt/manifest/v12.json',
      project_name: 'valid_project',
    },
    nodes:
      resourceType === 'source'
        ? {}
        : {
            [uniqueId]: entry,
          },
    ...(resourceType === 'source'
      ? {
          sources: {
            [uniqueId]: entry,
          },
        }
      : {}),
  };
}
