import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type AgovCliRuntime,
  AGOV_EXIT_CONFIGURATION_FAILURE,
  AGOV_EXIT_GOVERNANCE_FAILURE,
  AGOV_EXIT_RUNTIME_FAILURE,
  AGOV_EXIT_SUCCESS,
  runAgovCli,
} from './agov.js';

describe('agov check', () => {
  it('executes a valid non-Nx governance check with explicit workspace and profile paths', () => {
    const io = createMemoryIo();

    const exitCode = runAgovCli(
      [
        'check',
        '--workspace',
        workspaceFixturePath(),
        '--profile',
        standaloneCliFixturePath('passing-profile.json'),
        '--format',
        'json',
      ],
      io,
    );

    expect(exitCode).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'check',
      success: true,
      assessment: {
        workspace: {
          id: 'demo',
          name: 'demo',
          root: '.',
          projects: [
            expect.objectContaining({
              id: 'customer-domain',
              domain: 'customer',
              layer: 'domain',
            }),
            expect.objectContaining({
              id: 'order-domain',
              domain: 'order',
              layer: 'domain',
            }),
          ],
          dependencies: [
            {
              source: 'customer-domain',
              target: 'order-domain',
              type: 'static',
            },
          ],
        },
        profile: 'check-pass',
        warnings: [],
        violations: [],
        signalBreakdown: {
          total: 0,
        },
        health: {
          score: 65,
          status: 'critical',
          grade: 'D',
        },
        recommendations: [],
      },
    });
    expect(io.err).toBe('');
  });

  it('renders markdown output to stdout', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'markdown',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('# agov check');
    expect(io.out).toContain('## Signal Sources');
    expect(io.out).toContain('| Source | Count |');
    expect(io.err).toBe('');
  });

  it('renders table output to stdout', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'table',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov check');
    expect(io.out).toContain('Governance Check - check-pass');
    expect(io.out).toContain('Field      Value');
    expect(io.err).toBe('');
  });

  it('keeps warning-only findings below the default error threshold', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('warning-profile.json'),
          '--format',
          'json',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      success: true,
      assessment: {
        profile: 'check-warning',
        violations: expect.arrayContaining([
          expect.objectContaining({
            severity: 'warning',
          }),
        ]),
      },
    });
    expect(io.err).toBe('');
  });

  it('fails when warning findings meet the configured warning threshold', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('warning-profile.json'),
          '--format',
          'json',
          '--fail-on',
          'warning',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_GOVERNANCE_FAILURE);
    expect(JSON.parse(io.out)).toMatchObject({
      success: false,
      assessment: {
        profile: 'check-warning',
        violations: expect.arrayContaining([
          expect.objectContaining({
            severity: 'warning',
          }),
        ]),
      },
    });
    expect(io.err).toBe('');
  });

  it('fails when error findings meet the configured error threshold across output formats', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('error-profile.json'),
          '--format',
          'markdown',
          '--fail-on',
          'error',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_GOVERNANCE_FAILURE);
    expect(io.out).toContain('# agov check');
    expect(io.out).toContain('- Success: false');
    expect(io.err).toBe('');
  });

  it('allows governance findings when fail-on is set to none', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('error-profile.json'),
          '--format',
          'json',
          '--fail-on',
          'none',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      success: true,
      assessment: {
        profile: 'check-error',
        violations: expect.arrayContaining([
          expect.objectContaining({
            severity: 'error',
          }),
        ]),
      },
    });
    expect(io.err).toBe('');
  });

  it('returns a deterministic usage error when the workspace path is missing', () => {
    const io = createMemoryIo();

    expect(runAgovCli(['check', '--profile', 'profile.json'], io)).toBe(
      AGOV_EXIT_CONFIGURATION_FAILURE,
    );
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.missing_workspace',
        message: 'Missing required agov check option "--workspace".',
      },
    });
  });

  it('returns a deterministic usage error when the profile path is missing', () => {
    const io = createMemoryIo();

    expect(runAgovCli(['check', '--workspace', 'workspace.yaml'], io)).toBe(
      AGOV_EXIT_CONFIGURATION_FAILURE,
    );
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.missing_profile',
        message: 'Missing required agov check option "--profile".',
      },
    });
  });

  it('returns a deterministic usage error for an unsupported format', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          'workspace.yaml',
          '--profile',
          'profile.json',
          '--format',
          'html',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.unsupported_format',
        message:
          'Unsupported agov check format. Supported formats are "json", "markdown", and "table".',
      },
    });
  });

  it('returns a deterministic usage error for an unsupported fail-on threshold', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          'workspace.yaml',
          '--profile',
          'profile.json',
          '--fail-on',
          'fatal',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.unsupported_fail_on',
        message:
          'Unsupported agov check fail-on threshold. Supported values are "none", "warning", and "error".',
      },
    });
  });

  it('returns a deterministic JSON error for an invalid workspace file', () => {
    const io = createMemoryIo();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'agov-invalid-workspace-'));
    const invalidWorkspacePath = path.join(tempDir, 'invalid-workspace.yaml');
    writeFileSync(
      invalidWorkspacePath,
      'schemaVersion: 1\nworkspace: [\n',
      'utf8',
    );

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          invalidWorkspacePath,
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'json',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.workspace_load_failed',
        message: `Failed to parse YAML workspace file "${path.resolve(
          invalidWorkspacePath,
        )}".`,
        details: {
          filePath: path.resolve(invalidWorkspacePath),
          loaderCode: 'governance.workspace_loader.parse_error',
        },
      },
    });
  });

  it('returns a deterministic JSON error for an invalid profile file', () => {
    const io = createMemoryIo();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'agov-invalid-profile-'));
    const invalidProfilePath = path.join(tempDir, 'invalid-profile.json');
    writeFileSync(invalidProfilePath, '{"name":"broken"', 'utf8');

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          invalidProfilePath,
          '--format',
          'json',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.profile_load_failed',
        message: `Failed to parse JSON governance profile file "${path.resolve(
          invalidProfilePath,
        )}".`,
        details: {
          filePath: path.resolve(invalidProfilePath),
          loaderCode: 'governance.profile_loader.parse_error',
        },
      },
    });
  });

  it('rejects an existing Nx Governance runtime profile file intentionally', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          nxRuntimeProfilePath(),
          '--format',
          'json',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.invalid_profile',
        message: `Standalone governance profile validation failed for "${path.resolve(
          nxRuntimeProfilePath(),
        )}" with 3 issues.`,
        details: {
          filePath: path.resolve(nxRuntimeProfilePath()),
          issues: [
            {
              code: 'governance.profile.unsupported_nx_runtime_profile',
              message:
                'Nx Governance runtime profile files are not supported by the standalone CLI. Use a standalone profile with an explicit "name" field and without Nx-only override fields such as "projectOverrides", "exceptions", or legacy metric weight keys.',
              path: '/',
            },
            {
              code: 'governance.profile.unknown_field',
              message: 'Unknown field "projectOverrides" is not allowed.',
              path: '/projectOverrides',
            },
            {
              code: 'governance.profile.missing_required_field',
              message: 'Profile name is required.',
              path: '/name',
            },
          ],
        },
      },
    });
  });

  it('writes report output to an explicit file path instead of stdout', () => {
    const io = createMemoryIo();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'agov-output-'));
    const outputPath = path.join(tempDir, 'report.md');

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'markdown',
          '--output',
          outputPath,
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toBe('');
    expect(io.err).toBe('');
    expect(readFileSync(outputPath, 'utf8')).toContain('# agov check');
    expect(statSync(outputPath).isFile()).toBe(true);
  });

  it('returns a deterministic output write error for an invalid output path', () => {
    const io = createMemoryIo();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'agov-output-failure-'));
    const outputPath = path.join(tempDir, 'missing', 'report.md');

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'table',
          '--output',
          outputPath,
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.output_write_failed',
        message: `Failed to write agov report output to "${path.resolve(
          outputPath,
        )}".`,
        details: {
          filePath: path.resolve(outputPath),
        },
      },
    });
    expect(io.out).toBe('');
  });

  it('returns a deterministic runtime exit code for internal execution failures', () => {
    const io = createMemoryIo();
    const runtime: AgovCliRuntime = {
      runAgovCheck() {
        throw new Error('Synthetic standalone agov failure.');
      },
    };

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'json',
        ],
        io,
        runtime,
      ),
    ).toBe(AGOV_EXIT_RUNTIME_FAILURE);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.unhandled_error',
        message: 'Synthetic standalone agov failure.',
      },
    });
    expect(io.out).toBe('');
  });

  it('produces deterministic JSON output for the same inputs', () => {
    const first = createMemoryIo();
    const second = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'json',
        ],
        first,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'json',
        ],
        second,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(first.out).toBe(second.out);
  });

  it('produces deterministic markdown output for the same inputs', () => {
    const first = createMemoryIo();
    const second = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'markdown',
        ],
        first,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'markdown',
        ],
        second,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(first.out).toBe(second.out);
  });

  it('produces deterministic table output for the same inputs', () => {
    const first = createMemoryIo();
    const second = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'table',
        ],
        first,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('passing-profile.json'),
          '--format',
          'table',
        ],
        second,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(first.out).toBe(second.out);
  });

  it('keeps governance exit semantics deterministic for the same thresholded inputs', () => {
    const first = createMemoryIo();
    const second = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('warning-profile.json'),
          '--format',
          'table',
          '--fail-on',
          'warning',
        ],
        first,
      ),
    ).toBe(AGOV_EXIT_GOVERNANCE_FAILURE);
    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspaceFixturePath(),
          '--profile',
          standaloneCliFixturePath('warning-profile.json'),
          '--format',
          'table',
          '--fail-on',
          'warning',
        ],
        second,
      ),
    ).toBe(AGOV_EXIT_GOVERNANCE_FAILURE);
    expect(first.out).toBe(second.out);
  });

  it('keeps standalone CLI files free of Nx imports', () => {
    const sourceRoot = fileURLToPath(new URL('.', import.meta.url));

    for (const filePath of [
      path.join(sourceRoot, 'agov.ts'),
      path.join(sourceRoot, 'check.ts'),
      path.join(sourceRoot, 'render-report.ts'),
    ]) {
      const source = readFileSync(filePath, 'utf8');

      expect(source).not.toMatch(/from ['"]nx['"]/);
      expect(source).not.toMatch(/from ['"]@nx\//);
      expect(source).not.toMatch(/workspaceRoot/);
    }
  });
});

function workspaceFixturePath(): string {
  return path.join(
    fileURLToPath(
      new URL('../tests/fixtures/manual-workspace', import.meta.url),
    ),
    'demo-workspace.yaml',
  );
}

function standaloneCliFixturePath(fileName: string): string {
  return path.join(
    fileURLToPath(new URL('../tests/fixtures/standalone-cli', import.meta.url)),
    fileName,
  );
}

function nxRuntimeProfilePath(): string {
  return path.join(
    fileURLToPath(
      new URL('../tests/fixtures/nx-runtime-profile', import.meta.url),
    ),
    'frontend-layered.json',
  );
}

function createMemoryIo(): {
  out: string;
  err: string;
  stdout(message: string): void;
  stderr(message: string): void;
} {
  return {
    out: '',
    err: '',
    stdout(message: string) {
      this.out = message;
    },
    stderr(message: string) {
      this.err = message;
    },
  };
}
