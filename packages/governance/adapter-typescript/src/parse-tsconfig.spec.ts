import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTsConfigResolution } from './parse-tsconfig.js';

const specDir = fileURLToPath(new URL('.', import.meta.url));

describe('tsconfig resolution parsing', () => {
  it('parses tsconfig.json baseUrl and path aliases deterministically', () => {
    const workspaceRoot = createWorkspace({
      'tsconfig.json': {
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@app/shared': ['libs/shared/src/index.ts'],
            '@app/domain/*': ['libs/domain/*'],
          },
        },
      },
    });

    expect(parseTsConfigResolution(workspaceRoot)).toEqual({
      workspaceRoot,
      configFiles: ['tsconfig.json'],
      baseUrl: '.',
      pathAliases: {
        '@app/domain/*': ['libs/domain/*'],
        '@app/shared': ['libs/shared/src/index.ts'],
      },
      diagnostics: [],
    });
  });

  it('parses tsconfig.base.json when no root tsconfig.json exists', () => {
    const workspaceRoot = createWorkspace({
      'tsconfig.base.json': {
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@repo/core': ['packages/core/src/index.ts'],
          },
        },
      },
    });

    expect(parseTsConfigResolution(workspaceRoot)).toEqual({
      workspaceRoot,
      configFiles: ['tsconfig.base.json'],
      baseUrl: '.',
      pathAliases: {
        '@repo/core': ['packages/core/src/index.ts'],
      },
      diagnostics: [],
    });
  });

  it('resolves extends chains and child alias override precedence', () => {
    const workspaceRoot = createWorkspace({
      'tsconfig.base.json': {
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@repo/shared': ['libs/shared/src/index.ts'],
            '@feature/*': ['libs/base-feature/*'],
          },
        },
      },
      'apps/storefront/tsconfig.json': {
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          paths: {
            '@feature/*': ['src/*'],
          },
        },
      },
    });

    expect(
      parseTsConfigResolution(workspaceRoot, 'apps/storefront/tsconfig.json'),
    ).toEqual({
      workspaceRoot,
      configFiles: ['tsconfig.base.json', 'apps/storefront/tsconfig.json'],
      baseUrl: '.',
      pathAliases: {
        '@feature/*': ['src/*'],
        '@repo/shared': ['libs/shared/src/index.ts'],
      },
      diagnostics: [],
    });
  });

  it('normalizes child baseUrl relative to the workspace root', () => {
    const workspaceRoot = createWorkspace({
      'tsconfig.base.json': {
        compilerOptions: {
          baseUrl: '.',
        },
      },
      'packages/feature/tsconfig.json': {
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          baseUrl: './src',
          paths: {
            '@feature/*': ['*'],
          },
        },
      },
    });

    expect(
      parseTsConfigResolution(workspaceRoot, 'packages/feature/tsconfig.json'),
    ).toEqual({
      workspaceRoot,
      configFiles: ['tsconfig.base.json', 'packages/feature/tsconfig.json'],
      baseUrl: 'packages/feature/src',
      pathAliases: {
        '@feature/*': ['packages/feature/src/*'],
      },
      diagnostics: [],
    });
  });

  it('reports invalid tsconfig JSON deterministically', () => {
    const workspaceRoot = createWorkspace({});
    writeInvalidJson(workspaceRoot, 'tsconfig.json', '{ invalid json');

    expect(parseTsConfigResolution(workspaceRoot)).toEqual({
      workspaceRoot,
      configFiles: [],
      pathAliases: {},
      diagnostics: [
        {
          code: 'governance.typescript_adapter.invalid_tsconfig',
          message: `Failed to parse tsconfig file "${path.join(
            workspaceRoot,
            'tsconfig.json',
          )}".`,
          source: 'governance.typescript_adapter',
          path: '/tsconfig.json',
        },
      ],
    });
  });

  it('reports circular extends chains deterministically', () => {
    const workspaceRoot = createWorkspace({
      'tsconfig.json': {
        extends: './tsconfig.base.json',
        compilerOptions: {
          paths: {
            '@root/*': ['src/*'],
          },
        },
      },
      'tsconfig.base.json': {
        extends: './tsconfig.json',
      },
    });

    expect(parseTsConfigResolution(workspaceRoot)).toEqual({
      workspaceRoot,
      configFiles: ['tsconfig.base.json', 'tsconfig.json'],
      pathAliases: {
        '@root/*': ['src/*'],
      },
      diagnostics: [
        {
          code: 'governance.typescript_adapter.circular_tsconfig_extends',
          message: 'Circular tsconfig extends chain detected.',
          source: 'governance.typescript_adapter',
          path: '/tsconfig.json/extends',
          details: {
            chain: ['tsconfig.json', 'tsconfig.base.json', 'tsconfig.json'],
          },
        },
      ],
    });
  });

  it('reports missing extended configs deterministically', () => {
    const workspaceRoot = createWorkspace({
      'tsconfig.json': {
        extends: './missing-base',
        compilerOptions: {
          paths: {
            '@repo/core': ['src/index.ts'],
          },
        },
      },
    });

    expect(parseTsConfigResolution(workspaceRoot)).toEqual({
      workspaceRoot,
      configFiles: ['tsconfig.json'],
      pathAliases: {
        '@repo/core': ['src/index.ts'],
      },
      diagnostics: [
        {
          code: 'governance.typescript_adapter.invalid_tsconfig_extends',
          message: 'Extended tsconfig "./missing-base" could not be resolved.',
          source: 'governance.typescript_adapter',
          path: '/tsconfig.json/extends',
        },
      ],
    });
  });

  it('keeps alias ordering deterministic and deduplicates alias targets', () => {
    const workspaceRoot = createWorkspace({
      'tsconfig.json': {
        compilerOptions: {
          paths: {
            zeta: ['./src/zeta.ts'],
            alpha: ['./src/alpha.ts', './src/alpha.ts'],
            beta: ['./src/beta.ts'],
          },
        },
      },
    });

    expect(parseTsConfigResolution(workspaceRoot)).toEqual({
      workspaceRoot,
      configFiles: ['tsconfig.json'],
      pathAliases: {
        alpha: ['src/alpha.ts'],
        beta: ['src/beta.ts'],
        zeta: ['src/zeta.ts'],
      },
      diagnostics: [],
    });
  });

  it('reports invalid path alias shapes without throwing away valid aliases', () => {
    const workspaceRoot = createWorkspace({
      'tsconfig.json': {
        compilerOptions: {
          paths: {
            valid: ['src/index.ts'],
            invalidArray: 'src/invalid.ts',
            invalidEntry: ['src/ok.ts', '   '],
          },
        },
      },
    });

    expect(parseTsConfigResolution(workspaceRoot)).toEqual({
      workspaceRoot,
      configFiles: ['tsconfig.json'],
      pathAliases: {
        invalidEntry: ['src/ok.ts'],
        valid: ['src/index.ts'],
      },
      diagnostics: [
        {
          code: 'governance.typescript_adapter.invalid_path_alias',
          message: 'Path alias targets must be an array of non-empty strings.',
          source: 'governance.typescript_adapter',
          path: '/tsconfig.json/compilerOptions/paths/invalidArray',
        },
        {
          code: 'governance.typescript_adapter.invalid_path_alias',
          message: 'Path alias target must be a non-empty string.',
          source: 'governance.typescript_adapter',
          path: '/tsconfig.json/compilerOptions/paths/invalidEntry/1',
        },
      ],
    });
  });

  it('does not import Nx APIs', () => {
    const parseSource = readFileSync(
      path.join(specDir, 'parse-tsconfig.ts'),
      'utf8',
    );
    const resolveSource = readFileSync(
      path.join(specDir, 'resolve-tsconfig-extends.ts'),
      'utf8',
    );
    const normalizeSource = readFileSync(
      path.join(specDir, 'normalize-path-aliases.ts'),
      'utf8',
    );

    expect(parseSource).not.toMatch(/from ['"]nx['"]/);
    expect(parseSource).not.toMatch(/from ['"]@nx\//);
    expect(resolveSource).not.toMatch(/from ['"]nx['"]/);
    expect(resolveSource).not.toMatch(/from ['"]@nx\//);
    expect(normalizeSource).not.toMatch(/from ['"]nx['"]/);
    expect(normalizeSource).not.toMatch(/from ['"]@nx\//);
  });
});

function createWorkspace(files: Record<string, unknown>): string {
  const workspaceRoot = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-tsconfig-'),
  );

  for (const [filePath, value] of Object.entries(files)) {
    writeJson(workspaceRoot, filePath, value);
  }

  return workspaceRoot;
}

function writeJson(
  workspaceRoot: string,
  relativePath: string,
  value: unknown,
): void {
  const targetPath = path.join(workspaceRoot, relativePath);

  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeInvalidJson(
  workspaceRoot: string,
  relativePath: string,
  value: string,
): void {
  const targetPath = path.join(workspaceRoot, relativePath);

  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, value, 'utf8');
}
