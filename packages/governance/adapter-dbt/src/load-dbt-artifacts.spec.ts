import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadDbtArtifacts,
  loadDbtManifest,
  loadDbtProjectConfig,
  resolveDbtProjectContext,
} from './index.js';

const fixturesRoot = fileURLToPath(
  new URL('../tests/fixtures/artifacts/', import.meta.url),
);

describe('dbt artifact loading', () => {
  it('loads a valid manifest.json fixture', () => {
    const result = loadDbtManifest(
      path.join(fixturesRoot, 'valid-project', 'target', 'manifest.json'),
    );

    expect(result.supported).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.manifest).toMatchObject({
      metadata: {
        project_name: 'valid_project',
        dbt_schema_version: 'https://schemas.getdbt.com/dbt/manifest/v12.json',
      },
      nodes: {},
    });
  });

  it('loads useful dbt_project.yml metadata', () => {
    const result = loadDbtProjectConfig(
      path.join(fixturesRoot, 'valid-project', 'dbt_project.yml'),
    );

    expect(result.supported).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.projectConfig).toMatchObject({
      name: 'valid_project',
      configVersion: 2,
      profile: 'analytics',
      modelPaths: ['models'],
    });
  });

  it('reports a missing manifest clearly', () => {
    const result = loadDbtManifest(
      path.join(fixturesRoot, 'missing-manifest', 'target', 'manifest.json'),
    );

    expect(result.supported).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.missing_artifact_file',
          inputField: 'paths.manifestPath',
        }),
      ]),
    );
  });

  it('reports malformed manifest JSON clearly', () => {
    const result = loadDbtManifest(
      path.join(fixturesRoot, 'malformed-manifest', 'target', 'manifest.json'),
    );

    expect(result.supported).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.malformed_manifest_json',
          inputField: 'paths.manifestPath',
        }),
      ]),
    );
  });

  it('reports a missing dbt_project.yml clearly', () => {
    const result = loadDbtProjectConfig(
      path.join(fixturesRoot, 'missing-project-config', 'dbt_project.yml'),
    );

    expect(result.supported).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.missing_artifact_file',
          inputField: 'paths.dbtProjectPath',
        }),
      ]),
    );
  });

  it('reports malformed dbt_project.yml YAML clearly', () => {
    const result = loadDbtProjectConfig(
      path.join(fixturesRoot, 'malformed-project-config', 'dbt_project.yml'),
    );

    expect(result.supported).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.malformed_dbt_project_yaml',
          inputField: 'paths.dbtProjectPath',
        }),
      ]),
    );
  });

  it('detects unsupported manifest shape clearly', () => {
    const result = loadDbtManifest(
      path.join(
        fixturesRoot,
        'unsupported-manifest',
        'target',
        'manifest.json',
      ),
    );

    expect(result.supported).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.unsupported_manifest_shape',
        }),
      ]),
    );
  });

  it('detects incomplete required manifest fields clearly', () => {
    const result = loadDbtManifest(
      path.join(fixturesRoot, 'incomplete-manifest', 'target', 'manifest.json'),
    );

    expect(result.supported).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.incomplete_manifest_field',
        }),
      ]),
    );
  });

  it('loads manifest and project config together from project context', () => {
    const context = resolveDbtProjectContext({
      paths: {
        projectDir: path.join(fixturesRoot, 'valid-project'),
      },
    });

    expect(context).toBeDefined();
    if (!context) {
      throw new Error(
        'Expected valid-project fixture to resolve a dbt context.',
      );
    }

    const loaded = loadDbtArtifacts(context);

    expect(loaded.supported).toBe(true);
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.artifacts).toMatchObject({
      projectConfig: {
        name: 'valid_project',
      },
      manifest: {
        metadata: {
          project_name: 'valid_project',
        },
      },
    });
  });
});
