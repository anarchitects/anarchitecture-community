import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
} from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { detectTypeScriptWorkspace } from './detect-typescript-workspace.js';

const specDir = fileURLToPath(new URL('.', import.meta.url));

describe('TypeScript workspace detection', () => {
  it('detects a pnpm workspace as supported', () => {
    const workspaceRoot = materializeFixture('pnpm-workspace');
    const result = detectTypeScriptWorkspace(workspaceRoot);

    expect(result).toEqual({
      status: 'supported',
      supported: true,
      workspaceRoot,
      indicators: {
        packageJson: true,
        pnpmWorkspace: true,
        packageManagerWorkspaces: false,
        tsconfig: false,
        tsconfigBase: true,
      },
      diagnostics: [],
    });
  });

  it('detects package-manager workspaces from package.json as supported', () => {
    const workspaceRoot = materializeFixture('package-manager-workspaces');
    const result = detectTypeScriptWorkspace(workspaceRoot);

    expect(result).toEqual({
      status: 'supported',
      supported: true,
      workspaceRoot,
      indicators: {
        packageJson: true,
        pnpmWorkspace: false,
        packageManagerWorkspaces: true,
        tsconfig: true,
        tsconfigBase: false,
      },
      diagnostics: [],
    });
  });

  it('detects tsconfig-only repositories as partial support', () => {
    const result = detectTypeScriptWorkspace(fixturePath('tsconfig-only'));

    expect(result).toEqual({
      status: 'partial',
      supported: true,
      workspaceRoot: fixturePath('tsconfig-only'),
      indicators: {
        packageJson: false,
        pnpmWorkspace: false,
        packageManagerWorkspaces: false,
        tsconfig: true,
        tsconfigBase: false,
      },
      diagnostics: [
        {
          code: 'governance.typescript_adapter.partial_workspace_detection',
          message:
            'Repository has TypeScript or JavaScript indicators but no explicit workspace-manager indicator.',
          source: 'governance.typescript_adapter',
          details: {
            detectedIndicators: ['tsconfig'],
          },
        },
      ],
    });
  });

  it('reports unsupported repositories when no indicators are present', () => {
    const result = detectTypeScriptWorkspace(fixturePath('unsupported'));

    expect(result).toEqual({
      status: 'unsupported',
      supported: false,
      workspaceRoot: fixturePath('unsupported'),
      indicators: {
        packageJson: false,
        pnpmWorkspace: false,
        packageManagerWorkspaces: false,
        tsconfig: false,
        tsconfigBase: false,
      },
      diagnostics: [
        {
          code: 'governance.typescript_adapter.no_workspace_indicators',
          message:
            'Repository does not contain supported TypeScript or JavaScript workspace indicators.',
          source: 'governance.typescript_adapter',
        },
      ],
    });
  });

  it('reports invalid package.json content deterministically', () => {
    const workspaceRoot = materializeFixture('invalid-package-json');
    const result = detectTypeScriptWorkspace(workspaceRoot);

    expect(result).toEqual({
      status: 'unsupported',
      supported: false,
      workspaceRoot,
      indicators: {
        packageJson: true,
        pnpmWorkspace: false,
        packageManagerWorkspaces: false,
        tsconfig: false,
        tsconfigBase: false,
      },
      diagnostics: [
        {
          code: 'governance.typescript_adapter.invalid_package_json',
          message: `Failed to parse package.json file "${path.join(
            workspaceRoot,
            'package.json',
          )}".`,
          source: 'governance.typescript_adapter',
          path: '/package.json',
        },
        {
          code: 'governance.typescript_adapter.no_workspace_indicators',
          message:
            'Repository does not contain supported TypeScript or JavaScript workspace indicators.',
          source: 'governance.typescript_adapter',
        },
      ],
    });
  });

  it('keeps diagnostic ordering stable across repeated runs', () => {
    const workspaceRoot = materializeFixture('invalid-package-json');

    expect(detectTypeScriptWorkspace(workspaceRoot).diagnostics).toEqual(
      detectTypeScriptWorkspace(workspaceRoot).diagnostics,
    );
  });

  it('does not import Nx APIs', () => {
    const moduleSource = readFileSync(
      path.join(specDir, 'detect-typescript-workspace.ts'),
      'utf8',
    );
    const diagnosticsSource = readFileSync(
      path.join(specDir, 'diagnostics.ts'),
      'utf8',
    );

    expect(moduleSource).not.toMatch(/from ['"]nx['"]/);
    expect(moduleSource).not.toMatch(/from ['"]@nx\//);
    expect(diagnosticsSource).not.toMatch(/from ['"]nx['"]/);
    expect(diagnosticsSource).not.toMatch(/from ['"]@nx\//);
  });
});

function fixturePath(name: string): string {
  return path.join(specDir, '..', 'tests', 'fixtures', 'fixtures', name);
}

function materializeFixture(name: string): string {
  const sourceRoot = fixturePath(name);
  const targetRoot = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-adapter-'),
  );

  cpSync(sourceRoot, targetRoot, { recursive: true });
  renameFixtureFile(
    targetRoot,
    'fixture.package.json',
    path.join(targetRoot, 'package.json'),
  );
  renameFixtureFile(
    targetRoot,
    'fixture.package.txt',
    path.join(targetRoot, 'package.json'),
  );

  return targetRoot;
}

function renameFixtureFile(
  root: string,
  fixtureName: string,
  targetPath: string,
): void {
  const sourcePath = path.join(root, fixtureName);

  if (existsSync(sourcePath)) {
    renameSync(sourcePath, targetPath);
  }
}
