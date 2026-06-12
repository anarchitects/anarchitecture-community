import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTypeScriptImportGraph } from './import-graph.js';
import { mapTypeScriptImportsToGovernanceDependencies } from './map-imports-to-projects.js';
import { parsePackageManagerWorkspace } from './parse-package-manager-workspace.js';
import { discoverTypeScriptProjects } from './project-discovery.js';

const specDir = fileURLToPath(new URL('.', import.meta.url));

describe('TypeScript adapter workspace behavior fixtures', () => {
  it('covers pnpm workspace behavior deterministically', () => {
    const analysis = analyzeFixture('pnpm');

    expect(analysis.workspace.packageManager).toBe('pnpm');
    expect(analysis.workspace.patterns).toEqual(['apps/*', 'packages/*']);
    expect(analysis.workspace.packageRoots).toEqual([
      'apps/web',
      'packages/customer',
      'packages/order',
    ]);
    expect(projectRoots(analysis)).toEqual([
      'apps/web',
      'packages/customer',
      'packages/order',
    ]);
    expect(analysis.mapping.relations).toEqual([
      relation('customer', 'order', 'packages/customer/src/index.ts'),
      relation('web', 'customer', 'apps/web/src/index.ts'),
    ]);
    expect(allDiagnostics(analysis)).toEqual([]);
  });

  it('covers npm workspaces array behavior with deterministic package ordering', () => {
    const analysis = analyzeFixture('npm-array');

    expect(analysis.workspace.packageManager).toBe('npm');
    expect(analysis.workspace.patterns).toEqual(['packages/*', 'apps/*']);
    expect(analysis.workspace.packageRoots).toEqual([
      'packages/customer',
      'packages/order',
      'apps/web',
    ]);
    expect(projectRoots(analysis)).toEqual([
      'apps/web',
      'packages/customer',
      'packages/order',
    ]);
    expect(analysis.mapping.relations).toEqual([
      relation('customer', 'order', 'packages/customer/src/index.ts'),
      relation('web', 'customer', 'apps/web/src/index.ts'),
    ]);
    expect(allDiagnostics(analysis)).toEqual([]);
  });

  it('covers yarn workspaces array behavior deterministically', () => {
    const analysis = analyzeFixture('yarn-array');

    expect(analysis.workspace.packageManager).toBe('yarn');
    expect(analysis.workspace.patterns).toEqual(['packages/*', 'apps/*']);
    expect(analysis.workspace.packageRoots).toEqual([
      'packages/utils',
      'apps/console',
    ]);
    expect(projectRoots(analysis)).toEqual(['apps/console', 'packages/utils']);
    expect(analysis.mapping.relations).toEqual([
      relation('console', 'utils', 'apps/console/src/index.ts'),
    ]);
    expect(allDiagnostics(analysis)).toEqual([]);
  });

  it('covers object-style workspaces.packages behavior deterministically', () => {
    const analysis = analyzeFixture('object-style');

    expect(analysis.workspace.packageManager).toBe('npm');
    expect(analysis.workspace.patterns).toEqual(['apps/*', 'packages/*']);
    expect(analysis.workspace.packageRoots).toEqual([
      'apps/admin',
      'packages/shared',
    ]);
    expect(projectRoots(analysis)).toEqual(['apps/admin', 'packages/shared']);
    expect(analysis.mapping.relations).toEqual([
      relation('admin', 'shared', 'apps/admin/src/index.ts'),
    ]);
    expect(allDiagnostics(analysis)).toEqual([]);
  });

  it('emits deterministic diagnostics for invalid workspace configuration fixtures', () => {
    const workspaceRoot = materializeFixture('invalid-config');
    const workspace = parsePackageManagerWorkspace(workspaceRoot);
    const discovered = discoverTypeScriptProjects(workspace, discoveryConfig());

    expect(workspace.packageManager).toBe('pnpm');
    expect(workspace.patterns).toEqual(['apps/*']);
    expect(workspace.packageRoots).toEqual(['apps/valid-app']);
    expect(workspace.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.invalid_workspace_config',
        message: 'Workspace pattern must be a non-empty string.',
        source: 'governance.typescript_adapter',
        path: '/packages/1',
      },
      {
        code: 'governance.typescript_adapter.invalid_workspace_config',
        message: 'Workspace pattern must be a non-empty string.',
        source: 'governance.typescript_adapter',
        path: '/packages/2',
      },
    ]);
    expect(discovered.projects.map((project) => project.id)).toEqual([
      'valid-app',
    ]);
    expect(discovered.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.discovery_pattern_no_matches',
        message:
          'Discovery pattern "packages/*" did not match any package roots.',
        source: 'governance.typescript_adapter',
        path: '/projects/1/pattern',
      },
    ]);
  });

  it('emits deterministic diagnostics for empty workspace package matches', () => {
    const workspaceRoot = materializeFixture('empty-matches');
    const workspace = parsePackageManagerWorkspace(workspaceRoot);
    const discovered = discoverTypeScriptProjects(workspace, discoveryConfig());

    expect(workspace.packageManager).toBe('npm');
    expect(workspace.patterns).toEqual(['apps/*']);
    expect(workspace.packageRoots).toEqual([]);
    expect(workspace.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.no_workspace_packages_found',
        message: 'Workspace patterns did not resolve to any package roots.',
        source: 'governance.typescript_adapter',
        details: {
          patterns: ['apps/*'],
        },
      },
    ]);
    expect(discovered.projects).toEqual([]);
    expect(discovered.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.discovery_pattern_no_matches',
        message: 'Discovery pattern "apps/*" did not match any package roots.',
        source: 'governance.typescript_adapter',
        path: '/projects/0/pattern',
      },
      {
        code: 'governance.typescript_adapter.discovery_pattern_no_matches',
        message:
          'Discovery pattern "packages/*" did not match any package roots.',
        source: 'governance.typescript_adapter',
        path: '/projects/1/pattern',
      },
    ]);
  });

  it('keeps fixture-based workspace analysis stable across repeated runs', () => {
    expect(summarizeAnalysis(analyzeFixture('pnpm'))).toEqual(
      summarizeAnalysis(analyzeFixture('pnpm')),
    );
  });

  it('keeps fixture directories out of the source package surface and Nx conventions', () => {
    const fixtureRoot = fixturePath('');
    const packagerSource = readFileSync(
      path.join(specDir, '..', 'package.json'),
      'utf8',
    );

    expect(fixtureRoot).toContain(
      'packages/governance/adapter-typescript/tests/fixtures/typescript-adapter/workspace-behavior',
    );
    expect(packagerSource).toContain('"files"');
    expect(packagerSource).not.toContain(
      'tests/fixtures/typescript-adapter/workspace-behavior',
    );
    expect(existsSync(path.join(fixtureRoot, 'pnpm', 'nx.json'))).toBe(false);
    expect(existsSync(path.join(fixtureRoot, 'pnpm', 'project.json'))).toBe(
      false,
    );
  });
});

