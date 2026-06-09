import { fileURLToPath } from 'node:url';

import * as governanceCore from '@anarchitects/governance-core';
import type {
  GovernanceLoadedExtension,
  GovernanceWorkspaceAdapter,
} from '@anarchitects/governance-core';

import { runAgovAssess, runAgovCheck } from './check.js';
import { toCompatibilityWorkspace } from './workspace-compat.js';

describe('agov check/assess assessment pipeline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runAgovAssess uses Core artifact assembly', async () => {
    const buildArtifactsSpy = vi.spyOn(
      governanceCore,
      'buildGovernanceAssessmentArtifacts',
    );

    const result = await runAgovAssess({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    expect(buildArtifactsSpy).toHaveBeenCalledTimes(1);
    expect(result.command).toBe('assess');
    expect(result.assessment.workspace.name).toBe('demo');
    expect(result.artifacts.assessment).toBe(result.assessment);
  });

  it('runAgovCheck reuses the assess/artifact pipeline', async () => {
    const buildArtifactsSpy = vi.spyOn(
      governanceCore,
      'buildGovernanceAssessmentArtifacts',
    );

    const result = await runAgovCheck({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    expect(buildArtifactsSpy).toHaveBeenCalledTimes(1);
    expect(result.command).toBe('check');
    expect(result.success).toBe(true);
  });

  it('check succeeds for warning-only assessments', async () => {
    const result = await runAgovCheck({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/warning-profile.json',
      ),
    });

    expect(result.success).toBe(true);
    expect(
      result.assessment.violations.some((v) => v.severity === 'warning'),
    ).toBe(true);
    expect(
      result.assessment.violations.some((v) => v.severity === 'error'),
    ).toBe(false);
  });

  it('check fails when error-severity violations exist', async () => {
    const result = await runAgovCheck({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/error-profile.json',
      ),
    });

    expect(result.success).toBe(false);
    expect(
      result.assessment.violations.some((v) => v.severity === 'error'),
    ).toBe(true);
  });

  it('preserves compatibility workspace output while exposing canonical graph output', async () => {
    const result = await runAgovAssess({
      workspaceAdapter: createCanonicalGraphAdapter(),
      workspaceAdapterInput: '.',
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    expect(result.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'app',
          kind: 'project',
          technology: 'typescript',
          path: 'apps/app',
        }),
        expect.objectContaining({
          id: 'shared',
          kind: 'project',
          technology: 'typescript',
          path: 'libs/shared',
        }),
      ]),
    );
    expect(result.graph.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'app->shared',
          sourceNodeId: 'app',
          targetNodeId: 'shared',
          kind: 'dependency',
        }),
      ]),
    );
    const compatibilityWorkspace = toCompatibilityWorkspace(
      result.assessment.workspace,
    );
    expect(
      compatibilityWorkspace.projects.map((project) => project.id),
    ).toEqual(['app', 'shared']);
    expect(compatibilityWorkspace.dependencies).toEqual([
      expect.objectContaining({
        source: 'app',
        target: 'shared',
        type: 'static',
      }),
    ]);
  });

  it('propagates canonical adapter diagnostics and capabilities through assessment artifacts', async () => {
    const result = await runAgovAssess({
      workspaceAdapter: {
        id: 'test-adapter:diagnostics',
        loadWorkspace() {
          return {
            workspaceId: 'diagnostic-workspace',
            workspaceName: 'diagnostic-workspace',
            workspaceRoot: '.',
            projects: [],
            dependencies: [],
            capabilities: [
              {
                id: 'governance.adapter.partial-extraction',
                source: 'test-adapter',
              },
            ],
            diagnostics: [
              {
                code: 'governance.adapter.partial_extraction',
                message: 'Workspace extraction was partial.',
                severity: 'warning',
                kind: 'observation',
                category: 'adapter',
                source: 'test-adapter',
                details: {
                  status: 'partial',
                },
              },
            ],
          };
        },
      },
      workspaceAdapterInput: '.',
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    expect(result.artifacts.capabilities).toEqual([
      expect.objectContaining({
        id: 'governance.adapter.partial-extraction',
      }),
    ]);
    expect(result.artifacts.diagnostics).toEqual([
      expect.objectContaining({
        code: 'governance.adapter.partial_extraction',
        severity: 'warning',
        kind: 'observation',
        category: 'adapter',
        details: {
          status: 'partial',
        },
      }),
    ]);
  });

  it('executes registered extensions through the CLI assessment pipeline', async () => {
    const result = await runAgovAssess({
      workspaceAdapter: createCanonicalGraphAdapter(),
      workspaceAdapterInput: '.',
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
      extensions: [createTestExtension()],
    });

    expect(result.artifacts.extensionDiagnostics).toEqual([]);
    expect(result.assessment.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'test-extension:app',
          ruleId: 'test.extension.project-present',
          project: 'app',
          sourcePluginId: 'test.extension:typescript',
        }),
      ]),
    );
  });
});

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function createCanonicalGraphAdapter(): GovernanceWorkspaceAdapter<string> {
  return {
    id: 'test-adapter:typescript',
    loadWorkspace() {
      return {
        workspaceId: 'typescript-workspace',
        workspaceName: 'typescript-workspace',
        workspaceRoot: '.',
        projects: [
          {
            id: 'app',
            name: 'App',
            root: 'apps/app',
            type: 'application',
            tags: ['typescript'],
            metadata: {
              projectType: 'application',
            },
          },
          {
            id: 'shared',
            name: 'Shared',
            root: 'libs/shared',
            type: 'library',
            tags: ['typescript'],
            metadata: {
              projectType: 'library',
            },
          },
        ],
        dependencies: [
          {
            sourceProjectId: 'app',
            targetProjectId: 'shared',
            type: 'static',
            metadata: {
              source: 'projectGraph',
            },
          },
        ],
        nodes: [
          {
            id: 'app',
            name: 'App',
            kind: 'project',
            technology: 'typescript',
            path: 'apps/app',
            tags: ['typescript'],
            metadata: {
              projectType: 'application',
            },
          },
          {
            id: 'shared',
            name: 'Shared',
            kind: 'project',
            technology: 'typescript',
            path: 'libs/shared',
            tags: ['typescript'],
            metadata: {
              projectType: 'library',
            },
          },
        ],
        relations: [
          {
            id: 'app->shared',
            sourceNodeId: 'app',
            targetNodeId: 'shared',
            kind: 'dependency',
            metadata: {
              source: 'projectGraph',
              dependencyType: 'static',
            },
          },
        ],
      };
    },
  };
}

function createTestExtension(): GovernanceLoadedExtension {
  return {
    sourceSpecifier: '@anarchitects/governance-extension-typescript',
    moduleSpecifier: '@anarchitects/governance-extension-typescript',
    definition: {
      id: 'test.extension:typescript',
      name: 'Test TypeScript Governance Extension',
      register(host) {
        host.registerRulePack({
          evaluate({ workspace }) {
            const compatibilityWorkspace = toCompatibilityWorkspace(workspace);
            return [
              {
                id: 'test-extension:app',
                ruleId: 'test.extension.project-present',
                project: compatibilityWorkspace.projects[0]?.id ?? 'workspace',
                severity: 'warning',
                category: 'architecture',
                message: 'Extension rule executed.',
              },
            ];
          },
        });
      },
    },
  };
}
