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
    const paths: DbtArtifactPaths = {
      projectDir: '/repo/analytics',
      dbtProjectPath: '/repo/analytics/dbt_project.yml',
      manifestPath: '/repo/analytics/target/manifest.json',
      catalogPath: '/repo/analytics/target/catalog.json',
      runResultsPath: '/repo/analytics/target/run_results.json',
      sourcesPath: '/repo/analytics/target/sources.json',
    };

    const input = {
      paths,
      options: {
        validationMode: 'strict',
      },
      metadata: {
        dbt: {
          workspaceLabel: 'analytics',
        },
      },
    } satisfies DbtGovernanceAdapterInput;

    expect(input.paths.projectDir).toBe('/repo/analytics');
    expect(input.paths.dbtProjectPath).toBe('/repo/analytics/dbt_project.yml');
    expect(input.paths.manifestPath).toBe(
      '/repo/analytics/target/manifest.json',
    );
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
        dbtUniqueId: 'model.analytics.orders',
        recommendation: 'Provide a valid manifest path.',
      },
    ] satisfies DbtAdapterDiagnostic[];

    const result = {
      workspaceId: 'analytics',
      workspaceName: 'analytics',
      workspaceRoot: '/repo/analytics',
      nodes: [
        {
          id: 'dbt.project.analytics',
          kind: 'project',
          technology: 'dbt',
          sourceSystem: 'dbt',
        },
      ],
      relations: [],
      diagnostics,
      metadata: {
        adapter: 'dbt',
        paths: {
          projectDir: '/repo/analytics',
          dbtProjectPath: '/repo/analytics/dbt_project.yml',
          manifestPath: '/repo/analytics/target/manifest.json',
        },
      },
      extensions: {
        'governance-extension:dbt': {
          extensionId: 'governance-extension:dbt',
          contractVersion: '1',
          data: {
            kind: 'workspace',
            technology: 'dbt',
            projectName: 'analytics',
          },
        },
      },
    } satisfies DbtAdapterResult;

    const coreCompatible: GovernanceWorkspaceAdapterResult = result;

    expect(coreCompatible.workspaceId).toBe('analytics');
    expect(coreCompatible.nodes).toEqual([
      expect.objectContaining({
        id: 'dbt.project.analytics',
        kind: 'project',
      }),
    ]);
    expect(result.diagnostics?.[0]?.inputField).toBe('paths.manifestPath');
    expect(result.diagnostics?.[0]?.dbtUniqueId).toBe('model.analytics.orders');
    expect(result.extensions).toEqual(
      expect.objectContaining({
        'governance-extension:dbt': expect.objectContaining({
          data: expect.objectContaining({
            kind: 'workspace',
            projectName: 'analytics',
          }),
        }),
      }),
    );
  });

  it('supports strict and lenient validation modes only', () => {
    expect(DBT_ADAPTER_VALIDATION_MODES).toEqual(['strict', 'lenient']);
    expect(isDbtAdapterValidationMode('strict')).toBe(true);
    expect(isDbtAdapterValidationMode('lenient')).toBe(true);
    expect(isDbtAdapterValidationMode('permissive')).toBe(false);
  });
});
