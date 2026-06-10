import { fileURLToPath } from 'node:url';

import type {
  GovernanceDiagnostic,
  GovernanceWorkspaceAdapter,
} from '@anarchitects/governance-core';

import { runAgovWorkspaceValidate } from './workspace-validate.js';

describe('runAgovWorkspaceValidate', () => {
  it('keeps warning-severity adapter diagnostics valid', async () => {
    const result = await runAgovWorkspaceValidate({
      workspaceAdapter: createWorkspaceAdapter([
        {
          code: 'governance.adapter.partial_extraction',
          message: 'Workspace extraction was partial.',
          severity: 'warning',
          kind: 'observation',
          category: 'adapter',
        },
      ]),
      workspaceAdapterInput: '.',
    });

    expect(result.success).toBe(true);
    expect(result.workspace).toMatchObject({
      name: 'diagnostic-workspace',
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'governance.adapter.partial_extraction',
        severity: 'warning',
      }),
    ]);
    expect(result.summary).toMatchObject({
      status: 'valid',
      errorCount: 0,
      diagnosticCount: 1,
      warningCount: 1,
    });
  });

  it('returns invalid when adapter diagnostics include top-level errors', async () => {
    const result = await runAgovWorkspaceValidate({
      workspaceAdapter: createWorkspaceAdapter([
        {
          code: 'governance.adapter.workspace_error',
          message: 'Workspace extraction failed.',
          severity: 'error',
          kind: 'error',
          category: 'adapter',
        },
      ]),
      workspaceAdapterInput: '.',
    });

    expect(result.success).toBe(false);
    expect(result.workspace).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'governance.adapter.workspace_error',
        severity: 'error',
      }),
    ]);
    expect(result.summary).toMatchObject({
      status: 'invalid',
      errorCount: 1,
      diagnosticCount: 1,
      warningCount: 0,
    });
  });

  it('keeps informational diagnostics without severity valid', async () => {
    const result = await runAgovWorkspaceValidate({
      workspaceAdapter: createWorkspaceAdapter([
        {
          code: 'governance.adapter.discovery_observation',
          message:
            'Discovery patterns matched nothing, but all projects were found.',
          kind: 'observation',
          category: 'adapter',
        },
      ]),
      workspaceAdapterInput: '.',
    });

    expect(result.success).toBe(true);
    expect(result.workspace).toMatchObject({
      name: 'diagnostic-workspace',
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'governance.adapter.discovery_observation',
      }),
    ]);
    expect(result.summary).toMatchObject({
      status: 'valid',
      errorCount: 0,
      diagnosticCount: 1,
      warningCount: 0,
    });
  });

  it('counts legacy details.severity warnings without invalidating the workspace', async () => {
    const result = await runAgovWorkspaceValidate({
      workspaceAdapter: createWorkspaceAdapter([
        {
          code: 'governance.adapter.legacy_warning',
          message: 'Legacy warning diagnostic.',
          details: {
            severity: 'warning',
          },
        },
      ]),
      workspaceAdapterInput: '.',
    });

    expect(result.success).toBe(true);
    expect(result.summary).toMatchObject({
      status: 'valid',
      errorCount: 0,
      diagnosticCount: 1,
      warningCount: 1,
    });
  });

  it('counts legacy details.severity errors as invalid', async () => {
    const result = await runAgovWorkspaceValidate({
      workspaceAdapter: createWorkspaceAdapter([
        {
          code: 'governance.adapter.legacy_error',
          message: 'Legacy error diagnostic.',
          details: {
            severity: 'error',
          },
        },
      ]),
      workspaceAdapterInput: '.',
    });

    expect(result.success).toBe(false);
    expect(result.summary).toMatchObject({
      status: 'invalid',
      errorCount: 1,
      diagnosticCount: 1,
      warningCount: 0,
    });
  });

  it('preserves manual workspace validation failures', async () => {
    const result = await runAgovWorkspaceValidate({
      workspacePath: fixturePath(
        '../tests/fixtures/standalone-cli/non-nx/invalid-workspace/governance.workspace.yaml',
      ),
    });

    expect(result.success).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.diagnostics).toBeUndefined();
    expect(result.summary).toMatchObject({
      status: 'invalid',
      errorCount: expect.any(Number),
      diagnosticCount: 0,
      warningCount: 0,
    });
  });

  it('preserves manual workspace load failures', async () => {
    const result = await runAgovWorkspaceValidate({
      workspacePath: fixturePath(
        '../tests/fixtures/standalone-cli/non-nx/missing-workspace/governance.workspace.yaml',
      ),
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        source: 'governance-cli:workspace-loader',
      }),
    ]);
    expect(result.summary).toMatchObject({
      status: 'invalid',
      errorCount: 0,
      diagnosticCount: 1,
      warningCount: 0,
    });
  });
});

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function createWorkspaceAdapter(
  diagnostics: GovernanceDiagnostic[],
): GovernanceWorkspaceAdapter<string> {
  return {
    id: 'test-adapter:workspace-validate',
    loadWorkspace() {
      return {
        workspaceId: 'diagnostic-workspace',
        workspaceName: 'diagnostic-workspace',
        workspaceRoot: '.',
        nodes: [
          {
            id: 'app',
            name: 'app',
            kind: 'application',
            root: 'apps/app',
          },
        ],
        relations: [],
        diagnostics,
      };
    },
  };
}
