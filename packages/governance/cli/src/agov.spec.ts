import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type AgovCliEnvironment,
  AGOV_EXIT_CONFIGURATION_FAILURE,
  AGOV_EXIT_RUNTIME_FAILURE,
  AGOV_EXIT_SUCCESS,
  runAgovCli,
} from './agov.js';

describe('agov executable command surface', () => {
  it('renders root help', async () => {
    const io = createMemoryIo();

    expect(await runAgovCli(['--help'], io)).toBe(AGOV_EXIT_SUCCESS);
    expect(io.out).toContain('agov');
    expect(io.out).toContain('agov check [options]');
    expect(io.out).toContain('agov assess [options]');
    expect(io.out).toContain('agov metrics [options]');
    expect(io.out).toContain('agov recommendations [options]');
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
