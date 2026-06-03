import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  detectDbtProject,
  resolveDbtProjectContext,
  type DbtGovernanceAdapterInput,
} from './index.js';

const fixturesRoot = fileURLToPath(
  new URL('../tests/fixtures/detection/', import.meta.url),
);

describe('dbt project detection', () => {
  it('supports an explicit dbtProjectPath input', () => {
    const dbtProjectPath = path.join(
      fixturesRoot,
      'explicit-project',
      'dbt_project.yml',
    );

    const detected = detectDbtProject({
      paths: {
        dbtProjectPath,
      },
    });

    expect(detected.supported).toBe(true);
    expect(detected.diagnostics).toEqual([]);
    expect(detected.context).toMatchObject({
      projectDir: path.join(fixturesRoot, 'explicit-project'),
      dbtProjectPath,
      artifactPaths: {
        projectDir: path.join(fixturesRoot, 'explicit-project'),
        dbtProjectPath,
        manifestPath: path.join(
          fixturesRoot,
          'explicit-project',
          'target',
          'manifest.json',
        ),
      },
    });
  });

  it('infers dbt_project.yml from projectDir', () => {
    const projectDir = path.join(fixturesRoot, 'project-dir');
    const context = resolveDbtProjectContext({
      paths: {
        projectDir,
      },
    });

    expect(context).toMatchObject({
      projectDir,
      dbtProjectPath: path.join(projectDir, 'dbt_project.yml'),
      artifactPaths: {
        projectDir,
        dbtProjectPath: path.join(projectDir, 'dbt_project.yml'),
        manifestPath: path.join(projectDir, 'target', 'manifest.json'),
      },
    });
  });

  it('reports a missing project directory clearly', () => {
    const detected = detectDbtProject({
      paths: {
        projectDir: path.join(fixturesRoot, 'missing-project-dir'),
      },
    });

    expect(detected.supported).toBe(false);
    expect(detected.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.missing_project_directory',
          inputField: 'paths.projectDir',
        }),
      ]),
    );
  });

  it('reports a missing dbt_project.yml clearly', () => {
    const projectDir = path.join(fixturesRoot, 'missing-dbt-project-file');
    const detected = detectDbtProject({
      paths: {
        projectDir,
      },
    });

    expect(detected.supported).toBe(false);
    expect(detected.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.missing_dbt_project_file',
          inputField: 'paths.projectDir',
          path: projectDir,
        }),
      ]),
    );
  });

  it('reports inconsistent projectDir and dbtProjectPath inputs', () => {
    const projectDir = path.join(fixturesRoot, 'project-dir');
    const dbtProjectPath = path.join(
      fixturesRoot,
      'other-project',
      'dbt_project.yml',
    );

    const detected = detectDbtProject({
      paths: {
        projectDir,
        dbtProjectPath,
      },
    });

    expect(detected.supported).toBe(false);
    expect(detected.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.inconsistent_project_inputs',
          inputField: 'paths.dbtProjectPath',
        }),
      ]),
    );
  });

  it('reports an invalid explicit dbtProjectPath', () => {
    const detected = detectDbtProject({
      paths: {
        dbtProjectPath: path.join(fixturesRoot, 'invalid-project-file.yml'),
      },
    });

    expect(detected.supported).toBe(false);
    expect(detected.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.dbt_adapter.invalid_dbt_project_path',
          inputField: 'paths.dbtProjectPath',
        }),
      ]),
    );
  });

  it('resolves a caller-provided manifest path without loading it', () => {
    const input = {
      paths: {
        projectDir: path.join(fixturesRoot, 'project-dir'),
        manifestPath: path.join(fixturesRoot, 'artifacts', 'manifest.json'),
      },
    } satisfies DbtGovernanceAdapterInput;

    const context = resolveDbtProjectContext(input);

    expect(context?.artifactPaths.manifestPath).toBe(
      path.join(fixturesRoot, 'artifacts', 'manifest.json'),
    );
  });
});
