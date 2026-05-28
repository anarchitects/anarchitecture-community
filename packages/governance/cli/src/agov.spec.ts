import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type AgovCliEnvironment,
  AGOV_EXIT_CONFIGURATION_FAILURE,
  AGOV_EXIT_GOVERNANCE_FAILURE,
  AGOV_EXIT_RUNTIME_FAILURE,
  AGOV_EXIT_SUCCESS,
  runAgovCli,
} from './agov.js';

describe('agov executable command surface', () => {
  it('renders root help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['--help'], io)).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov');
    expect(io.out).toContain('agov profile validate [options]');
    expect(io.out).toContain('agov workspace validate [options]');
    expect(io.out).toContain('agov check [options]');
    expect(io.out).toContain('agov assess [options]');
    expect(io.out).toContain('agov dependencies [options]');
    expect(io.out).toContain('agov metrics [options]');
    expect(io.out).toContain('agov recommendations [options]');
    expect(io.out).toContain('agov signals [options]');
    expect(io.out).toContain('agov violations [options]');
    expect(io.out).toContain('agov inspect [options]');
    expect(io.err).toBe('');
  });

  it('renders check help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['check', '--help'], io)).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov check');
    expect(io.out).toContain('--config <path>');
    expect(io.out).toContain('--adapter <package>');
    expect(io.err).toBe('');
  });

  it('renders profile validate help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['profile', 'validate', '--help'], io)).toBe(
      AGOV_EXIT_SUCCESS,
    );
    expect(io.out).toContain('agov profile validate');
    expect(io.out).toContain('--profile <path>');
    expect(io.out).toContain('--config <path>');
    expect(io.err).toBe('');
  });

  it('renders workspace validate help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['workspace', 'validate', '--help'], io)).toBe(
      AGOV_EXIT_SUCCESS,
    );
    expect(io.out).toContain('agov workspace validate');
    expect(io.out).toContain('--workspace <path>');
    expect(io.out).toContain('--adapter <package>');
    expect(io.err).toBe('');
  });

  it('renders assess help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['assess', '--help'], io)).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov assess');
    expect(io.out).toContain('--config <path>');
    expect(io.out).toContain('--adapter <package>');
    expect(io.err).toBe('');
  });

  it('renders inspect help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['inspect', '--help'], io)).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov inspect');
    expect(io.out).toContain('--project <value>');
    expect(io.out).toContain('--domain <value>');
    expect(io.out).toContain('--layer <value>');
    expect(io.out).toContain('--type <value>');
    expect(io.err).toBe('');
  });

  it('renders dependencies help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['dependencies', '--help'], io)).toBe(
      AGOV_EXIT_SUCCESS,
    );
    expect(io.out).toContain('agov dependencies');
    expect(io.out).toContain('--source <value>');
    expect(io.out).toContain('--target <value>');
    expect(io.out).toContain('--project <value>');
    expect(io.out).toContain('--type <value>');
    expect(io.err).toBe('');
  });

  it('renders metrics help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['metrics', '--help'], io)).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov metrics');
    expect(io.out).toContain('--family <value>');
    expect(io.out).toContain('--metric <value>');
    expect(io.out).toContain('--weakest <value>');
    expect(io.err).toBe('');
  });

  it('renders violations help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['violations', '--help'], io)).toBe(
      AGOV_EXIT_SUCCESS,
    );
    expect(io.out).toContain('agov violations');
    expect(io.out).toContain('--severity <value>');
    expect(io.out).toContain('--rule <value>');
    expect(io.out).toContain('--category <value>');
    expect(io.out).toContain('--project <value>');
    expect(io.out).toContain('--source-plugin <value>');
    expect(io.err).toBe('');
  });

  it('renders recommendations help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['recommendations', '--help'], io)).toBe(
      AGOV_EXIT_SUCCESS,
    );
    expect(io.out).toContain('agov recommendations');
    expect(io.out).toContain('--priority <value>');
    expect(io.err).toBe('');
  });

  it('renders signals help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['signals', '--help'], io)).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov signals');
    expect(io.out).toContain('--source <value>');
    expect(io.out).toContain('--type <value>');
    expect(io.out).toContain('--severity <value>');
    expect(io.err).toBe('');
  });

  it('renders version', async () => {
    const io = createMemoryIo();
    const environment = createEnvironment({
      packageVersion: () => '9.9.9-test',
    });

    expect(await runAgovCli(['--version'], io, undefined, environment)).toBe(
      AGOV_EXIT_SUCCESS,
    );
    expect(io.out).toBe('9.9.9-test');
    expect(io.err).toBe('');
  });

  it('fails on incomplete nested commands with a stable unknown-command usage error', async () => {
    const profileIo = createMemoryIo();
    const workspaceIo = createMemoryIo();

    expect(await runAgovCli(['profile'], profileIo)).toBe(
      AGOV_EXIT_CONFIGURATION_FAILURE,
    );
    expect(await runAgovCli(['workspace'], workspaceIo)).toBe(
      AGOV_EXIT_CONFIGURATION_FAILURE,
    );

    expect(JSON.parse(profileIo.err)).toMatchObject({
      error: {
        code: 'agov.cli.unknown_command',
        message: expect.stringContaining('Supported profile command is'),
      },
    });
    expect(JSON.parse(workspaceIo.err)).toMatchObject({
      error: {
        code: 'agov.cli.unknown_command',
        message: expect.stringContaining('Supported workspace command is'),
      },
    });
  });

  it('fails on unknown nested subcommands with a stable unknown-command usage error', async () => {
    const profileIo = createMemoryIo();
    const workspaceIo = createMemoryIo();

    expect(await runAgovCli(['profile', 'inspect'], profileIo)).toBe(
      AGOV_EXIT_CONFIGURATION_FAILURE,
    );
    expect(await runAgovCli(['workspace', 'inspect'], workspaceIo)).toBe(
      AGOV_EXIT_CONFIGURATION_FAILURE,
    );

    expect(JSON.parse(profileIo.err)).toMatchObject({
      error: {
        code: 'agov.cli.unknown_command',
        message: expect.stringContaining('Supported profile command is'),
      },
    });
    expect(JSON.parse(workspaceIo.err)).toMatchObject({
      error: {
        code: 'agov.cli.unknown_command',
        message: expect.stringContaining('Supported workspace command is'),
      },
    });
  });

  it('rejects unknown options consistently across implemented commands', async () => {
    const cwd = createTempWorkspaceRoot('agov-unknown-options-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));

    const cases: Array<{ args: string[]; label: string }> = [
      {
        label: 'check',
        args: [
          'check',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
        ],
      },
      {
        label: 'assess',
        args: [
          'assess',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
        ],
      },
      {
        label: 'inspect',
        args: ['inspect', '--workspace', './workspace.json'],
      },
      {
        label: 'metrics',
        args: [
          'metrics',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
        ],
      },
      {
        label: 'violations',
        args: [
          'violations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
        ],
      },
      {
        label: 'recommendations',
        args: [
          'recommendations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
        ],
      },
      {
        label: 'signals',
        args: [
          'signals',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
        ],
      },
      {
        label: 'dependencies',
        args: ['dependencies', '--workspace', './workspace.json'],
      },
      {
        label: 'profile validate',
        args: ['profile', 'validate', '--profile', './profile.json'],
      },
      {
        label: 'workspace validate',
        args: ['workspace', 'validate', '--workspace', './workspace.json'],
      },
    ];

    for (const testCase of cases) {
      const io = createMemoryIo();

      expect(
        await runAgovCli(
          [...testCase.args, '--unknown-option'],
          io,
          undefined,
          createEnvironment({ cwd }),
        ),
      ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

      expect(JSON.parse(io.err)).toMatchObject({
        error: {
          code: 'agov.cli.unknown_option',
          message: expect.stringContaining('Unknown agov option'),
        },
      });
      expect(io.out).toBe('');
    }
  });

  it('returns a usage error when nothing can be resolved', async () => {
    const io = createMemoryIo();
    const cwd = mkdtempSync(path.join(tmpdir(), 'agov-empty-'));

    expect(
      await runAgovCli(['check'], io, undefined, createEnvironment({ cwd })),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.missing_profile',
        message:
          'Could not resolve a governance profile. Pass "--profile <path>", set "profile" in agov.config.json or governance.config.json, or add a conventional profile file such as "governance.profile.json".',
      },
    });
  });

  it('uses conventional workspace and profile discovery with no explicit flags', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-conventions-');

    writeFixtureWorkspace(path.join(cwd, 'governance.workspace.json'));
    writeFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(['check'], io, undefined, createEnvironment({ cwd })),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov check');
    expect(io.out).toContain('workspace  demo');
    expect(io.err).toBe('');
  });

  it('supports assess in conventional discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-assess-conventions-');

    writeFixtureWorkspace(path.join(cwd, 'governance.workspace.json'));
    writeFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(['assess'], io, undefined, createEnvironment({ cwd })),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov assess');
    expect(io.out).toContain('workspace  demo');
    expect(io.err).toBe('');
  });

  it('validates profile in conventional discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-profile-validate-conventions-');

    writeFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(
        ['profile', 'validate', '--format', 'json'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'profile validate',
      success: true,
      profilePath: expect.stringContaining('governance.profile.json'),
      summary: {
        status: 'valid',
      },
    });
    expect(io.err).toBe('');
  });

  it('supports dependencies in conventional workspace discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-dependencies-conventions-');

    writeFixtureWorkspace(path.join(cwd, 'governance.workspace.json'));

    expect(
      await runAgovCli(
        ['dependencies', '--format', 'json'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'dependencies',
      dependencies: expect.any(Array),
      projects: expect.any(Array),
      summary: {
        totalDependencies: expect.any(Number),
      },
    });
    expect(io.err).toBe('');
  });

  it('uses conventional config discovery', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-config-discovery-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));
    writeJson(path.join(cwd, 'agov.config.json'), {
      workspace: './workspace.json',
      profile: './profile.json',
      format: 'json',
    });

    expect(
      await runAgovCli(['check'], io, undefined, createEnvironment({ cwd })),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'check',
      success: true,
      assessment: {
        workspace: {
          name: 'demo',
        },
      },
    });
    expect(io.err).toBe('');
  });

  it('validates profile using config-based profile resolution', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-profile-validate-config-');

    writeFixtureProfile(path.join(cwd, 'profile.json'));
    writeJson(path.join(cwd, 'agov.config.json'), {
      profile: './profile.json',
      format: 'json',
    });

    expect(
      await runAgovCli(
        ['profile', 'validate'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'profile validate',
      success: true,
      profilePath: path.join(cwd, 'profile.json'),
      summary: {
        status: 'valid',
      },
    });
    expect(io.err).toBe('');
  });

  it('supports profile validate with explicit --profile and --format json', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-profile-validate-explicit-');

    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'profile',
          'validate',
          '--profile',
          './profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'profile validate',
      success: true,
      profilePath: path.join(cwd, 'profile.json'),
      summary: {
        status: 'valid',
      },
    });
    expect(io.err).toBe('');
  });

  it('returns success exit code for valid profile validation', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-profile-validate-valid-exit-');

    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        ['profile', 'validate', '--profile', './profile.json'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.err).toBe('');
  });

  it('includes command and success=true in valid profile validation json output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-profile-validate-valid-json-');

    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'profile',
          'validate',
          '--profile',
          './profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const parsed = JSON.parse(io.out) as {
      command: string;
      success: boolean;
    };

    expect(parsed.command).toBe('profile validate');
    expect(parsed.success).toBe(true);
    expect(io.err).toBe('');
  });

  it('returns configuration failure and structured json for invalid profile', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-profile-validate-invalid-json-');

    writeInvalidFixtureProfile(path.join(cwd, 'invalid-profile.json'));

    expect(
      await runAgovCli(
        [
          'profile',
          'validate',
          '--profile',
          './invalid-profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    const parsed = JSON.parse(io.out) as {
      command: string;
      success: boolean;
      errors: Array<unknown>;
      summary: { status: string };
    };

    expect(parsed.command).toBe('profile validate');
    expect(parsed.success).toBe(false);
    expect(parsed.summary.status).toBe('invalid');
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(io.err).toBe('');
  });

  it('returns configuration failure for missing profile path', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-profile-validate-missing-');

    expect(
      await runAgovCli(
        ['profile', 'validate', '--profile', './missing-profile.json'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);
    expect(io.out).toBe('');
    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.invalid_config',
      },
    });
  });

  it('renders profile validate status in table output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-profile-validate-table-');

    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'profile',
          'validate',
          '--profile',
          './profile.json',
          '--format',
          'table',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(io.out).toContain('agov profile validate');
    expect(io.out).toContain('status');
    expect(io.out).toContain('valid');
    expect(io.err).toBe('');
  });

  it('renders profile validate markdown without raw object dumps', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-profile-validate-markdown-');

    writeInvalidFixtureProfile(path.join(cwd, 'invalid-profile.json'));

    expect(
      await runAgovCli(
        [
          'profile',
          'validate',
          '--profile',
          './invalid-profile.json',
          '--format',
          'markdown',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    expect(io.out).toContain('# agov profile validate');
    expect(io.out).toContain('## Summary');
    expect(io.out).not.toContain('[object Object]');
    expect(io.err).toBe('');
  });

  it('supports workspace validate with explicit --workspace and --format json', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-workspace-validate-explicit-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));

    expect(
      await runAgovCli(
        [
          'workspace',
          'validate',
          '--workspace',
          './workspace.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'workspace validate',
      success: true,
      workspacePath: path.join(cwd, 'workspace.json'),
      summary: {
        status: 'valid',
      },
    });
    expect(io.err).toBe('');
  });

  it('validates workspace in conventional discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-workspace-validate-conventions-');

    writeFixtureWorkspace(path.join(cwd, 'governance.workspace.json'));

    expect(
      await runAgovCli(
        ['workspace', 'validate', '--format', 'json'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'workspace validate',
      success: true,
      workspacePath: expect.stringContaining('governance.workspace.json'),
    });
    expect(io.err).toBe('');
  });

  it('validates workspace using config-based workspace resolution', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-workspace-validate-config-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeJson(path.join(cwd, 'agov.config.json'), {
      workspace: './workspace.json',
      format: 'json',
    });

    expect(
      await runAgovCli(
        ['workspace', 'validate'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'workspace validate',
      success: true,
      workspacePath: path.join(cwd, 'workspace.json'),
      summary: {
        status: 'valid',
      },
    });
    expect(io.err).toBe('');
  });

  it('returns configuration failure and structured json for invalid workspace validation', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-workspace-validate-invalid-');

    writeInvalidFixtureWorkspace(path.join(cwd, 'invalid-workspace.json'));

    expect(
      await runAgovCli(
        [
          'workspace',
          'validate',
          '--workspace',
          './invalid-workspace.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    const parsed = JSON.parse(io.out) as {
      command: string;
      success: boolean;
      summary: { status: string };
      errors: Array<unknown>;
    };

    expect(parsed.command).toBe('workspace validate');
    expect(parsed.success).toBe(false);
    expect(parsed.summary.status).toBe('invalid');
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(io.err).toBe('');
  });

  it('returns configuration failure for missing workspace path', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-workspace-validate-missing-');

    expect(
      await runAgovCli(
        ['workspace', 'validate', '--workspace', './missing-workspace.json'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    expect(io.out).toContain('agov workspace validate');
    expect(io.out).toContain('invalid');
    expect(io.err).toBe('');
  });

  it('supports workspace validate with explicit adapter mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-workspace-validate-adapter-');

    expect(
      await runAgovCli(
        [
          'workspace',
          'validate',
          '--adapter',
          '@anarchitects/governance-adapter-typescript',
          '--root',
          '.',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async () =>
            createAdapterModule({ workspaceName: path.basename(cwd) }),
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'workspace validate',
      success: true,
      adapterPackage: '@anarchitects/governance-adapter-typescript',
      summary: {
        status: 'valid',
      },
      workspace: {
        name: path.basename(cwd),
      },
    });
    expect(io.err).toBe('');
  });

  it('supports workspace validate in adapter discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createAdapterDiscoveryFixture(
      'agov-workspace-validate-discovery-',
      ['adapter-one', 'adapter-two'],
    );

    expect(
      await runAgovCli(
        ['workspace', 'validate', '--format', 'json'],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async (specifier: string) => {
            if (specifier === 'adapter-one') {
              return createProbeableAdapterModule({
                workspaceName: 'unsupported-workspace',
                supported: false,
                confidence: 'low',
              });
            }

            return createProbeableAdapterModule({
              workspaceName: 'supported-workspace',
              supported: true,
              confidence: 'high',
            });
          },
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'workspace validate',
      success: true,
      adapterPackage: 'adapter-two',
      workspace: {
        name: 'supported-workspace',
      },
    });
    expect(io.err).toBe('');
  });

  it('returns runtime failure for workspace validate adapter load or contract mismatches', async () => {
    const loadFailureIo = createMemoryIo();
    const loadFailureCwd = createTempWorkspaceRoot(
      'agov-workspace-validate-adapter-load-failure-',
    );

    expect(
      await runAgovCli(
        [
          'workspace',
          'validate',
          '--adapter',
          'missing-adapter',
          '--root',
          '.',
        ],
        loadFailureIo,
        undefined,
        createEnvironment({
          cwd: loadFailureCwd,
          moduleLoader: async () => {
            throw new Error('cannot resolve module');
          },
        }),
      ),
    ).toBe(AGOV_EXIT_RUNTIME_FAILURE);

    expect(JSON.parse(loadFailureIo.err)).toMatchObject({
      error: {
        code: 'agov.cli.adapter_not_found',
      },
    });
    expect(loadFailureIo.out).toBe('');

    const contractFailureIo = createMemoryIo();
    const contractFailureCwd = createTempWorkspaceRoot(
      'agov-workspace-validate-adapter-contract-failure-',
    );

    expect(
      await runAgovCli(
        [
          'workspace',
          'validate',
          '--adapter',
          'invalid-adapter',
          '--root',
          '.',
        ],
        contractFailureIo,
        undefined,
        createEnvironment({
          cwd: contractFailureCwd,
          moduleLoader: async () => ({ default: {} }),
        }),
      ),
    ).toBe(AGOV_EXIT_RUNTIME_FAILURE);

    expect(JSON.parse(contractFailureIo.err)).toMatchObject({
      error: {
        code: 'agov.cli.adapter_contract_mismatch',
      },
    });
    expect(contractFailureIo.out).toBe('');
  });

  it('renders workspace validate status in text and table output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-workspace-validate-table-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));

    expect(
      await runAgovCli(
        [
          'workspace',
          'validate',
          '--workspace',
          './workspace.json',
          '--format',
          'table',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(io.out).toContain('agov workspace validate');
    expect(io.out).toContain('status');
    expect(io.out).toContain('valid');
    expect(io.err).toBe('');
  });

  it('renders workspace validate markdown without raw object dumps', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-workspace-validate-markdown-');

    writeInvalidFixtureWorkspace(path.join(cwd, 'invalid-workspace.json'));

    expect(
      await runAgovCli(
        [
          'workspace',
          'validate',
          '--workspace',
          './invalid-workspace.json',
          '--format',
          'markdown',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    expect(io.out).toContain('# agov workspace validate');
    expect(io.out).toContain('## Summary');
    expect(io.out).not.toContain('[object Object]');
    expect(io.err).toBe('');
  });

  it('discovers adapter candidates from config.adapters and selects a supported adapter by probe', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-config-adapters-');

    writeFixtureProfile(path.join(cwd, 'profile.json'));
    writeJson(path.join(cwd, 'agov.config.json'), {
      profile: './profile.json',
      adapters: ['adapter-one', 'adapter-two'],
      format: 'json',
    });

    expect(
      await runAgovCli(
        ['check'],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async (specifier: string) => {
            if (specifier === 'adapter-one') {
              return createProbeableAdapterModule({
                workspaceName: 'unsupported-workspace',
                supported: false,
                confidence: 'low',
              });
            }

            return createProbeableAdapterModule({
              workspaceName: 'config-selected-workspace',
              supported: true,
              confidence: 'high',
            });
          },
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'check',
      success: true,
      assessment: {
        workspace: {
          name: 'config-selected-workspace',
        },
      },
    });
    expect(io.err).toBe('');
  });

  it('uses an explicit config file path and resolves relative config values from the config directory', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-explicit-config-');
    const configDir = path.join(cwd, 'config');

    mkdirSync(configDir, { recursive: true });
    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));
    writeJson(path.join(configDir, 'agov.config.json'), {
      workspace: '../workspace.json',
      profile: '../profile.json',
      format: 'json',
    });

    expect(
      await runAgovCli(
        ['check', '--config', './config/agov.config.json'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      success: true,
      assessment: {
        profile: 'check-pass',
      },
    });
    expect(io.err).toBe('');
  });

  it('lets explicit flags override config values', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-config-override-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));
    writeJson(path.join(cwd, 'agov.config.json'), {
      workspace: './missing-workspace.json',
      profile: './profile.json',
      format: 'json',
    });

    expect(
      await runAgovCli(
        ['check', '--workspace', './workspace.json', '--format', 'text'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov check');
    expect(() => JSON.parse(io.out)).toThrow();
    expect(io.err).toBe('');
  });

  it('fails on explicit workspace plus explicit adapter ambiguity', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-ambiguous-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'check',
          '--workspace',
          './workspace.json',
          '--adapter',
          'custom-adapter',
          '--profile',
          './profile.json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.ambiguous_workspace_and_adapter',
        message:
          'agov check does not allow explicit "--workspace" and "--adapter" together. Use canonical workspace mode or adapter mode, not both.',
      },
    });
  });

  it('uses process.cwd as the default adapter root', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-default-root-');
    const observedInputs: string[] = [];

    writeFixtureProfile(path.join(cwd, 'profile.json'));

    const environment = createEnvironment({
      cwd,
      moduleLoader: async () => ({
        createGovernanceWorkspaceAdapter() {
          return {
            id: 'test:adapter',
            loadWorkspace(input: string) {
              observedInputs.push(input);
              return {
                workspaceId: 'adapter-demo',
                workspaceName: 'adapter-demo',
                workspaceRoot: '.',
                projects: [],
                dependencies: [],
              };
            },
          };
        },
      }),
    });

    expect(
      await runAgovCli(
        [
          'check',
          '--profile',
          './profile.json',
          '--adapter',
          'test-adapter-package',
          '--format',
          'json',
        ],
        io,
        undefined,
        environment,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(observedInputs).toEqual([cwd]);
    expect(JSON.parse(io.out)).toMatchObject({
      assessment: {
        workspace: {
          name: 'adapter-demo',
        },
      },
    });
  });

  it('loads an adapter dynamically by package name in explicit adapter mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-adapter-mode-');

    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'check',
          '--profile',
          './profile.json',
          '--adapter',
          '@anarchitects/governance-adapter-typescript',
          '--root',
          '.',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async () =>
            createAdapterModule({
              workspaceName: path.basename(cwd),
            }),
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'check',
      success: true,
      assessment: {
        workspace: {
          name: path.basename(cwd),
        },
      },
    });
    expect(io.err).toBe('');
  });

  it('supports assess in explicit adapter mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-assess-adapter-mode-');

    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'assess',
          '--profile',
          './profile.json',
          '--adapter',
          '@anarchitects/governance-adapter-typescript',
          '--root',
          '.',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async () =>
            createAdapterModule({
              workspaceName: path.basename(cwd),
            }),
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'assess',
      success: true,
      assessment: {
        workspace: {
          name: path.basename(cwd),
        },
      },
    });
    expect(io.err).toBe('');
  });

  it('discovers a compatible adapter from generic package metadata and probe results', async () => {
    const io = createMemoryIo();
    const cwd = createAdapterDiscoveryFixture('agov-adapter-discovery-', [
      'adapter-one',
      'adapter-two',
    ]);

    writeFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(
        ['check', '--profile', './governance.profile.json', '--format', 'json'],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async (specifier: string) => {
            if (specifier === 'adapter-one') {
              return createProbeableAdapterModule({
                workspaceName: 'unsupported-workspace',
                supported: false,
                confidence: 'low',
              });
            }

            return createProbeableAdapterModule({
              workspaceName: 'supported-workspace',
              supported: true,
              confidence: 'high',
            });
          },
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'check',
      success: true,
      assessment: {
        workspace: {
          name: 'supported-workspace',
        },
      },
    });
    expect(io.err).toBe('');
  });

  it('supports assess in adapter discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createAdapterDiscoveryFixture(
      'agov-assess-adapter-discovery-',
      ['adapter-one', 'adapter-two'],
    );

    writeFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(
        [
          'assess',
          '--profile',
          './governance.profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async (specifier: string) => {
            if (specifier === 'adapter-one') {
              return createProbeableAdapterModule({
                workspaceName: 'unsupported-workspace',
                supported: false,
                confidence: 'low',
              });
            }

            return createProbeableAdapterModule({
              workspaceName: 'supported-workspace',
              supported: true,
              confidence: 'high',
            });
          },
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'assess',
      success: true,
      assessment: {
        workspace: {
          name: 'supported-workspace',
        },
      },
    });
    expect(io.err).toBe('');
  });

  it('fails clearly when discovered adapter candidates cannot be loaded or do not support the workspace', async () => {
    const io = createMemoryIo();
    const cwd = createAdapterDiscoveryFixture(
      'agov-missing-discovered-adapter-',
      ['adapter-one', 'adapter-two'],
    );

    writeFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(
        ['check', '--profile', './governance.profile.json'],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async (specifier: string) => {
            if (specifier === 'adapter-one') {
              throw new Error('not found');
            }

            return createProbeableAdapterModule({
              workspaceName: 'unsupported-workspace',
              supported: false,
              confidence: 'low',
            });
          },
        }),
      ),
    ).toBe(AGOV_EXIT_RUNTIME_FAILURE);
    const parsedError = JSON.parse(io.err);

    expect(parsedError).toMatchObject({
      error: {
        code: 'agov.cli.no_supported_adapter',
        details: {
          attemptedPackages: ['adapter-one', 'adapter-two'],
          attempts: expect.arrayContaining([
            expect.objectContaining({
              packageName: 'adapter-one',
              status: 'load-failed',
            }),
            expect.objectContaining({
              packageName: 'adapter-two',
              status: 'unsupported',
            }),
          ]),
        },
      },
    });
    expect(parsedError.error.message).toContain(
      'Could not find a supported Governance adapter',
    );
  });

  it('fails clearly when an explicit adapter package cannot be resolved', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-missing-adapter-');

    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'check',
          '--profile',
          './profile.json',
          '--adapter',
          'missing-adapter',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async () => {
            throw new Error('not found');
          },
        }),
      ),
    ).toBe(AGOV_EXIT_RUNTIME_FAILURE);
    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.adapter_not_found',
        details: {
          adapter: 'missing-adapter',
          rootPath: cwd,
        },
      },
    });
  });

  it('fails clearly when a loaded package does not expose a compatible adapter contract', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-invalid-adapter-');

    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'check',
          '--profile',
          './profile.json',
          '--adapter',
          'invalid-adapter',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async () => ({
            notAnAdapter: true,
          }),
        }),
      ),
    ).toBe(AGOV_EXIT_RUNTIME_FAILURE);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.adapter_contract_mismatch',
        message:
          'Package "invalid-adapter" was loaded, but it does not expose a compatible Governance workspace adapter.',
        details: {
          adapter: 'invalid-adapter',
          rootPath: cwd,
        },
      },
    });
  });

  it('defaults to text output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-default-format-');

    writeFixtureWorkspace(path.join(cwd, 'governance.workspace.json'));
    writeFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(['check'], io, undefined, createEnvironment({ cwd })),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov check');
    expect(() => JSON.parse(io.out)).toThrow();
  });

  it('supports json output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-json-format-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'check',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'check',
      success: true,
    });
  });

  it('keeps check and assess governance failure semantics stable for failing profiles', async () => {
    const cwd = createTempWorkspaceRoot('agov-check-vs-assess-gating-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'failing-profile.json'));

    const checkIo = createMemoryIo();
    const assessIo = createMemoryIo();

    expect(
      await runAgovCli(
        [
          'check',
          '--workspace',
          './workspace.json',
          '--profile',
          './failing-profile.json',
          '--format',
          'json',
        ],
        checkIo,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_GOVERNANCE_FAILURE);

    expect(
      await runAgovCli(
        [
          'assess',
          '--workspace',
          './workspace.json',
          '--profile',
          './failing-profile.json',
          '--format',
          'json',
        ],
        assessIo,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_GOVERNANCE_FAILURE);

    expect(JSON.parse(checkIo.out)).toMatchObject({
      command: 'check',
      success: false,
    });
    expect(JSON.parse(assessIo.out)).toMatchObject({
      command: 'assess',
      success: false,
      assessment: {
        violations: expect.any(Array),
      },
    });
  });

  it('supports assess with json output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-assess-json-format-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'assess',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'assess',
      success: true,
    });
  });

  it('rejects unsupported format in check mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-check-unsupported-format-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'check',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'csv',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);
    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.unsupported_format',
      },
    });
    expect(io.out).toBe('');
  });

  it('rejects unsupported format in assess mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-assess-unsupported-format-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'assess',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'csv',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);
    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.unsupported_format',
      },
    });
    expect(io.out).toBe('');
  });

  it('supports table output explicitly', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-table-format-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'check',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'table',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('Field');
    expect(io.out).toContain('workspace');
    expect(() => JSON.parse(io.out)).toThrow();
  });

  it('supports markdown output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-markdown-format-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'check',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'markdown',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('# agov check');
    expect(io.out).toContain('| Field | Value |');
    expect(() => JSON.parse(io.out)).toThrow();
  });

  it('supports inspect in conventional discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-inspect-conventions-');

    writeFixtureWorkspace(path.join(cwd, 'governance.workspace.json'));

    expect(
      await runAgovCli(['inspect'], io, undefined, createEnvironment({ cwd })),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov inspect');
    expect(io.out).toContain('workspace');
    expect(io.out).toContain('demo');
    expect(io.err).toBe('');
  });

  it('supports inspect with explicit workspace input and table output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-inspect-workspace-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));

    expect(
      await runAgovCli(
        ['inspect', '--workspace', './workspace.json', '--format', 'table'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('Workspace');
    expect(io.out).toContain('Summary');
    expect(io.out).toContain('Projects');
    expect(io.out).toContain('Dependencies');
    expect(io.out).toContain('projects');
    expect(io.out).toContain('dependencies');
    expect(() => JSON.parse(io.out)).toThrow();
    expect(io.err).toBe('');
  });

  it('supports inspect with explicit adapter mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-inspect-adapter-mode-');

    expect(
      await runAgovCli(
        [
          'inspect',
          '--adapter',
          'test-adapter-package',
          '--root',
          '.',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async () =>
            createAdapterModule({ workspaceName: path.basename(cwd) }),
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'inspect',
      workspace: {
        name: path.basename(cwd),
      },
      adapter: {
        id: 'governance-adapter:typescript',
      },
    });
    expect(io.err).toBe('');
  });

  it('supports inspect in adapter discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createAdapterDiscoveryFixture(
      'agov-inspect-adapter-discovery-',
      ['adapter-one', 'adapter-two'],
    );

    expect(
      await runAgovCli(
        ['inspect', '--format', 'json'],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async (specifier: string) => {
            if (specifier === 'adapter-one') {
              return createProbeableAdapterModule({
                workspaceName: 'unsupported-workspace',
                supported: false,
                confidence: 'low',
              });
            }

            return createProbeableAdapterModule({
              workspaceName: 'supported-workspace',
              supported: true,
              confidence: 'high',
            });
          },
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'inspect',
      workspace: {
        name: 'supported-workspace',
      },
    });
    expect(io.err).toBe('');
  });

  it('filters inspect output by project scope', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-inspect-filters-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));

    expect(
      await runAgovCli(
        [
          'inspect',
          '--workspace',
          './workspace.json',
          '--project',
          'customer-domain',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const parsed = JSON.parse(io.out) as {
      projects: Array<{ id: string }>;
      dependencies: Array<Record<string, unknown>>;
    };

    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects[0]?.id).toBe('customer-domain');
    expect(parsed.dependencies).toHaveLength(1);
    expect(io.err).toBe('');
  });

  it('renders inspect json deterministically', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-inspect-json-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));

    expect(
      await runAgovCli(
        ['inspect', '--workspace', './workspace.json', '--format', 'json'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'inspect',
      workspace: {
        name: 'demo',
      },
      projects: [
        {
          id: 'customer-domain',
        },
        {
          id: 'order-domain',
        },
      ],
      dependencies: [
        {
          source: 'customer-domain',
          target: 'order-domain',
        },
      ],
    });
    expect(io.err).toBe('');
  });

  it('supports metrics in conventional discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-metrics-conventions-');

    writeFixtureWorkspace(path.join(cwd, 'governance.workspace.json'));
    writeFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(['metrics'], io, undefined, createEnvironment({ cwd })),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov metrics');
    expect(io.out).toContain('health score');
    expect(io.out).toContain('health grade');
    expect(io.out).toContain('health status');
    expect(io.err).toBe('');
  });

  it('supports metrics with explicit workspace/profile mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-metrics-workspace-mode-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'metrics',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'metrics',
      health: {
        score: expect.any(Number),
        grade: expect.any(String),
        status: expect.any(String),
      },
      measurements: expect.any(Array),
      metricBreakdown: {
        families: expect.any(Array),
      },
    });
    expect(io.err).toBe('');
  });

  it('supports metrics with explicit adapter mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-metrics-adapter-mode-');

    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'metrics',
          '--profile',
          './profile.json',
          '--adapter',
          'test-adapter-package',
          '--root',
          '.',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async () =>
            createAdapterModule({ workspaceName: path.basename(cwd) }),
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'metrics',
      workspace: {
        name: path.basename(cwd),
      },
      health: {
        score: expect.any(Number),
      },
    });
    expect(io.err).toBe('');
  });

  it('supports metrics in adapter discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createAdapterDiscoveryFixture(
      'agov-metrics-adapter-discovery-',
      ['adapter-one', 'adapter-two'],
    );

    writeFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(
        [
          'metrics',
          '--profile',
          './governance.profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async (specifier: string) => {
            if (specifier === 'adapter-one') {
              return createProbeableAdapterModule({
                workspaceName: 'unsupported-workspace',
                supported: false,
                confidence: 'low',
              });
            }

            return createProbeableAdapterModule({
              workspaceName: 'supported-workspace',
              supported: true,
              confidence: 'high',
            });
          },
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'metrics',
      workspace: {
        name: 'supported-workspace',
      },
    });
    expect(io.err).toBe('');
  });

  it('supports metrics json output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-metrics-json-format-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'metrics',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'metrics',
      health: {
        status: expect.any(String),
      },
      measurements: expect.any(Array),
      metricBreakdown: {
        families: expect.any(Array),
      },
    });
    expect(io.err).toBe('');
  });

  it('filters metrics output by family and weakest count', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-metrics-filters-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'metrics',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--family',
          'architecture',
          '--weakest',
          '1',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const parsed = JSON.parse(io.out) as {
      measurements: Array<{ family: string }>;
      summary: { weakestMetrics: Array<unknown> };
    };

    expect(
      parsed.measurements.every(
        (measurement) => measurement.family === 'architecture',
      ),
    ).toBe(true);
    expect(parsed.summary.weakestMetrics).toHaveLength(1);
    expect(io.err).toBe('');
  });

  it('supports recommendations in conventional discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-recommendations-conventions-');

    writeFixtureWorkspace(path.join(cwd, 'governance.workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(
        ['recommendations'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov recommendations');
    expect(io.out).toContain('Summary');
    expect(io.err).toBe('');
  });

  it('supports recommendations with explicit workspace/profile mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-recommendations-workspace-mode-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'recommendations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'recommendations',
      recommendations: expect.any(Array),
      summary: {
        total: expect.any(Number),
      },
    });
    expect(io.err).toBe('');
  });

  it('supports recommendations with explicit adapter mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-recommendations-adapter-mode-');

    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'recommendations',
          '--profile',
          './profile.json',
          '--adapter',
          'test-adapter-package',
          '--root',
          '.',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async () =>
            createAdapterModule({ workspaceName: path.basename(cwd) }),
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'recommendations',
      workspace: {
        name: path.basename(cwd),
      },
      recommendations: expect.any(Array),
      summary: expect.any(Object),
    });
    expect(io.err).toBe('');
  });

  it('supports recommendations in adapter discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createAdapterDiscoveryFixture(
      'agov-recommendations-adapter-discovery-',
      ['adapter-one', 'adapter-two'],
    );

    writeFailingFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(
        [
          'recommendations',
          '--profile',
          './governance.profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async (specifier: string) => {
            if (specifier === 'adapter-one') {
              return createProbeableAdapterModule({
                workspaceName: 'unsupported-workspace',
                supported: false,
                confidence: 'low',
              });
            }

            return createProbeableAdapterModule({
              workspaceName: 'supported-workspace',
              supported: true,
              confidence: 'high',
            });
          },
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'recommendations',
      workspace: {
        name: 'supported-workspace',
      },
    });
    expect(io.err).toBe('');
  });

  it('supports recommendations json output with stable command fields', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-recommendations-json-format-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'recommendations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'recommendations',
      workspace: {
        name: 'demo',
      },
      profile: expect.any(String),
      recommendations: expect.any(Array),
      summary: {
        total: expect.any(Number),
        byPriority: expect.any(Array),
      },
    });
    expect(io.err).toBe('');
  });

  it('renders recommendations summary in text and table output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-recommendations-text-table-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'recommendations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'table',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(io.out).toContain('agov recommendations');
    expect(io.out).toContain('Summary');
    expect(io.out).toContain('highest priority');
    expect(io.err).toBe('');
  });

  it('filters recommendations by high priority', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-recommendations-high-filter-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'recommendations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--priority',
          'high',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const parsed = JSON.parse(io.out) as {
      summary: { total: number };
      recommendations: Array<{ priority: string }>;
    };

    expect(
      parsed.recommendations.every(
        (recommendation) => recommendation.priority === 'high',
      ),
    ).toBe(true);
    expect(parsed.summary.total).toBe(parsed.recommendations.length);
    expect(io.err).toBe('');
  });

  it('filters recommendations by medium priority', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-recommendations-medium-filter-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'recommendations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--priority',
          'medium',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const parsed = JSON.parse(io.out) as {
      summary: { total: number };
      recommendations: Array<{ priority: string }>;
    };

    expect(
      parsed.recommendations.every(
        (recommendation) => recommendation.priority === 'medium',
      ),
    ).toBe(true);
    expect(parsed.summary.total).toBe(parsed.recommendations.length);
    expect(io.err).toBe('');
  });

  it('filters recommendations by low priority and returns empty summary when unmatched', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-recommendations-low-filter-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'recommendations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--priority',
          'low',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const parsed = JSON.parse(io.out) as {
      summary: { total: number };
      recommendations: Array<{ priority: string }>;
    };

    expect(
      parsed.recommendations.every(
        (recommendation) => recommendation.priority === 'low',
      ),
    ).toBe(true);
    expect(parsed.summary.total).toBe(parsed.recommendations.length);
    expect(parsed.summary.total).toBe(0);
    expect(parsed.recommendations).toHaveLength(0);
    expect(io.err).toBe('');
  });

  it('rejects unsupported recommendations priority values', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot(
      'agov-recommendations-invalid-priority-',
    );

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'recommendations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--priority',
          'urgent',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.invalid_config',
      },
    });
  });

  it('supports signals with explicit workspace/profile mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-signals-workspace-mode-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'signals',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'signals',
      summary: {
        total: expect.any(Number),
        bySource: expect.any(Array),
        byType: expect.any(Array),
        bySeverity: expect.any(Array),
      },
      signals: expect.any(Array),
      signalBreakdown: {
        total: expect.any(Number),
      },
    });
    expect(io.err).toBe('');
  });

  it('supports signals with explicit adapter mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-signals-adapter-mode-');

    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'signals',
          '--profile',
          './profile.json',
          '--adapter',
          'test-adapter-package',
          '--root',
          '.',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async () =>
            createAdapterModule({ workspaceName: path.basename(cwd) }),
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'signals',
      workspace: {
        name: path.basename(cwd),
      },
      summary: {
        total: expect.any(Number),
      },
    });
    expect(io.err).toBe('');
  });

  it('filters signals output by source, type, and severity', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-signals-filters-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'signals',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--source',
          'policy',
          '--type',
          'policy_violation',
          '--severity',
          'error',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const parsed = JSON.parse(io.out) as {
      summary: { total: number };
      signals: Array<{
        source: string;
        type: string;
        severity: string;
      }>;
      signalBreakdown: { total: number };
    };

    expect(
      parsed.signals.every(
        (signal) =>
          signal.source === 'policy' &&
          signal.type === 'policy_violation' &&
          signal.severity === 'error',
      ),
    ).toBe(true);
    expect(parsed.summary.total).toBe(parsed.signals.length);
    expect(parsed.signalBreakdown.total).toBe(parsed.signals.length);
    expect(io.err).toBe('');
  });

  it('rejects unsupported signals severity values', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-signals-invalid-severity-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'signals',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--severity',
          'critical',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.invalid_config',
      },
    });
  });

  it('supports dependencies with explicit workspace mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-dependencies-workspace-mode-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));

    expect(
      await runAgovCli(
        ['dependencies', '--workspace', './workspace.json', '--format', 'json'],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'dependencies',
      workspace: {
        name: 'demo',
      },
      dependencies: expect.any(Array),
      projects: expect.any(Array),
      summary: {
        totalDependencies: expect.any(Number),
      },
    });
    expect(io.err).toBe('');
  });

  it('supports dependencies with explicit adapter mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-dependencies-adapter-mode-');

    expect(
      await runAgovCli(
        [
          'dependencies',
          '--adapter',
          'test-adapter-package',
          '--root',
          '.',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async () =>
            createAdapterModule({ workspaceName: path.basename(cwd) }),
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'dependencies',
      workspace: {
        name: path.basename(cwd),
      },
      dependencies: [],
      projects: [],
      summary: {
        totalDependencies: 0,
      },
    });
    expect(io.err).toBe('');
  });

  it('supports dependencies in adapter discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createAdapterDiscoveryFixture(
      'agov-dependencies-adapter-discovery-',
      ['adapter-one', 'adapter-two'],
    );

    expect(
      await runAgovCli(
        ['dependencies', '--format', 'json'],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async (specifier: string) => {
            if (specifier === 'adapter-one') {
              return createProbeableAdapterModule({
                workspaceName: 'unsupported-workspace',
                supported: false,
                confidence: 'low',
              });
            }

            return createProbeableAdapterModule({
              workspaceName: 'supported-workspace',
              supported: true,
              confidence: 'high',
            });
          },
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'dependencies',
      workspace: {
        name: 'supported-workspace',
      },
    });
    expect(io.err).toBe('');
  });

  it('renders dependencies summary in text and table output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-dependencies-text-table-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));

    expect(
      await runAgovCli(
        [
          'dependencies',
          '--workspace',
          './workspace.json',
          '--format',
          'table',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(io.out).toContain('agov dependencies');
    expect(io.out).toContain('Summary');
    expect(io.out).toContain('total dependencies');
    expect(io.err).toBe('');
  });

  it('includes only projects referenced by filtered dependencies in JSON output', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-dependencies-project-scope-');

    writeJson(path.join(cwd, 'workspace.json'), {
      schemaVersion: 1,
      workspace: {
        name: 'demo',
        root: '.',
      },
      projects: [
        {
          name: 'customer-domain',
          root: 'src/customer/domain',
          tags: [],
          type: 'library',
        },
        {
          name: 'order-domain',
          root: 'src/order/domain',
          tags: [],
          type: 'library',
        },
        {
          name: 'billing-domain',
          root: 'src/billing/domain',
          tags: [],
          type: 'library',
        },
      ],
      dependencies: [
        {
          source: 'customer-domain',
          target: 'order-domain',
          type: 'static',
        },
        {
          source: 'order-domain',
          target: 'billing-domain',
          type: 'dynamic',
        },
      ],
    });

    expect(
      await runAgovCli(
        [
          'dependencies',
          '--workspace',
          './workspace.json',
          '--target',
          'order-domain',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const parsed = JSON.parse(io.out) as {
      projects: Array<{ id: string }>;
      dependencies: Array<{ source: string; target: string; type: string }>;
    };

    expect(parsed.dependencies).toEqual([
      {
        source: 'customer-domain',
        target: 'order-domain',
        type: 'static',
      },
    ]);
    expect(parsed.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'customer-domain' }),
        expect.objectContaining({ id: 'order-domain' }),
      ]),
    );
    expect(io.err).toBe('');
  });

  it('filters dependencies by source, target, project, and type', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-dependencies-filters-');

    writeJson(path.join(cwd, 'workspace.json'), {
      schemaVersion: 1,
      workspace: {
        name: 'demo',
        root: '.',
      },
      projects: [
        {
          name: 'customer-domain',
          root: 'src/customer/domain',
          tags: [],
          type: 'library',
        },
        {
          name: 'order-domain',
          root: 'src/order/domain',
          tags: [],
          type: 'library',
        },
        {
          name: 'billing-domain',
          root: 'src/billing/domain',
          tags: [],
          type: 'library',
        },
      ],
      dependencies: [
        {
          source: 'customer-domain',
          target: 'order-domain',
          type: 'static',
        },
        {
          source: 'order-domain',
          target: 'billing-domain',
          type: 'dynamic',
        },
        {
          source: 'billing-domain',
          target: 'customer-domain',
          type: 'implicit',
        },
        {
          source: 'order-domain',
          target: 'customer-domain',
          type: 'unknown',
        },
      ],
    });

    expect(
      await runAgovCli(
        [
          'dependencies',
          '--workspace',
          './workspace.json',
          '--source',
          'customer-domain',
          '--target',
          'order-domain',
          '--project',
          'customer-domain',
          '--type',
          'static',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const parsed = JSON.parse(io.out) as {
      summary: { totalDependencies: number };
      dependencies: Array<{ source: string; target: string; type: string }>;
    };

    expect(parsed.dependencies).toEqual([
      {
        source: 'customer-domain',
        target: 'order-domain',
        type: 'static',
      },
    ]);
    expect(parsed.summary.totalDependencies).toBe(1);
    expect(io.err).toBe('');
  });

  it('filters dependencies by each supported type', async () => {
    const cwd = createTempWorkspaceRoot('agov-dependencies-type-filters-');

    for (const dependencyType of ['static', 'dynamic', 'implicit', 'unknown']) {
      const scopedIo = createMemoryIo();

      expect(
        await runAgovCli(
          [
            'dependencies',
            '--adapter',
            'test-adapter-package',
            '--root',
            '.',
            '--type',
            dependencyType,
            '--format',
            'json',
          ],
          scopedIo,
          undefined,
          createEnvironment({
            cwd,
            moduleLoader: async () => ({
              createGovernanceWorkspaceAdapter() {
                return {
                  id: 'governance-adapter:typed-deps',
                  loadWorkspace() {
                    return {
                      workspaceId: 'demo',
                      workspaceName: 'demo',
                      workspaceRoot: '.',
                      projects: [
                        {
                          name: 'a',
                          root: 'a',
                          type: 'library',
                          tags: [],
                        },
                        {
                          name: 'b',
                          root: 'b',
                          type: 'library',
                          tags: [],
                        },
                      ],
                      dependencies: [
                        { source: 'a', target: 'b', type: 'static' },
                        { source: 'b', target: 'a', type: 'dynamic' },
                        { source: 'a', target: 'a', type: 'implicit' },
                        { source: 'b', target: 'b', type: 'transitive' },
                      ],
                      diagnostics: [],
                    };
                  },
                };
              },
            }),
          }),
        ),
      ).toBe(AGOV_EXIT_SUCCESS);

      const parsed = JSON.parse(scopedIo.out) as {
        dependencies: Array<{ type: string }>;
      };
      expect(parsed.dependencies).toHaveLength(1);
      expect(parsed.dependencies[0]?.type).toBe(dependencyType);
      expect(scopedIo.err).toBe('');
    }
  });

  it('rejects unsupported dependency type values', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-dependencies-invalid-type-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));

    expect(
      await runAgovCli(
        [
          'dependencies',
          '--workspace',
          './workspace.json',
          '--type',
          'transitive',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.invalid_config',
      },
    });
  });

  it('returns empty dependencies and zero summary counts when filters do not match', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-dependencies-empty-filter-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));

    expect(
      await runAgovCli(
        [
          'dependencies',
          '--workspace',
          './workspace.json',
          '--source',
          'does-not-exist',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const parsed = JSON.parse(io.out) as {
      dependencies: Array<unknown>;
      projects: Array<unknown>;
      summary: {
        totalDependencies: number;
        projectCount: number;
        sourceProjectCount: number;
        targetProjectCount: number;
      };
    };

    expect(parsed.dependencies).toEqual([]);
    expect(parsed.projects).toEqual([]);
    expect(parsed.summary.totalDependencies).toBe(0);
    expect(parsed.summary.projectCount).toBe(0);
    expect(parsed.summary.sourceProjectCount).toBe(0);
    expect(parsed.summary.targetProjectCount).toBe(0);
    expect(io.err).toBe('');
  });

  it('supports violations with explicit workspace/profile mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-violations-workspace-mode-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'violations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'violations',
      summary: {
        total: expect.any(Number),
        bySeverity: expect.any(Array),
      },
      violations: expect.any(Array),
    });
    expect(io.err).toBe('');
  });

  it('supports violations with explicit adapter mode', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-violations-adapter-mode-');

    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'violations',
          '--profile',
          './profile.json',
          '--adapter',
          'test-adapter-package',
          '--root',
          '.',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async () =>
            createAdapterModule({ workspaceName: path.basename(cwd) }),
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'violations',
      workspace: {
        name: path.basename(cwd),
      },
      violations: expect.any(Array),
    });
    expect(io.err).toBe('');
  });

  it('supports violations in adapter discovery mode', async () => {
    const io = createMemoryIo();
    const cwd = createAdapterDiscoveryFixture(
      'agov-violations-adapter-discovery-',
      ['adapter-one', 'adapter-two'],
    );

    writeFailingFixtureProfile(path.join(cwd, 'governance.profile.json'));

    expect(
      await runAgovCli(
        [
          'violations',
          '--profile',
          './governance.profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({
          cwd,
          moduleLoader: async (specifier: string) => {
            if (specifier === 'adapter-one') {
              return createProbeableAdapterModule({
                workspaceName: 'unsupported-workspace',
                supported: false,
                confidence: 'low',
              });
            }

            return createProbeableAdapterModule({
              workspaceName: 'supported-workspace',
              supported: true,
              confidence: 'high',
            });
          },
        }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      command: 'violations',
      workspace: {
        name: 'supported-workspace',
      },
    });
    expect(io.err).toBe('');
  });

  it('filters violations output by severity', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-violations-severity-filter-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'violations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--severity',
          'error',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const parsed = JSON.parse(io.out) as {
      summary: { total: number };
      violations: Array<{ severity: string }>;
    };

    expect(
      parsed.violations.every((violation) => violation.severity === 'error'),
    ).toBe(true);
    expect(parsed.summary.total).toBe(parsed.violations.length);
    expect(io.err).toBe('');
  });

  it('combines violations filters with AND semantics', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-violations-and-filter-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'violations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const baseline = JSON.parse(io.out) as {
      violations: Array<{
        severity: string;
        ruleId: string;
        category: string;
        project: string;
      }>;
    };

    const selected = baseline.violations[0];
    expect(selected).toBeDefined();

    io.out = '';
    io.err = '';

    expect(
      await runAgovCli(
        [
          'violations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--severity',
          selected.severity,
          '--rule',
          selected.ruleId,
          '--category',
          selected.category,
          '--project',
          selected.project,
          '--format',
          'json',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    const filtered = JSON.parse(io.out) as {
      violations: Array<{
        severity: string;
        ruleId: string;
        category: string;
        project: string;
      }>;
    };

    expect(filtered.violations.length).toBeGreaterThan(0);
    expect(
      filtered.violations.every(
        (violation) =>
          violation.severity === selected.severity &&
          violation.ruleId === selected.ruleId &&
          violation.category === selected.category &&
          violation.project === selected.project,
      ),
    ).toBe(true);
    expect(io.err).toBe('');
  });

  it('rejects unsupported violations severity values', async () => {
    const io = createMemoryIo();
    const cwd = createTempWorkspaceRoot('agov-violations-invalid-severity-');

    writeFixtureWorkspace(path.join(cwd, 'workspace.json'));
    writeFailingFixtureProfile(path.join(cwd, 'profile.json'));

    expect(
      await runAgovCli(
        [
          'violations',
          '--workspace',
          './workspace.json',
          '--profile',
          './profile.json',
          '--severity',
          'fatal',
        ],
        io,
        undefined,
        createEnvironment({ cwd }),
      ),
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.invalid_config',
      },
    });
  });
});

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

