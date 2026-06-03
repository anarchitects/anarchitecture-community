import type { GovernanceWorkspaceAdapterResult } from '@anarchitects/governance-core';

import {
  DBT_ADAPTER_VALIDATION_MODES,
  isDbtAdapterValidationMode,
  type DbtAdapterDiagnostic,
  type DbtAdapterResult,
  type DbtArtifactPaths,
  type DbtGovernanceAdapterInput,
} from './index.js';

describe('dbt adapter contracts', () => {
  it('models explicit local paths without relying on cwd state', () => {
    const paths = {
      projectDir: '/repo/analytics',
      dbtProjectPath: '/repo/analytics/dbt_project.yml',
      catalogPath: '/repo/analytics/target/catalog.json',
      runResultsPath: '/repo/analytics/target/run_results.json',
      sourcesPath: '/repo/analytics/target/sources.json',
    } satisfies DbtArtifactPaths;

    const input = {
      paths,
      options: {
        validationMode: 'strict',
      },
      metadata: {
        dbt: {
          projectId: 'analytics',
        },
      },
    } satisfies DbtGovernanceAdapterInput;

    expect(input.paths.projectDir).toBe('/repo/analytics');
    expect(input.paths.dbtProjectPath).toBe('/repo/analytics/dbt_project.yml');
    expect(input.paths.manifestPath).toBeUndefined();
    expect(input.options?.validationMode).toBe('strict');
  });

  it('reuses governance-core result and diagnostic contracts', () => {
    const diagnostics = [
      {
        code: 'dbt.manifest.missing',
        message: 'manifest.json was not provided.',
        severity: 'error',
        category: 'configuration',
        inputField: 'paths.manifestPath',
        path: '/repo/analytics/target/manifest.json',
      },
    ] satisfies DbtAdapterDiagnostic[];

    const result = {
      workspaceId: 'analytics',
      workspaceName: 'analytics',
      workspaceRoot: '/repo/analytics',
      diagnostics,
      metadata: {
        adapter: 'dbt',
        validationMode: 'lenient',
        paths: {
          projectDir: '/repo/analytics',
          dbtProjectPath: '/repo/analytics/dbt_project.yml',
          manifestPath: '/repo/analytics/target/manifest.json',
        },
        dbt: {
          manifestVersion: 12,
        },
      },
    } satisfies DbtAdapterResult;

    const coreCompatible: GovernanceWorkspaceAdapterResult = result;

    expect(coreCompatible.workspaceId).toBe('analytics');
    expect(result.diagnostics?.[0]?.inputField).toBe('paths.manifestPath');
    expect(result.metadata?.dbt).toEqual({ manifestVersion: 12 });
  });

  it('supports strict and lenient validation modes only', () => {
    expect(DBT_ADAPTER_VALIDATION_MODES).toEqual(['strict', 'lenient']);
    expect(isDbtAdapterValidationMode('strict')).toBe(true);
    expect(isDbtAdapterValidationMode('lenient')).toBe(true);
    expect(isDbtAdapterValidationMode('permissive')).toBe(false);
  });
});
