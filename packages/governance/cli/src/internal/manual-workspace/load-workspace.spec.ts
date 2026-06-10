import { mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  GenericWorkspaceLoadError,
  GenericWorkspaceValidationError,
  loadAndValidateGenericWorkspaceSchema,
  loadGenericWorkspace,
  loadGenericWorkspaceAdapterResult,
  validateGenericWorkspaceSchema,
} from './load-workspace.js';

describe('manual workspace loader', () => {
  it('loads a YAML workspace fixture into canonical workspace and adapter result', () => {
    const fixturePath = manualWorkspaceFixturePath('demo-workspace.yaml');

    const loaded = loadGenericWorkspace(fixturePath);

    expect(loaded.format).toBe('yaml');
    expect(loaded.adapterResult).toEqual({
      workspaceId: 'demo',
      workspaceName: 'demo',
      workspaceRoot: '.',
      nodes: [
        {
          id: 'customer-domain',
          name: 'customer-domain',
          root: 'src/customer/domain',
          path: 'src/customer/domain',
          tags: ['scope:customer', 'layer:domain', 'type:domain'],
          classification: {
            domain: 'customer',
            layer: 'domain',
            scope: 'customer',
          },
          metadata: {},
        },
        {
          id: 'order-domain',
          name: 'order-domain',
          kind: 'library',
          root: 'src/order/domain',
          path: 'src/order/domain',
          tags: ['scope:order', 'layer:domain', 'type:domain'],
          classification: {
            domain: 'order',
            layer: 'domain',
            scope: 'order',
          },
          metadata: {},
        },
      ],
      relations: [
        {
          id: 'customer-domain->order-domain',
          sourceNodeId: 'customer-domain',
          targetNodeId: 'order-domain',
          kind: 'dependency',
          metadata: {
            dependencyType: 'static',
          },
        },
      ],
      capabilities: [
        {
          id: 'capability:manual-workspace',
          data: {
            format: 'yaml',
            schemaVersion: 1,
          },
        },
      ],
    });
    expect(loaded.workspace).toEqual({
      id: 'demo',
      name: 'demo',
      root: '.',
      capabilities: [
        {
          id: 'capability:manual-workspace',
          data: {
            format: 'yaml',
            schemaVersion: 1,
          },
        },
      ],
      nodes: [
        {
          id: 'customer-domain',
          kind: 'unknown',
          name: 'customer-domain',
          root: 'src/customer/domain',
          path: 'src/customer/domain',
          tags: ['scope:customer', 'layer:domain', 'type:domain'],
          classification: {
            domain: 'customer',
            layer: 'domain',
            scope: 'customer',
          },
          metadata: {},
        },
        {
          id: 'order-domain',
          kind: 'library',
          name: 'order-domain',
          root: 'src/order/domain',
          path: 'src/order/domain',
          tags: ['scope:order', 'layer:domain', 'type:domain'],
          classification: {
            domain: 'order',
            layer: 'domain',
            scope: 'order',
          },
          metadata: {},
        },
      ],
      relations: [
        {
          id: 'customer-domain->order-domain',
          kind: 'dependency',
          metadata: {
            dependencyType: 'static',
          },
          sourceNodeId: 'customer-domain',
          targetNodeId: 'order-domain',
        },
      ],
    });
  });

  it('loads a JSON workspace fixture through the adapter-only API', () => {
    const fixturePath = manualWorkspaceFixturePath('demo-workspace.json');

    expect(loadGenericWorkspaceAdapterResult(fixturePath)).toMatchObject({
      workspaceId: 'demo',
      workspaceName: 'demo',
      workspaceRoot: '.',
      nodes: [
        expect.objectContaining({
          id: 'customer-domain',
          path: 'src/customer/domain',
        }),
        expect.objectContaining({
          id: 'order-domain',
          kind: 'library',
        }),
      ],
      relations: [
        {
          id: 'customer-domain->order-domain',
          sourceNodeId: 'customer-domain',
          targetNodeId: 'order-domain',
          kind: 'dependency',
        },
      ],
    });
  });

  it('rejects legacy top-level projects and dependencies without compatibility fallback', () => {
    expect(() =>
      validateGenericWorkspaceSchema({
        schemaVersion: 1,
        workspace: {
          name: 'demo',
        },
        projects: [
          {
            name: 'customer-domain',
            root: 'src/customer/domain',
            tags: [],
          },
        ],
        dependencies: [
          {
            source: 'customer-domain',
            target: 'order-domain',
            type: 'static',
          },
        ],
        extra: true,
      }),
    ).toThrow(GenericWorkspaceValidationError);

    try {
      validateGenericWorkspaceSchema({
        schemaVersion: 1,
        workspace: {
          name: 'demo',
        },
        projects: [
          {
            name: 'customer-domain',
            root: '/src/customer/domain',
            tags: [' ', 'scope:customer', 'scope:billing'],
          },
          {
            name: 'customer-domain',
            root: 'src/order/domain',
            tags: [],
            extra: true,
          },
        ],
        dependencies: [
          {
            source: 'customer-domain',
            target: 'customer-domain',
            type: 'transitive',
          },
          {
            source: 'customer-domain',
            target: 'order-domain',
            type: 'static',
          },
        ],
        extra: true,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(GenericWorkspaceValidationError);
      expect((error as GenericWorkspaceValidationError).issues).toEqual([
        {
          code: 'governance.workspace_schema.unsupported_legacy_field',
          message:
            'Legacy field "dependencies" is not supported. Use "relations" instead.',
          path: '/dependencies',
        },
        {
          code: 'governance.workspace_schema.unknown_field',
          message: 'Unknown field "extra" is not allowed.',
          path: '/extra',
        },
        {
          code: 'governance.workspace_schema.missing_required_field',
          message: 'nodes is required.',
          path: '/nodes',
        },
        {
          code: 'governance.workspace_schema.unsupported_legacy_field',
          message:
            'Legacy field "projects" is not supported. Use "nodes" instead.',
          path: '/projects',
        },
        {
          code: 'governance.workspace_schema.missing_required_field',
          message: 'relations is required.',
          path: '/relations',
        },
      ]);
    }
  });

  it('normalizes defaults and preserves metadata for valid in-memory schema input', () => {
    const schema = validateGenericWorkspaceSchema({
      schemaVersion: 1,
      workspace: {
        name: 'demo',
      },
      nodes: [
        {
          id: 'docs-site',
          name: 'docs-site',
          root: 'apps/docs-site',
          path: 'apps/docs-site',
          kind: 'application',
          tags: ['scope:platform', 'layer:app'],
          classification: {
            domain: 'platform',
            layer: 'app',
            scope: 'platform',
          },
          metadata: {
            anarchitects: {
              documentation: true,
            },
          },
        },
      ],
      relations: [],
    });

    expect(schema).toEqual({
      schemaVersion: 1,
      workspace: {
        name: 'demo',
        root: '.',
      },
      nodes: [
        {
          id: 'docs-site',
          name: 'docs-site',
          root: 'apps/docs-site',
          path: 'apps/docs-site',
          kind: 'application',
          tags: ['scope:platform', 'layer:app'],
          classification: {
            domain: 'platform',
            layer: 'app',
            scope: 'platform',
          },
          metadata: {
            anarchitects: {
              documentation: true,
            },
          },
        },
      ],
      relations: [],
    });
  });

  it('throws a deterministic parse error for malformed YAML files', () => {
    const dirPath = mkdtempSync(path.join(tmpdir(), 'manual-workspace-'));
    const filePath = path.join(dirPath, 'broken-workspace.yaml');
    writeFileSync(filePath, 'schemaVersion: 1\nworkspace: [\n', 'utf8');

    expect(() => loadGenericWorkspace(filePath)).toThrow(
      GenericWorkspaceLoadError,
    );

    try {
      loadGenericWorkspace(filePath);
    } catch (error) {
      expect(error).toEqual(
        expect.objectContaining({
          code: 'governance.workspace_loader.parse_error',
          filePath,
        }),
      );
    }
  });

  it('uses the path-based validation API with the real fixture file path', () => {
    const fixturePath = manualWorkspaceFixturePath('demo-workspace.yaml');

    expect(loadAndValidateGenericWorkspaceSchema(fixturePath)).toEqual({
      schemaVersion: 1,
      workspace: {
        id: 'demo',
        name: 'demo',
        root: '.',
      },
      nodes: [
        {
          id: 'order-domain',
          name: 'order-domain',
          root: 'src/order/domain',
          path: 'src/order/domain',
          kind: 'library',
          tags: ['scope:order', 'layer:domain', 'type:domain'],
          classification: {
            domain: 'order',
            layer: 'domain',
            scope: 'order',
          },
          metadata: {},
        },
        {
          id: 'customer-domain',
          name: 'customer-domain',
          root: 'src/customer/domain',
          path: 'src/customer/domain',
          tags: ['scope:customer', 'layer:domain', 'type:domain'],
          classification: {
            domain: 'customer',
            layer: 'domain',
            scope: 'customer',
          },
          metadata: {},
        },
      ],
      relations: [
        {
          id: 'customer-domain->order-domain',
          sourceNodeId: 'customer-domain',
          targetNodeId: 'order-domain',
          kind: 'dependency',
          metadata: {
            dependencyType: 'static',
          },
        },
      ],
    });
  });
});

function manualWorkspaceFixturePath(fileName: string): string {
  return path.join(
    fileURLToPath(
      new URL('../../../tests/fixtures/manual-workspace', import.meta.url),
    ),
    fileName,
  );
}