function analyzeFixture(name: string) {
  const workspaceRoot = materializeFixture(name);
  const workspace = parsePackageManagerWorkspace(workspaceRoot);
  const discovered = discoverTypeScriptProjects(workspace, discoveryConfig());
  const graph = buildTypeScriptImportGraph({
    workspaceRoot,
    projects: discovered.projects,
  });
  const mapping = mapTypeScriptImportsToGovernanceDependencies({
    workspaceRoot,
    projects: discovered.projects,
    importGraph: graph,
  });

  return {
    workspace,
    discovered,
    graph,
    mapping,
  };
}

function discoveryConfig() {
  return {
    projects: [
      {
        pattern: 'apps/*',
        name: '{segment:1}',
        tags: ['type:app'],
      },
      {
        pattern: 'packages/*',
        name: '{segment:1}',
        tags: ['type:lib'],
      },
    ],
  };
}

function projectRoots(analysis: ReturnType<typeof analyzeFixture>): string[] {
  return analysis.discovered.projects.map((project) => project.root ?? '');
}

function allDiagnostics(analysis: ReturnType<typeof analyzeFixture>) {
  return [
    ...analysis.workspace.diagnostics,
    ...analysis.discovered.diagnostics,
    ...analysis.graph.diagnostics,
    ...analysis.mapping.diagnostics,
  ];
}

function summarizeAnalysis(analysis: ReturnType<typeof analyzeFixture>) {
  return {
    workspace: {
      packageManager: analysis.workspace.packageManager,
      patterns: analysis.workspace.patterns,
      packageRoots: analysis.workspace.packageRoots,
      diagnostics: analysis.workspace.diagnostics,
    },
    projects: analysis.discovered.projects.map((project) => ({
      id: project.id,
      root: project.root,
      tags: project.tags,
    })),
    imports: analysis.graph.imports.map((edge) => ({
      sourceFile: edge.sourceFile,
      specifier: edge.specifier,
      kind: edge.kind,
      resolvedFile: edge.resolvedFile,
      external: edge.external,
    })),
    relations: analysis.mapping.relations,
    diagnostics: allDiagnostics(analysis),
  };
}

function relation(
  sourceNodeId: string,
  targetNodeId: string,
  sourceFile: string,
) {
  return expect.objectContaining({
    sourceNodeId,
    targetNodeId,
    kind: 'dependency',
    extensions: expect.objectContaining({
      'governance-extension:typescript': expect.objectContaining({
        data: expect.objectContaining({
          relationKind: 'import',
          import: expect.objectContaining({
            sourceFile,
          }),
        }),
      }),
    }),
  });
}

function fixturePath(name: string): string {
  return path.join(
    specDir,
    '..',
    'tests',
    'fixtures',
    'typescript-adapter',
    'workspace-behavior',
    name,
  );
}

function materializeFixture(name: string): string {
  const sourceRoot = fixturePath(name);
  const targetRoot = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-workspace-behavior-'),
  );

  cpSync(sourceRoot, targetRoot, { recursive: true });
  materializePackageJsonTemplates(targetRoot);

  return targetRoot;
}

function materializePackageJsonTemplates(root: string): void {
  renameIfExists(root, 'fixture.package.json', 'package.json');

  for (const childEntry of readdirSync(root, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    if (!childEntry.isDirectory()) {
      continue;
    }

    materializePackageJsonTemplates(path.join(root, childEntry.name));
  }
}

function renameIfExists(
  directory: string,
  sourceName: string,
  targetName: string,
): void {
  const sourcePath = path.join(directory, sourceName);

  if (existsSync(sourcePath)) {
    renameSync(sourcePath, path.join(directory, targetName));
  }
}
