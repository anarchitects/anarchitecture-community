import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { GovernanceWorkspaceAdapterResult } from '@anarchitects/governance-core';

import {
  detectDbtProject,
  loadDbtArtifacts,
  normalizeDbtArtifacts,
  type DbtGovernanceAdapterInput,
} from './index.js';

const fixturesRoot = fileURLToPath(
  new URL('../tests/fixtures/artifacts/', import.meta.url),
);

describe('dbt adapter flow e2e', () => {
  it('produces a canonical workspace adapter result for a simple valid dbt project', () => {
    const flow = runValidAdapterFlow('simple-project');
    const result: GovernanceWorkspaceAdapterResult = flow.result;

    expect(result.workspaceName).toBe('simple_project');
    expect(result.workspaceRoot).toBe(
      path.join(fixturesRoot, 'simple-project'),
    );
    expect(result).not.toHaveProperty('projects');
    expect(result).not.toHaveProperty('dependencies');
    expect(result.nodes).toEqual([
      expect.objectContaining({
        id: 'dbt.project.simple_project',
        name: 'simple_project',
        kind: 'project',
        technology: 'dbt',
      }),
      expect.objectContaining({
        id: 'model.simple_project.hello_world',
        name: 'hello_world',
        kind: 'resource',
        technology: 'dbt',
      }),
    ]);
    expect(result.relations).toEqual([]);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.incomplete_metadata',
          severity: 'info',
          dbtUniqueId: 'model.simple_project.hello_world',
        }),
      ]),
    );
  });

  it('maps layered resources and DAG edges through the full adapter flow', () => {
    const { result } = runValidAdapterFlow('layered-project');

    expect(result.nodes?.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        'dbt.project.layered_project',
        'model.layered_project.stg_orders',
        'model.layered_project.stg_customers',
        'model.layered_project.int_orders_enriched',
        'model.layered_project.fct_orders',
        'model.layered_project.dim_customers',
        'source.layered_project.raw.orders',
        'source.layered_project.raw.customers',
        'seed.layered_project.country_codes',
        'snapshot.layered_project.fct_orders_snapshot',
      ]),
    );

    expect(result.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNodeId: 'model.layered_project.stg_orders',
          targetNodeId: 'source.layered_project.raw.orders',
          kind: 'dependency',
        }),
        expect.objectContaining({
          sourceNodeId: 'model.layered_project.int_orders_enriched',
          targetNodeId: 'model.layered_project.stg_orders',
          kind: 'dependency',
        }),
        expect.objectContaining({
          sourceNodeId: 'model.layered_project.int_orders_enriched',
          targetNodeId: 'model.layered_project.stg_customers',
          kind: 'dependency',
        }),
        expect.objectContaining({
          sourceNodeId: 'model.layered_project.int_orders_enriched',
          targetNodeId: 'seed.layered_project.country_codes',
          kind: 'dependency',
        }),
        expect.objectContaining({
          sourceNodeId: 'model.layered_project.fct_orders',
          targetNodeId: 'model.layered_project.int_orders_enriched',
          kind: 'dependency',
        }),
      ]),
    );

    expect(
      result.relations?.filter(
        (relation) =>
          relation.sourceNodeId === 'model.layered_project.int_orders_enriched',
      ),
    ).toHaveLength(3);
    expect(result.relations?.map((relation) => relation.id)).toEqual(
      expect.arrayContaining([
        'dbt:lineage:model.layered_project.fct_orders->model.layered_project.int_orders_enriched',
      ]),
    );
  });

  it('preserves metadata-rich dbt facts for downstream extensions without rereading artifacts', () => {
    const { result } = runValidAdapterFlow('metadata-rich');
    const orderNode = result.nodes?.find(
      (node) => node.id === 'model.metadata_rich.orders',
    );
    const undocumentedNode = result.nodes?.find(
      (node) => node.id === 'model.metadata_rich.customer_health',
    );

    expect(orderNode).toMatchObject({
      extensions: {
        'governance-extension:dbt': expect.objectContaining({
          data: expect.objectContaining({
            resourceType: 'model',
            identity: expect.objectContaining({
              uniqueId: 'model.metadata_rich.orders',
              resourceType: 'model',
            }),
            resource: expect.objectContaining({
              materialization: 'table',
              group: 'finance',
              owner: {
                name: 'finance-platform',
                email: 'finance@example.com',
              },
              tags: ['finance', 'published', 'scope:analytics'],
            }),
            relation: expect.objectContaining({
              relationName: '"analytics"."marts"."orders"',
            }),
            validation: expect.objectContaining({
              tests: ['unique:order_id', 'not_null:order_id'],
              contract: {
                enforced: true,
              },
            }),
            documentation: expect.objectContaining({
              hasDescription: true,
              docsShow: true,
            }),
          }),
        }),
      },
    });

    expect(undocumentedNode).toMatchObject({
      extensions: {
        'governance-extension:dbt': expect.objectContaining({
          data: expect.objectContaining({
            documentation: {
              hasDescription: false,
              hasDocs: false,
            },
          }),
        }),
      },
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.incomplete_metadata',
          severity: 'info',
          dbtUniqueId: 'model.metadata_rich.customer_health',
        }),
      ]),
    );
  });

  it('returns structured diagnostics for a missing manifest after successful project detection', () => {
    const input = fixtureInput('missing-manifest');
    const detected = detectDbtProject(input);

    expect(detected.supported).toBe(true);
    expect(detected.context).toBeDefined();
    if (!detected.context) {
      throw new Error('Expected missing-manifest fixture to resolve.');
    }

    const loaded = loadDbtArtifacts(detected.context);

    expect(loaded.supported).toBe(false);
    expect(loaded.artifacts).toBeUndefined();
    expect(loaded.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.missing_artifact_file',
          severity: 'error',
          inputField: 'paths.manifestPath',
        }),
      ]),
    );
  });

  it('returns structured diagnostics for a malformed manifest after successful project detection', () => {
    const input = fixtureInput('malformed-manifest');
    const detected = detectDbtProject(input);

    expect(detected.supported).toBe(true);
    expect(detected.context).toBeDefined();
    if (!detected.context) {
      throw new Error('Expected malformed-manifest fixture to resolve.');
    }

    const loaded = loadDbtArtifacts(detected.context);

    expect(loaded.supported).toBe(false);
    expect(loaded.artifacts).toBeUndefined();
    expect(loaded.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.malformed_manifest_json',
          severity: 'error',
          inputField: 'paths.manifestPath',
        }),
      ]),
    );
  });

  it('surfaces unresolved dependency diagnostics while still producing a partial adapter result', () => {
    const { result } = runValidAdapterFlow('unresolved-dependency');

    expect(result.workspaceName).toBe('unresolved_dependency');
    expect(result.relations).toEqual([]);
    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dbt.project.unresolved_dependency',
          kind: 'project',
        }),
        expect.objectContaining({
          id: 'model.unresolved_dependency.orders',
          kind: 'resource',
        }),
      ]),
    );
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.unresolved_dependency_target',
          severity: 'warning',
          dbtUniqueId: 'model.unresolved_dependency.orders',
        }),
        expect.objectContaining({
          code: 'governance.dbt_adapter.partial_dependency_mapping',
          severity: 'warning',
        }),
      ]),
    );
  });

  it('surfaces skipped unsupported resource diagnostics while still returning normalized supported resources', () => {
    const { result } = runValidAdapterFlow('valid-project');

    expect(result.nodes?.map((node) => node.id)).not.toContain(
      'analysis.valid_project.model_audit',
    );
    expect(result.nodes?.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        'model.valid_project.orders',
        'source.valid_project.raw.orders',
      ]),
    );
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.skipped_resource_type',
          severity: 'warning',
          dbtUniqueId: 'analysis.valid_project.model_audit',
        }),
      ]),
    );
  });
});

function runValidAdapterFlow(fixtureName: string) {
  const input = fixtureInput(fixtureName);
  const detected = detectDbtProject(input);

  expect(detected.supported).toBe(true);
  expect(detected.context).toBeDefined();
  if (!detected.context) {
    throw new Error(`Expected fixture "${fixtureName}" to resolve.`);
  }

  const loaded = loadDbtArtifacts(detected.context);

  expect(loaded.supported).toBe(true);
  expect(loaded.artifacts).toBeDefined();
  if (!loaded.artifacts) {
    throw new Error(`Expected fixture "${fixtureName}" to load artifacts.`);
  }

  const result = normalizeDbtArtifacts(detected.context, loaded.artifacts);

  return {
    detected,
    loaded,
    result,
  };
}

function fixtureInput(fixtureName: string): DbtGovernanceAdapterInput {
  return {
    paths: {
      projectDir: path.join(fixturesRoot, fixtureName),
    },
  };
}
