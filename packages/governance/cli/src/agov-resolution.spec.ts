import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  resolveAgovAssessCommand,
  resolveAgovAssessmentCommand,
  resolveAgovCheckCommand,
  resolveAgovMetricsCommand,
  type AgovCliEnvironment,
  type ParsedAgovAssessOptions,
  type ParsedAgovCheckOptions,
  type ParsedAgovMetricsOptions,
} from './agov.js';

describe('agov shared command resolution', () => {
  it('resolves check, assess, and metrics with identical option behavior', () => {
    const cwd = createTempWorkspaceRoot('agov-shared-resolution-');

    writeJson(path.join(cwd, 'workspace.json'), {
      schemaVersion: 1,
      workspace: { name: 'demo', root: '.' },
      projects: [],
      dependencies: [],
    });
    writeJson(path.join(cwd, 'profile.json'), {
      name: 'demo-profile',
      boundaryPolicySource: 'profile',
      layers: ['domain'],
      allowedDomainDependencies: { '*': [] },
      ownership: { required: false, metadataField: 'ownership' },
      health: { statusThresholds: { goodMinScore: 85, warningMinScore: 70 } },
      metrics: {
        'architectural-entropy': 1,
        'dependency-complexity': 1,
        'domain-integrity': 1,
        'ownership-coverage': 1,
        'documentation-completeness': 1,
        'layer-integrity': 1,
      },
    });

    const checkResolved = resolveAgovAssessmentCommand(
      {
        command: 'check',
        profilePath: './profile.json',
        workspacePath: './workspace.json',
        showHelp: false,
      },
      createEnvironment({ cwd }),
    );
    const assessResolved = resolveAgovAssessmentCommand(
      {
        command: 'assess',
        profilePath: './profile.json',
        workspacePath: './workspace.json',
        showHelp: false,
      },
      createEnvironment({ cwd }),
    );
    const metricsResolved = resolveAgovAssessmentCommand(
      {
        command: 'metrics',
        profilePath: './profile.json',
        workspacePath: './workspace.json',
        showHelp: false,
      },
      createEnvironment({ cwd }),
    );

    expect(withoutCommand(assessResolved)).toEqual(
      withoutCommand(checkResolved),
    );
    expect(withoutCommand(metricsResolved)).toEqual(
      withoutCommand(checkResolved),
    );
  });

  it('keeps config discovery behavior for both commands', () => {
    const cwd = createTempWorkspaceRoot('agov-shared-config-discovery-');

    writeJson(path.join(cwd, 'workspace.json'), {
      schemaVersion: 1,
      workspace: { name: 'demo', root: '.' },
      projects: [],
      dependencies: [],
    });
    writeJson(path.join(cwd, 'profile.json'), {
      name: 'demo-profile',
      boundaryPolicySource: 'profile',
      layers: ['domain'],
      allowedDomainDependencies: { '*': [] },
      ownership: { required: false, metadataField: 'ownership' },
      health: { statusThresholds: { goodMinScore: 85, warningMinScore: 70 } },
      metrics: {
        'architectural-entropy': 1,
        'dependency-complexity': 1,
        'domain-integrity': 1,
        'ownership-coverage': 1,
        'documentation-completeness': 1,
        'layer-integrity': 1,
      },
    });
    writeJson(path.join(cwd, 'agov.config.json'), {
      workspace: './workspace.json',
      profile: './profile.json',
      format: 'json',
    });

    const checkResolved = resolveAgovAssessmentCommand(
      { command: 'check', showHelp: false },
      createEnvironment({ cwd }),
    );
    const assessResolved = resolveAgovAssessmentCommand(
      { command: 'assess', showHelp: false },
      createEnvironment({ cwd }),
    );

    expect(checkResolved.mode).toBe('workspace');
    expect(assessResolved.mode).toBe('workspace');
    expect(checkResolved.profilePath).toBe(path.join(cwd, 'profile.json'));
    expect(assessResolved.profilePath).toBe(path.join(cwd, 'profile.json'));
    expect(checkResolved.workspacePath).toBe(path.join(cwd, 'workspace.json'));
    expect(assessResolved.workspacePath).toBe(path.join(cwd, 'workspace.json'));
  });

  it('keeps explicit flag override behavior for both commands', () => {
    const cwd = createTempWorkspaceRoot('agov-shared-config-override-');

    writeJson(path.join(cwd, 'workspace.json'), {
      schemaVersion: 1,
      workspace: { name: 'demo', root: '.' },
      projects: [],
      dependencies: [],
    });
    writeJson(path.join(cwd, 'profile.json'), {
      name: 'demo-profile',
      boundaryPolicySource: 'profile',
      layers: ['domain'],
      allowedDomainDependencies: { '*': [] },
      ownership: { required: false, metadataField: 'ownership' },
      health: { statusThresholds: { goodMinScore: 85, warningMinScore: 70 } },
      metrics: {
        'architectural-entropy': 1,
        'dependency-complexity': 1,
        'domain-integrity': 1,
        'ownership-coverage': 1,
        'documentation-completeness': 1,
        'layer-integrity': 1,
      },
    });
    writeJson(path.join(cwd, 'agov.config.json'), {
      workspace: './missing-workspace.json',
      profile: './profile.json',
      format: 'json',
    });

    const checkResolved = resolveAgovAssessmentCommand(
      {
        command: 'check',
        workspacePath: './workspace.json',
        format: 'text',
        showHelp: false,
      },
      createEnvironment({ cwd }),
    );
    const assessResolved = resolveAgovAssessmentCommand(
      {
        command: 'assess',
        workspacePath: './workspace.json',
        format: 'text',
        showHelp: false,
      },
      createEnvironment({ cwd }),
    );

    expect(checkResolved.workspacePath).toBe(path.join(cwd, 'workspace.json'));
    expect(assessResolved.workspacePath).toBe(path.join(cwd, 'workspace.json'));
    expect(checkResolved.format).toBe('text');
    expect(assessResolved.format).toBe('text');
  });

  it('keeps explicit adapter mode behavior for both commands', () => {
    const cwd = createTempWorkspaceRoot('agov-shared-adapter-mode-');

    writeJson(path.join(cwd, 'profile.json'), {
      name: 'demo-profile',
      boundaryPolicySource: 'profile',
      layers: ['domain'],
      allowedDomainDependencies: { '*': [] },
      ownership: { required: false, metadataField: 'ownership' },
      health: { statusThresholds: { goodMinScore: 85, warningMinScore: 70 } },
      metrics: {
        'architectural-entropy': 1,
        'dependency-complexity': 1,
        'domain-integrity': 1,
        'ownership-coverage': 1,
        'documentation-completeness': 1,
        'layer-integrity': 1,
      },
    });

    const checkResolved = resolveAgovAssessmentCommand(
      {
        command: 'check',
        profilePath: './profile.json',
        adapterPackage: 'demo-adapter',
        showHelp: false,
      },
      createEnvironment({ cwd }),
    );
    const assessResolved = resolveAgovAssessmentCommand(
      {
        command: 'assess',
        profilePath: './profile.json',
        adapterPackage: 'demo-adapter',
        showHelp: false,
      },
      createEnvironment({ cwd }),
    );

    expect(checkResolved.mode).toBe('adapter');
    expect(assessResolved.mode).toBe('adapter');
    expect(checkResolved.rootPath).toBe(cwd);
    expect(assessResolved.rootPath).toBe(cwd);
  });

  it('keeps adapter discovery behavior for both commands', () => {
    const cwd = createTempWorkspaceRoot('agov-shared-adapter-discovery-');

    writeJson(path.join(cwd, 'governance.profile.json'), {
      name: 'demo-profile',
      boundaryPolicySource: 'profile',
      layers: ['domain'],
      allowedDomainDependencies: { '*': [] },
      ownership: { required: false, metadataField: 'ownership' },
      health: { statusThresholds: { goodMinScore: 85, warningMinScore: 70 } },
      metrics: {
        'architectural-entropy': 1,
        'dependency-complexity': 1,
        'domain-integrity': 1,
        'ownership-coverage': 1,
        'documentation-completeness': 1,
        'layer-integrity': 1,
      },
    });
    writeJson(path.join(cwd, 'package.json'), {
      name: '@fixture/root',
      private: true,
      agov: {
        adapters: ['adapter-one', 'adapter-two'],
      },
    });

    const checkResolved = resolveAgovAssessmentCommand(
      { command: 'check', showHelp: false },
      createEnvironment({ cwd }),
    );
    const assessResolved = resolveAgovAssessmentCommand(
      { command: 'assess', showHelp: false },
      createEnvironment({ cwd }),
    );

    expect(checkResolved.mode).toBe('adapter-discovery');
    expect(assessResolved.mode).toBe('adapter-discovery');
    expect(checkResolved.adapterCandidates).toEqual([
      'adapter-one',
      'adapter-two',
    ]);
    expect(assessResolved.adapterCandidates).toEqual([
      'adapter-one',
      'adapter-two',
    ]);
  });

  it('keeps ambiguity and missing profile errors stable', () => {
    const cwd = createTempWorkspaceRoot('agov-shared-error-codes-');

    writeJson(path.join(cwd, 'workspace.json'), {
      schemaVersion: 1,
      workspace: { name: 'demo', root: '.' },
      projects: [],
      dependencies: [],
    });
    writeJson(path.join(cwd, 'profile.json'), {
      name: 'demo-profile',
      boundaryPolicySource: 'profile',
      layers: ['domain'],
      allowedDomainDependencies: { '*': [] },
      ownership: { required: false, metadataField: 'ownership' },
      health: { statusThresholds: { goodMinScore: 85, warningMinScore: 70 } },
      metrics: {
        'architectural-entropy': 1,
        'dependency-complexity': 1,
        'domain-integrity': 1,
        'ownership-coverage': 1,
        'documentation-completeness': 1,
        'layer-integrity': 1,
      },
    });

    expect(() =>
      resolveAgovAssessmentCommand(
        {
          command: 'check',
          workspacePath: './workspace.json',
          adapterPackage: 'demo-adapter',
          profilePath: './profile.json',
          showHelp: false,
        },
        createEnvironment({ cwd }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'agov.cli.ambiguous_workspace_and_adapter',
      }),
    );

    expect(() =>
      resolveAgovAssessmentCommand(
        {
          command: 'assess',
          workspacePath: './workspace.json',
          adapterPackage: 'demo-adapter',
          profilePath: './profile.json',
          showHelp: false,
        },
        createEnvironment({ cwd }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'agov.cli.ambiguous_workspace_and_adapter',
      }),
    );

    const emptyCwd = createTempWorkspaceRoot('agov-shared-missing-profile-');

    expect(() =>
      resolveAgovAssessmentCommand(
        { command: 'check', showHelp: false },
        createEnvironment({ cwd: emptyCwd }),
      ),
    ).toThrow(expect.objectContaining({ code: 'agov.cli.missing_profile' }));

    expect(() =>
      resolveAgovAssessmentCommand(
        { command: 'assess', showHelp: false },
        createEnvironment({ cwd: emptyCwd }),
      ),
    ).toThrow(expect.objectContaining({ code: 'agov.cli.missing_profile' }));
  });

  it('keeps compatibility aliases equivalent to the generalized resolver', () => {
    const cwd = createTempWorkspaceRoot('agov-shared-aliases-');

    writeJson(path.join(cwd, 'workspace.json'), {
      schemaVersion: 1,
      workspace: { name: 'demo', root: '.' },
      projects: [],
      dependencies: [],
    });
    writeJson(path.join(cwd, 'profile.json'), {
      name: 'demo-profile',
      boundaryPolicySource: 'profile',
      layers: ['domain'],
      allowedDomainDependencies: { '*': [] },
      ownership: { required: false, metadataField: 'ownership' },
      health: { statusThresholds: { goodMinScore: 85, warningMinScore: 70 } },
      metrics: {
        'architectural-entropy': 1,
        'dependency-complexity': 1,
        'domain-integrity': 1,
        'ownership-coverage': 1,
        'documentation-completeness': 1,
        'layer-integrity': 1,
      },
    });

    const checkOptions: ParsedAgovCheckOptions = {
      command: 'check',
      workspacePath: './workspace.json',
      profilePath: './profile.json',
      showHelp: false,
    };
    const assessOptions: ParsedAgovAssessOptions = {
      command: 'assess',
      workspacePath: './workspace.json',
      profilePath: './profile.json',
      showHelp: false,
    };
    const metricsOptions: ParsedAgovMetricsOptions = {
      command: 'metrics',
      workspacePath: './workspace.json',
      profilePath: './profile.json',
      showHelp: false,
    };

    const generalizedCheck = resolveAgovAssessmentCommand(
      checkOptions,
      createEnvironment({ cwd }),
    );
    const aliasCheck = resolveAgovCheckCommand(
      checkOptions,
      createEnvironment({ cwd }),
    );
    const generalizedAssess = resolveAgovAssessmentCommand(
      assessOptions,
      createEnvironment({ cwd }),
    );
    const aliasAssess = resolveAgovAssessCommand(
      assessOptions,
      createEnvironment({ cwd }),
    );
    const generalizedMetrics = resolveAgovAssessmentCommand(
      metricsOptions,
      createEnvironment({ cwd }),
    );
    const aliasMetrics = resolveAgovMetricsCommand(
      metricsOptions,
      createEnvironment({ cwd }),
    );

    expect(aliasCheck).toEqual(generalizedCheck);
    expect(aliasAssess).toEqual(generalizedAssess);
    expect(aliasMetrics).toEqual(generalizedMetrics);
  });
});

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

function writeJson(filePath: string, value: unknown): void {
  writeText(filePath, JSON.stringify(value, null, 2));
}

function writeText(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

function withoutCommand<T extends { command: string }>(
  value: T,
): Omit<T, 'command'> {
  const { command: _command, ...rest } = value;
  return rest;
}
