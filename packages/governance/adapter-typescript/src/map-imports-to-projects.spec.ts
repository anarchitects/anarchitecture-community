import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  GovernanceDependencyInput,
  GovernanceProjectInput,
} from '@anarchitects/governance-core';

import { mapTypeScriptImportsToGovernanceDependencies } from './map-imports-to-projects.js';
import type { TypeScriptImportGraph } from './types.js';

const specDir = fileURLToPath(new URL('.', import.meta.url));

describe('TypeScript import to project mapping', () => {
  it('maps relative imports across discovered projects', () => {
    const result = mapTypeScriptImportsToGovernanceDependencies({
      workspaceRoot: '/repo',
      projects: [
        project('app', 'apps/app'),
        project('shared', 'packages/shared'),
      ],
      importGraph: graph(
        [
          sourceFile('apps/app/src/index.ts'),
          sourceFile('packages/shared/src/index.ts'),
        ],
        [
          {
            sourceFile: 'apps/app/src/index.ts',
            specifier: '../../packages/shared/src/index',
            kind: 'static-import',
            resolvedFile: 'packages/shared/src/index.ts',
            external: false,
          },
        ],
      ),
    });

    expect(result).toEqual({
      dependencies: [
        dependency('app', 'shared', 'static', 'apps/app/src/index.ts'),
      ],
      diagnostics: [],
    });
  });

  it('maps tsconfig alias imports to discovered projects', () => {
    const result = mapTypeScriptImportsToGovernanceDependencies({
      workspaceRoot: '/repo',
      projects: [
        project('customer-domain', 'libs/customer/domain'),
        project('shared', 'libs/shared'),
      ],
      importGraph: graph(
        [
          sourceFile('libs/customer/domain/src/index.ts'),
          sourceFile('libs/shared/src/index.ts'),
        ],
        [
          {
            sourceFile: 'libs/customer/domain/src/index.ts',
            specifier: '@repo/shared',
            kind: 'static-import',
            resolvedFile: 'libs/shared/src/index.ts',
            external: false,
          },
        ],
      ),
    });

    expect(result.dependencies).toEqual([
      dependency(
        'customer-domain',
        'shared',
        'static',
        'libs/customer/domain/src/index.ts',
      ),
    ]);
  });

  it('maps workspace package-name imports to discovered projects', () => {
    const workspaceRoot = createWorkspace({
      'apps/app/package.json': JSON.stringify({ name: '@repo/app' }),
      'packages/shared/package.json': JSON.stringify({ name: '@repo/shared' }),
    });

    const result = mapTypeScriptImportsToGovernanceDependencies({
      workspaceRoot,
      projects: [
        project('app', 'apps/app'),
        project('shared', 'packages/shared'),
      ],
      importGraph: graph(
        [sourceFile('apps/app/src/index.ts')],
        [
          {
            sourceFile: 'apps/app/src/index.ts',
            specifier: '@repo/shared/subpath',
            kind: 'static-import',
            external: true,
          },
        ],
        workspaceRoot,
      ),
    });

    expect(result).toEqual({
      dependencies: [
        dependency('app', 'shared', 'static', 'apps/app/src/index.ts'),
      ],
      diagnostics: [],
    });
  });

  it('ignores intra-project imports and external package imports', () => {
    const workspaceRoot = createWorkspace({
      'packages/shared/package.json': JSON.stringify({ name: '@repo/shared' }),
    });

    const result = mapTypeScriptImportsToGovernanceDependencies({
      workspaceRoot,
      projects: [project('shared', 'packages/shared')],
      importGraph: graph(
        [sourceFile('packages/shared/src/index.ts')],
        [
          {
            sourceFile: 'packages/shared/src/index.ts',
            specifier: './util',
            kind: 'static-import',
            resolvedFile: 'packages/shared/src/util.ts',
            external: false,
          },
          {
            sourceFile: 'packages/shared/src/index.ts',
            specifier: 'react',
            kind: 'static-import',
            external: true,
          },
        ],
        workspaceRoot,
      ),
    });

    expect(result).toEqual({
      dependencies: [],
      diagnostics: [],
    });
  });

  it('deduplicates duplicate project dependencies deterministically', () => {
    const result = mapTypeScriptImportsToGovernanceDependencies({
      workspaceRoot: '/repo',
      projects: [
        project('app', 'apps/app'),
        project('shared', 'packages/shared'),
      ],
      importGraph: graph(
        [
          sourceFile('apps/app/src/a.ts'),
          sourceFile('apps/app/src/b.ts'),
          sourceFile('packages/shared/src/index.ts'),
        ],
        [
          {
            sourceFile: 'apps/app/src/a.ts',
            specifier: '@repo/shared',
            kind: 'static-import',
            resolvedFile: 'packages/shared/src/index.ts',
            external: false,
          },
          {
            sourceFile: 'apps/app/src/b.ts',
            specifier: '@repo/shared',
            kind: 'static-import',
            resolvedFile: 'packages/shared/src/index.ts',
            external: false,
          },
        ],
      ),
    });

    expect(result.dependencies).toEqual([
      dependency('app', 'shared', 'static', 'apps/app/src/a.ts'),
    ]);
  });

  it('keeps dependency ordering deterministic', () => {
    const result = mapTypeScriptImportsToGovernanceDependencies({
      workspaceRoot: '/repo',
      projects: [
        project('alpha', 'libs/alpha'),
        project('beta', 'libs/beta'),
        project('gamma', 'libs/gamma'),
      ],
      importGraph: graph(
        [
          sourceFile('libs/beta/src/index.ts'),
          sourceFile('libs/alpha/src/index.ts'),
          sourceFile('libs/gamma/src/index.ts'),
        ],
        [
          {
            sourceFile: 'libs/beta/src/index.ts',
            specifier: '@repo/gamma',
            kind: 'static-import',
            resolvedFile: 'libs/gamma/src/index.ts',
            external: false,
          },
          {
            sourceFile: 'libs/alpha/src/index.ts',
            specifier: '@repo/gamma',
            kind: 'static-import',
            resolvedFile: 'libs/gamma/src/index.ts',
            external: false,
          },
        ],
      ),
    });

    expect(result.dependencies).toEqual([
      dependency('alpha', 'gamma', 'static', 'libs/alpha/src/index.ts'),
      dependency('beta', 'gamma', 'static', 'libs/beta/src/index.ts'),
    ]);
  });

  it('reports unresolved internal imports deterministically', () => {
    const result = mapTypeScriptImportsToGovernanceDependencies({
      workspaceRoot: '/repo',
      projects: [project('app', 'apps/app')],
      importGraph: graph(
        [sourceFile('apps/app/src/index.ts')],
        [
          {
            sourceFile: 'apps/app/src/index.ts',
            specifier: '@repo/missing',
            kind: 'static-import',
            external: false,
          },
        ],
      ),
    });

    expect(result).toEqual({
      dependencies: [],
      diagnostics: [
        {
          code: 'governance.typescript_adapter.unresolved_internal_import',
          message:
            'Internal import specifier "@repo/missing" from "apps/app/src/index.ts" could not be mapped to a discovered project.',
          source: 'governance.typescript_adapter',
          path: '/apps~1app~1src~1index.ts/imports/@repo~1missing',
        },
      ],
    });
  });

  it('reports source files outside discovered projects', () => {
    const result = mapTypeScriptImportsToGovernanceDependencies({
      workspaceRoot: '/repo',
      projects: [project('app', 'apps/app')],
      importGraph: graph([sourceFile('scripts/tools/check.ts')], []),
    });

    expect(result).toEqual({
      dependencies: [],
      diagnostics: [
        {
          code: 'governance.typescript_adapter.source_file_outside_project',
          message:
            'Source file "scripts/tools/check.ts" does not belong to a discovered project.',
          source: 'governance.typescript_adapter',
          path: '/scripts~1tools~1check.ts',
        },
      ],
    });
  });

  it('reports ambiguous project matches deterministically', () => {
    const result = mapTypeScriptImportsToGovernanceDependencies({
      workspaceRoot: '/repo',
      projects: [
        project('shared', 'packages/shared'),
        project('shared-ui', 'packages/shared/ui'),
      ],
      importGraph: graph([sourceFile('packages/shared/ui/src/index.ts')], []),
    });

    expect(result).toEqual({
      dependencies: [],
      diagnostics: [
        {
          code: 'governance.typescript_adapter.ambiguous_project_match',
          message:
            'File "packages/shared/ui/src/index.ts" matched multiple discovered projects.',
          source: 'governance.typescript_adapter',
          path: '/packages~1shared~1ui~1src~1index.ts',
          details: {
            projectIds: ['shared-ui', 'shared'],
          },
        },
      ],
    });
  });

  it('does not import Nx APIs', () => {
    const mappingSource = readFileSync(
      path.join(specDir, 'map-imports-to-projects.ts'),
      'utf8',
    );

    expect(mappingSource).not.toMatch(/from ['"]nx['"]/);
    expect(mappingSource).not.toMatch(/from ['"]@nx\//);
  });
});

function createWorkspace(files: Record<string, string>): string {
  const workspaceRoot = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-import-mapping-'),
  );

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(workspaceRoot, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf8');
  }

  return workspaceRoot;
}

function project(name: string, root: string): GovernanceProjectInput {
  return {
    id: name,
    name,
    root,
    type: 'unknown',
    tags: [],
    metadata: {},
  };
}

function sourceFile(filePath: string): { filePath: string } {
  return { filePath };
}

function dependency(
  sourceProjectId: string,
  targetProjectId: string,
  type: string,
  sourceFile: string,
): GovernanceDependencyInput {
  return {
    sourceProjectId,
    targetProjectId,
    type,
    sourceFile,
  };
}

function graph(
  files: Array<{ filePath: string }>,
  imports: TypeScriptImportGraph['imports'],
  workspaceRoot = '/repo',
): TypeScriptImportGraph {
  return {
    workspaceRoot,
    files,
    imports,
    diagnostics: [],
  };
}
