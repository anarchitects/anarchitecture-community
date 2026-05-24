import * as adapterTypeScript from './index.js';

describe('TypeScript adapter public API', () => {
  it('exports TypeScript parity helpers at the package root', () => {
    expect(typeof adapterTypeScript.detectTypeScriptWorkspace).toBe('function');
    expect(typeof adapterTypeScript.parseTsConfigResolution).toBe('function');
    expect(typeof adapterTypeScript.parseTsconfig).toBe('function');
    expect(typeof adapterTypeScript.resolveTsConfigExtendsChain).toBe(
      'function',
    );
    expect(typeof adapterTypeScript.resolveTsconfigExtends).toBe('function');
    expect(typeof adapterTypeScript.normalizePathAliasesFromConfigs).toBe(
      'function',
    );
    expect(typeof adapterTypeScript.normalizeTypeScriptPathAliases).toBe(
      'function',
    );
    expect(typeof adapterTypeScript.resolveWorkspacePackages).toBe('function');
    expect(typeof adapterTypeScript.discoverTypeScriptProjects).toBe(
      'function',
    );
    expect(typeof adapterTypeScript.buildTypeScriptImportGraph).toBe(
      'function',
    );
    expect(
      typeof adapterTypeScript.mapTypeScriptImportsToGovernanceDependencies,
    ).toBe('function');
  });
});
