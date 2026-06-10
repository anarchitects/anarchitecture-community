import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTypeScriptImportGraph } from './import-graph.js';
import type { TypeScriptDiscoveredProject } from './types.js';

const specDir = fileURLToPath(new URL('.', import.meta.url));

describe('TypeScript import graph', () => {
  it('parses static imports, type-only imports, and resolves relative imports', () => {
    const workspaceRoot = createWorkspace({
      'packages/app/src/index.ts':
        "import { shared } from './shared';\nimport type { Model } from './model';\n",
      'packages/app/src/shared.ts': 'export const shared = true;\n',
      'packages/app/src/model.ts': 'export type Model = { id: string };\n',
    });

    const graph = buildTypeScriptImportGraph({
      workspaceRoot,
      projects: [project('app', 'packages/app')],
    });

    expect(graph.files).toEqual([
      { filePath: 'packages/app/src/index.ts', projectName: 'app' },
      { filePath: 'packages/app/src/model.ts', projectName: 'app' },
      { filePath: 'packages/app/src/shared.ts', projectName: 'app' },
    ]);
    expect(graph.imports).toEqual([
      {
        sourceFile: 'packages/app/src/index.ts',
        specifier: './model',
        kind: 'static-import',
        resolvedFile: 'packages/app/src/model.ts',
        external: false,
      },
      {
        sourceFile: 'packages/app/src/index.ts',
        specifier: './shared',
        kind: 'static-import',
        resolvedFile: 'packages/app/src/shared.ts',
        external: false,
      },
    ]);
    expect(graph.diagnostics).toEqual([]);
  });

  it('parses re-exports and resolves them', () => {
    const workspaceRoot = createWorkspace({
      'packages/lib/src/index.ts': "export * from './shared';\n",
      'packages/lib/src/shared.ts': 'export const shared = true;\n',
    });

    const graph = buildTypeScriptImportGraph({
      workspaceRoot,
      projects: [project('lib', 'packages/lib')],
    });

    expect(graph.imports).toEqual([
      {
        sourceFile: 'packages/lib/src/index.ts',
        specifier: './shared',
        kind: 're-export',
        resolvedFile: 'packages/lib/src/shared.ts',
        external: false,
      },
    ]);
  });

  it('resolves alias imports through tsconfig path aliases', () => {
    const workspaceRoot = createWorkspace({
      'packages/app/src/index.ts': "import { shared } from '@repo/shared';\n",
      'packages/shared/src/index.ts': 'export const shared = true;\n',
    });

    const graph = buildTypeScriptImportGraph({
      workspaceRoot,
      projects: [
        project('app', 'packages/app'),
        project('shared', 'packages/shared'),
      ],
      tsconfig: {
        workspaceRoot,
        configFiles: ['tsconfig.json'],
        baseUrl: '.',
        pathAliases: {
          '@repo/shared': ['packages/shared/src/index.ts'],
        },
        diagnostics: [],
      },
    });

    expect(graph.imports).toEqual([
      {
        sourceFile: 'packages/app/src/index.ts',
        specifier: '@repo/shared',
        kind: 'static-import',
        resolvedFile: 'packages/shared/src/index.ts',
        external: false,
      },
    ]);
  });

  it('marks external imports as external without diagnostics', () => {
    const workspaceRoot = createWorkspace({
      'packages/app/src/index.ts': "import React from 'react';\n",
    });

    const graph = buildTypeScriptImportGraph({
      workspaceRoot,
      projects: [project('app', 'packages/app')],
    });

    expect(graph.imports).toEqual([
      {
        sourceFile: 'packages/app/src/index.ts',
        specifier: 'react',
        kind: 'static-import',
        external: true,
      },
    ]);
    expect(graph.diagnostics).toEqual([]);
  });

  it('ignores dist, build, coverage, node_modules, and .d.ts files', () => {
    const workspaceRoot = createWorkspace({
      'packages/app/src/index.ts': 'export const value = true;\n',
      'packages/app/src/types.d.ts': 'export type Value = string;\n',
      'packages/app/dist/generated.ts': "import './ignored';\n",
      'packages/app/build/generated.ts': "import './ignored';\n",
      'packages/app/coverage/generated.ts': "import './ignored';\n",
      'packages/app/node_modules/dep/index.ts': 'export const dep = true;\n',
    });

    const graph = buildTypeScriptImportGraph({
      workspaceRoot,
      projects: [project('app', 'packages/app')],
    });

    expect(graph.files).toEqual([
      { filePath: 'packages/app/src/index.ts', projectName: 'app' },
    ]);
  });

  it('supports string-literal dynamic imports and diagnoses non-literal ones', () => {
    const workspaceRoot = createWorkspace({
      'packages/app/src/index.ts': "import('./lazy');\nimport(loadTarget);\n",
      'packages/app/src/lazy.ts': 'export const lazy = true;\n',
    });

    const graph = buildTypeScriptImportGraph({
      workspaceRoot,
      projects: [project('app', 'packages/app')],
    });

    expect(graph.imports).toEqual([
      {
        sourceFile: 'packages/app/src/index.ts',
        specifier: './lazy',
        kind: 'dynamic-import',
        resolvedFile: 'packages/app/src/lazy.ts',
        external: false,
      },
    ]);
    expect(graph.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.non_literal_dynamic_import',
        message:
          'Dynamic import specifier must be a string literal for deterministic analysis.',
        source: 'governance.typescript_adapter',
        path: '/packages~1app~1src~1index.ts',
      },
    ]);
  });

  it('reports unresolved internal imports deterministically', () => {
    const workspaceRoot = createWorkspace({
      'packages/app/src/index.ts':
        "import { shared } from './missing';\nimport { x } from '@repo/missing';\n",
    });

    const graph = buildTypeScriptImportGraph({
      workspaceRoot,
      projects: [project('app', 'packages/app')],
      tsconfig: {
        workspaceRoot,
        configFiles: ['tsconfig.json'],
        pathAliases: {
          '@repo/missing': ['packages/shared/src/missing.ts'],
        },
        diagnostics: [],
      },
    });

    expect(graph.imports).toEqual([
      {
        sourceFile: 'packages/app/src/index.ts',
        specifier: './missing',
        kind: 'static-import',
        external: false,
      },
      {
        sourceFile: 'packages/app/src/index.ts',
        specifier: '@repo/missing',
        kind: 'static-import',
        external: false,
      },
    ]);
    expect(graph.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.unresolved_import',
        message:
          'Import specifier "./missing" from "packages/app/src/index.ts" could not be resolved.',
        source: 'governance.typescript_adapter',
        path: '/packages~1app~1src~1index.ts/imports/.~1missing',
      },
      {
        code: 'governance.typescript_adapter.unresolved_import',
        message:
          'Import specifier "@repo/missing" from "packages/app/src/index.ts" could not be resolved.',
        source: 'governance.typescript_adapter',
        path: '/packages~1app~1src~1index.ts/imports/@repo~1missing',
      },
    ]);
  });

  it('reports parse errors without crashing analysis', () => {
    const workspaceRoot = createWorkspace({
      'packages/app/src/index.ts': "import { broken from './shared';\n",
      'packages/app/src/shared.ts': 'export const shared = true;\n',
    });

    const graph = buildTypeScriptImportGraph({
      workspaceRoot,
      projects: [project('app', 'packages/app')],
    });

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: 'governance.typescript_adapter.source_file_parse_error',
        source: 'governance.typescript_adapter',
        path: '/packages~1app~1src~1index.ts',
      }),
    ]);
  });

  it('keeps import edges ordered deterministically', () => {
    const workspaceRoot = createWorkspace({
      'packages/app/src/a.ts': "export * from './shared';\n",
      'packages/app/src/b.ts': "import { shared } from './shared';\n",
      'packages/app/src/shared.ts': 'export const shared = true;\n',
    });

    const graph = buildTypeScriptImportGraph({
      workspaceRoot,
      projects: [project('app', 'packages/app')],
    });

    expect(graph.imports).toEqual([
      {
        sourceFile: 'packages/app/src/a.ts',
        specifier: './shared',
        kind: 're-export',
        resolvedFile: 'packages/app/src/shared.ts',
        external: false,
      },
      {
        sourceFile: 'packages/app/src/b.ts',
        specifier: './shared',
        kind: 'static-import',
        resolvedFile: 'packages/app/src/shared.ts',
        external: false,
      },
    ]);
  });

  it('does not import Nx APIs', () => {
    const graphSource = readFileSync(
      path.join(specDir, 'import-graph.ts'),
      'utf8',
    );
    const discoverySource = readFileSync(
      path.join(specDir, 'source-file-discovery.ts'),
      'utf8',
    );
    const parseSource = readFileSync(
      path.join(specDir, 'parse-imports.ts'),
      'utf8',
    );

    expect(graphSource).not.toMatch(/from ['"]nx['"]/);
    expect(graphSource).not.toMatch(/from ['"]@nx\//);
    expect(discoverySource).not.toMatch(/from ['"]nx['"]/);
    expect(discoverySource).not.toMatch(/from ['"]@nx\//);
    expect(parseSource).not.toMatch(/from ['"]nx['"]/);
    expect(parseSource).not.toMatch(/from ['"]@nx\//);
  });
});

function createWorkspace(files: Record<string, string>): string {
  const workspaceRoot = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-import-graph-'),
  );

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(workspaceRoot, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf8');
  }

  return workspaceRoot;
}

function project(name: string, root: string): TypeScriptDiscoveredProject {
  return {
    id: name,
    name,
    root,
    type: 'unknown',
    tags: [],
    metadata: {},
  };
}