function createEnvironment(
  input: {
    cwd?: string;
    moduleLoader?: AgovCliEnvironment['moduleLoader'];
    packageVersion?: AgovCliEnvironment['packageVersion'];
  } = {},
): AgovCliEnvironment {
  return {
    cwd() {
      return input.cwd ?? process.cwd();
    },
    moduleLoader:
      input.moduleLoader ??
      (async () => {
        throw new Error('Module loader was not configured for this test.');
      }),
    packageVersion: input.packageVersion ?? (() => '0.0.1-test'),
  };
}

function createTempWorkspaceRoot(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function createAdapterModule(input: { workspaceName: string }): unknown {
  return {
    createGovernanceWorkspaceAdapter() {
      return {
        id: 'governance-adapter:typescript',
        loadWorkspace() {
          return {
            workspaceId: input.workspaceName,
            workspaceName: input.workspaceName,
            workspaceRoot: '.',
            projects: [],
            dependencies: [],
            diagnostics: [],
          };
        },
      };
    },
  };
}

function createProbeableAdapterModule(input: {
  workspaceName: string;
  supported: boolean;
  confidence?: 'none' | 'low' | 'medium' | 'high';
}): unknown {
  return {
    createGovernanceWorkspaceAdapter() {
      return {
        id: `adapter:${input.workspaceName}`,
        probe() {
          return {
            supported: input.supported,
            confidence: input.confidence ?? 'none',
            reasons: input.supported
              ? ['supported by probe']
              : ['unsupported by probe'],
          };
        },
        loadWorkspace() {
          return {
            workspaceId: input.workspaceName,
            workspaceName: input.workspaceName,
            workspaceRoot: '.',
            projects: [],
            dependencies: [],
            diagnostics: [],
          };
        },
      };
    },
  };
}

function createAdapterDiscoveryFixture(
  prefix: string,
  adapters: string[],
): string {
  const root = createTempWorkspaceRoot(prefix);

  writeJson(path.join(root, 'package.json'), {
    name: '@fixture/root',
    private: true,
    agov: {
      adapters,
    },
  });

  return root;
}

function writeFixtureWorkspace(filePath: string): void {
  copyFixture(
    filePath,
    '../tests/fixtures/manual-workspace/demo-workspace.json',
  );
}

function writeFixtureProfile(filePath: string): void {
  copyFixture(
    filePath,
    '../tests/fixtures/standalone-cli/passing-profile.json',
  );
}

function writeFailingFixtureProfile(filePath: string): void {
  copyFixture(filePath, '../tests/fixtures/standalone-cli/error-profile.json');
}

function writeInvalidFixtureProfile(filePath: string): void {
  writeJson(filePath, {
    boundaryPolicySource: 'profile',
    layers: [],
  });
}

function writeInvalidFixtureWorkspace(filePath: string): void {
  writeJson(filePath, {
    schemaVersion: 1,
    workspace: {
      name: 'demo',
      root: '.',
    },
    projects: [],
    dependencies: [],
  });
}

function copyFixture(targetPath: string, relativeFixturePath: string): void {
  const sourcePath = fileURLToPath(
    new URL(relativeFixturePath, import.meta.url),
  );
  writeText(targetPath, readFileSync(sourcePath, 'utf8'));
}

function writeJson(filePath: string, value: unknown): void {
  writeText(filePath, JSON.stringify(value, null, 2));
}

function writeText(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}
