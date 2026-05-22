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
      projects: [
        {
          id: 'customer-domain',
          name: 'customer-domain',
          root: 'src/customer/domain',
          tags: ['layer:domain', 'scope:customer', 'type:domain'],
          type: 'unknown',
          metadata: {},
        },
        {
          id: 'order-domain',
          name: 'order-domain',
          root: 'src/order/domain',
          tags: ['layer:domain', 'scope:order', 'type:domain'],
          type: 'library',
          metadata: {},
        },
      ],
      dependencies: [
        {
          sourceProjectId: 'customer-domain',
          targetProjectId: 'order-domain',
          type: 'static',
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
      projects: [
        {
          id: 'customer-domain',
          name: 'customer-domain',
          root: 'src/customer/domain',
          type: 'unknown',
          tags: ['layer:domain', 'scope:customer', 'type:domain'],
          domain: 'customer',
          layer: 'domain',
          ownership: {
            source: 'none',
          },
          metadata: {},
        },
        {
          id: 'order-domain',
          name: 'order-domain',
          root: 'src/order/domain',
          type: 'library',
          tags: ['layer:domain', 'scope:order', 'type:domain'],
          domain: 'order',
          layer: 'domain',
          ownership: {
            source: 'none',
          },
          metadata: {},
        },
      ],
      dependencies: [
        {
          source: 'customer-domain',
          target: 'order-domain',
          type: 'static',
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
      projects: [
        expect.objectContaining({
          id: 'customer-domain',
          type: 'unknown',
        }),
        expect.objectContaining({
          id: 'order-domain',
          type: 'library',
        }),
      ],
      dependencies: [
        {
          sourceProjectId: 'customer-domain',
          targetProjectId: 'order-domain',
          type: 'static',
        },
      ],
    });
  });

  it('validates deterministic schema errors in input order', () => {
    expect(() =>
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
          code: 'governance.workspace_schema.unknown_field',
          message: 'Unknown field "extra" is not allowed.',
          path: '/extra',
        },
        {
          code: 'governance.workspace_schema.invalid_path',
          message: 'Project root must be a normalized relative path.',
          path: '/projects/0/root',
        },
        {
          code: 'governance.workspace_schema.invalid_tag',
          message:
            'Tags must be non-empty and may not contain leading or trailing whitespace.',
          path: '/projects/0/tags/0',
        },
        {
          code: 'governance.workspace_schema.invalid_tag',
          message:
            'Multiple "scope:" tags are not allowed on the same project.',
          path: '/projects/0/tags/2',
        },
        {
          code: 'governance.workspace_schema.unknown_field',
          message: 'Unknown field "extra" is not allowed.',
          path: '/projects/1/extra',
        },
        {
          code: 'governance.workspace_schema.invalid_enum_value',
          message:
            'Dependency type must be one of static, dynamic, implicit, or unknown.',
          path: '/dependencies/0/type',
        },
        {
          code: 'governance.workspace_schema.self_dependency',
          message: 'Dependency source and target must differ.',
          path: '/dependencies/0',
        },
        {
          code: 'governance.workspace_schema.duplicate_project_name',
          message: 'Duplicate project name "customer-domain" is not allowed.',
          path: '/projects/1/name',
        },
        {
          code: 'governance.workspace_schema.unknown_dependency_target',
          message:
            'Dependency target "order-domain" does not match a declared project.',
          path: '/dependencies/1/target',
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
      projects: [
        {
          name: 'docs-site',
          root: 'apps/docs-site',
          tags: ['scope:platform', 'layer:app'],
          metadata: {
            anarchitects: {
              documentation: true,
            },
          },
        },
      ],
      dependencies: [],
    });

    expect(schema).toEqual({
      schemaVersion: 1,
      workspace: {
        name: 'demo',
        root: '.',
      },
      projects: [
        {
          name: 'docs-site',
          root: 'apps/docs-site',
          tags: ['scope:platform', 'layer:app'],
          type: 'unknown',
          metadata: {
            anarchitects: {
              documentation: true,
            },
          },
        },
      ],
      dependencies: [],
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
        name: 'demo',
        root: '.',
      },
      projects: [
        {
          name: 'order-domain',
          root: 'src/order/domain',
          tags: ['scope:order', 'layer:domain', 'type:domain'],
          type: 'library',
          metadata: {},
        },
        {
          name: 'customer-domain',
          root: 'src/customer/domain',
          tags: ['scope:customer', 'layer:domain', 'type:domain'],
          type: 'unknown',
          metadata: {},
        },
      ],
      dependencies: [
        {
          source: 'customer-domain',
          target: 'order-domain',
          type: 'static',
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
