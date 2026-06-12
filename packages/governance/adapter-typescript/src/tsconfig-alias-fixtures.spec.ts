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
import { parseTsConfigResolution } from './parse-tsconfig.js';
import { discoverTypeScriptProjects } from './project-discovery.js';

const specDir = fileURLToPath(new URL('.', import.meta.url));

describe('TypeScript adapter tsconfig alias fixtures', () => {
  it('resolves compilerOptions.paths and baseUrl imports deterministically', () => {
    const analysis = analyzeFixture('alias-baseurl');

    expect(analysis.tsconfig).toEqual({
      workspaceRoot: analysis.workspaceRoot,
      configFiles: ['tsconfig.json'],
      baseUrl: 'packages',
      pathAliases: {
        '@app/customer': ['packages/customer/src/index.ts'],
        '@app/order/*': ['packages/order/src/*'],
        '@shared/*': ['packages/shared/src/*'],
      },
      diagnostics: [],
    });
    expect(analysis.graph.imports).toEqual([
      {
        sourceFile: 'apps/web/src/main.ts',
        specifier: '@app/customer',
        kind: 'static-import',
        resolvedFile: 'packages/customer/src/index.ts',
        external: false,
      },
      {
        sourceFile: 'apps/web/src/main.ts',
        specifier: '@app/order/service',
        kind: 'static-import',
        resolvedFile: 'packages/order/src/service.ts',
        external: false,
      },
      {
        sourceFile: 'apps/web/src/main.ts',
        specifier: '@shared/index',
        kind: 'static-import',
        resolvedFile: 'packages/shared/src/index.ts',
        external: false,
      },
      {
        sourceFile: 'apps/web/src/main.ts',
        specifier: 'shared-base/src/index',
        kind: 'static-import',
        resolvedFile: 'packages/shared-base/src/index.ts',
        external: false,
      },
    ]);
    expect(analysis.mapping.relations).toEqual([
      relation('web', 'customer', 'apps/web/src/main.ts'),
      relation('web', 'order', 'apps/web/src/main.ts'),
      relation('web', 'shared', 'apps/web/src/main.ts'),
      relation('web', 'shared-base', 'apps/web/src/main.ts'),
    ]);
    expect(allDiagnostics(analysis)).toEqual([]);
  });

  it('resolves MVP-supported extended tsconfig inheritance deterministically', () => {
    const analysis = analyzeFixture(
      'extends-aliases',
      'apps/web/tsconfig.json',
    );

    expect(analysis.tsconfig).toEqual({
      workspaceRoot: analysis.workspaceRoot,
      configFiles: ['tsconfig.base.json', 'apps/web/tsconfig.json'],
      baseUrl: 'apps/web',
      pathAliases: {
        '@feature/*': ['apps/web/src/*'],
        '@shared/*': ['packages/shared/src/*'],
      },
      diagnostics: [],
    });
    expect(analysis.graph.imports).toEqual([
      {
        sourceFile: 'apps/web/src/main.ts',
        specifier: '@feature/local',
        kind: 'static-import',
        resolvedFile: 'apps/web/src/local.ts',
        external: false,
      },
      {
        sourceFile: 'apps/web/src/main.ts',
        specifier: '@shared/index',
        kind: 'static-import',
        resolvedFile: 'packages/shared/src/index.ts',
        external: false,
      },
    ]);
    expect(analysis.mapping.relations).toEqual([
      relation('web', 'shared', 'apps/web/src/main.ts'),
    ]);
    expect(allDiagnostics(analysis)).toEqual([]);
  });

  it('reports invalid alias configuration while preserving valid aliases', () => {
    const analysis = analyzeFixture('invalid-alias-config');

    expect(analysis.tsconfig).toEqual({
      workspaceRoot: analysis.workspaceRoot,
      configFiles: ['tsconfig.json'],
      baseUrl: '.',
      pathAliases: {
        '@valid/core': ['packages/valid-core/src/index.ts'],
        '@valid/partial': ['packages/valid-core/src/partial.ts'],
      },
      diagnostics: [
        {
          code: 'governance.typescript_adapter.invalid_path_alias',
          message: 'Path alias targets must be an array of non-empty strings.',
          source: 'governance.typescript_adapter',
          path: '/tsconfig.json/compilerOptions/paths/@invalid~1array',
        },
        {
          code: 'governance.typescript_adapter.invalid_path_alias',
          message: 'Path alias target must be a non-empty string.',
          source: 'governance.typescript_adapter',
          path: '/tsconfig.json/compilerOptions/paths/@valid~1partial/1',
        },
      ],
    });
    expect(analysis.graph.imports).toEqual([
      {
        sourceFile: 'apps/web/src/main.ts',
        specifier: '@valid/core',
        kind: 'static-import',
        resolvedFile: 'packages/valid-core/src/index.ts',
        external: false,
      },
    ]);
    expect(analysis.mapping.relations).toEqual([
      relation('web', 'valid-core', 'apps/web/src/main.ts'),
    ]);
    expect(allDiagnostics(analysis)).toEqual(analysis.tsconfig.diagnostics);
  });

  it('reports unresolved alias targets deterministically', () => {
    const analysis = analyzeFixture('missing-alias-target');

    expect(analysis.tsconfig).toEqual({
      workspaceRoot: analysis.workspaceRoot,
      configFiles: ['tsconfig.json'],
      baseUrl: '.',
      pathAliases: {
        '@app/missing': ['packages/missing/src/index.ts'],
      },
      diagnostics: [],
    });
    expect(analysis.graph.imports).toEqual([
      {
        sourceFile: 'apps/web/src/main.ts',
        specifier: '@app/missing',
        kind: 'static-import',
        external: false,
      },
    ]);
    expect(analysis.graph.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.unresolved_import',
        message:
          'Import specifier "@app/missing" from "apps/web/src/main.ts" could not be resolved.',
        source: 'governance.typescript_adapter',
        path: '/apps~1web~1src~1main.ts/imports/@app~1missing',
      },
    ]);
    expect(analysis.mapping.relations).toEqual([]);
    expect(analysis.mapping.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.unresolved_internal_import',
        message:
          'Internal import specifier "@app/missing" from "apps/web/src/main.ts" could not be mapped to a discovered governance node.',
        source: 'governance.typescript_adapter',
        path: '/apps~1web~1src~1main.ts/imports/@app~1missing',
      },
    ]);
  });

  it('keeps fixture-based alias analysis deterministic across repeated runs', () => {
    expect(summarizeAnalysis(analyzeFixture('alias-baseurl'))).toEqual(
      summarizeAnalysis(analyzeFixture('alias-baseurl')),
    );
  });

  it('does not import Nx APIs', () => {
    const specSource = readFileSync(
      path.join(specDir, 'tsconfig-alias-fixtures.spec.ts'),
      'utf8',
    );

    expect(specSource).not.toMatch(/from ['"]nx['"]/);
    expect(specSource).not.toMatch(/from ['"]@nx\//);
  });
});

function analyzeFixture(name: string, configFilePath?: string) {
  const workspaceRoot = materializeFixture(name);
  const workspace = parsePackageManagerWorkspace(workspaceRoot);
  const discovered = discoverTypeScriptProjects(workspace, discoveryConfig());
  const tsconfig = parseTsConfigResolution(workspaceRoot, configFilePath);
  const graph = buildTypeScriptImportGraph({
    workspaceRoot,
    projects: discovered.projects,
    tsconfig,
  });
  const mapping = mapTypeScriptImportsToGovernanceDependencies({
    workspaceRoot,
    projects: discovered.projects,
    importGraph: graph,
  });

  return {
    workspaceRoot,
    workspace,
    discovered,
    tsconfig,
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

function allDiagnostics(analysis: ReturnType<typeof analyzeFixture>) {
  return [
    ...analysis.workspace.diagnostics,
    ...analysis.discovered.diagnostics,
    ...analysis.tsconfig.diagnostics,
    ...analysis.graph.diagnostics,
    ...analysis.mapping.diagnostics,
  ];
}

function summarizeAnalysis(analysis: ReturnType<typeof analyzeFixture>) {
  return {
    tsconfig: {
      ...analysis.tsconfig,
      workspaceRoot: '<workspaceRoot>',
    },
    imports: analysis.graph.imports,
    relations: analysis.mapping.relations,
    diagnostics: allDiagnostics(analysis),
  };
}

function fixturePath(name: string): string {
  return path.join(
    specDir,
    '..',
    'tests',
    'fixtures',
    'typescript-adapter',
    'tsconfig-alias-resolution',
    name,
  );
}

function materializeFixture(name: string): string {
  const sourceRoot = fixturePath(name);
  const targetRoot = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-tsconfig-aliases-'),
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
