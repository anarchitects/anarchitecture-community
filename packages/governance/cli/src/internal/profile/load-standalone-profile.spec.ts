import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  StandaloneGovernanceProfileLoadError,
  StandaloneGovernanceProfileValidationError,
  loadStandaloneGovernanceProfile,
  loadStandaloneGovernanceProfileConfig,
  validateStandaloneGovernanceProfile,
} from './load-standalone-profile.js';

describe('loadStandaloneGovernanceProfile', () => {
  it('loads a valid standalone governance profile fixture', () => {
    const fixturePath = standaloneProfileFixturePath('standalone-profile.json');

    const loaded = loadStandaloneGovernanceProfile(fixturePath);

    expect(loaded.profile).toEqual({
      name: 'standalone-demo',
      description: 'Standalone Governance CLI profile fixture',
      boundaryPolicySource: 'profile',
      layers: ['app', 'domain', 'infra'],
      rules: {
        'missing-domain': {
          enabled: true,
          options: {
            required: true,
          },
        },
        'project-name-convention': {
          enabled: true,
          severity: 'info',
          options: {
            pattern: '^[a-z-]+$',
          },
        },
      },
      allowedLayerDependencies: {
        app: ['domain', 'infra'],
        domain: ['infra'],
      },
      allowedDomainDependencies: {
        '*': ['shared'],
        billing: ['billing', 'shared'],
      },
      ownership: {
        required: true,
        metadataField: 'ownership',
      },
      health: {
        statusThresholds: {
          goodMinScore: 90,
          warningMinScore: 75,
        },
      },
      metrics: {
        'architectural-entropy': 0.5,
        'dependency-complexity': 0.4,
        'documentation-completeness': 0.1,
        'domain-integrity': 0.6,
        'layer-integrity': 0.8,
        'ownership-coverage': 0.3,
      },
    });
    expect(loaded.normalizedProfile).toEqual({
      name: 'standalone-demo',
      description: 'Standalone Governance CLI profile fixture',
      rules: {
        'domain-boundary': {
          enabled: true,
          severity: 'error',
          options: {
            allowedDependencies: {
              '*': ['shared'],
              billing: ['billing', 'shared'],
            },
          },
        },
        'layer-boundary': {
          enabled: true,
          severity: 'warning',
          options: {
            allowedDependencies: {
              app: ['domain', 'infra'],
              domain: ['infra'],
            },
            layers: ['app', 'domain', 'infra'],
            usesExplicitDependencies: true,
          },
        },
        'missing-domain': {
          enabled: true,
          options: {
            required: true,
          },
        },
        'ownership-presence': {
          enabled: true,
          severity: 'warning',
          options: {
            required: true,
            metadataField: 'ownership',
          },
        },
        'project-name-convention': {
          enabled: true,
          severity: 'info',
          options: {
            pattern: '^[a-z-]+$',
          },
        },
      },
      scoring: {
        statusThresholds: {
          goodMinScore: 90,
          warningMinScore: 75,
        },
        metricWeights: {
          'architectural-entropy': 0.5,
          'dependency-complexity': 0.4,
          'documentation-completeness': 0.1,
          'domain-integrity': 0.6,
          'layer-integrity': 0.8,
          'ownership-coverage': 0.3,
        },
      },
      exceptions: [],
      projectOverrides: {},
      compatibility: {
        boundaryPolicySource: 'profile',
      },
    });
  });

  it('loads the standalone profile through the profile-only API', () => {
    const fixturePath = standaloneProfileFixturePath('standalone-profile.json');

    expect(loadStandaloneGovernanceProfileConfig(fixturePath)).toMatchObject({
      name: 'standalone-demo',
      boundaryPolicySource: 'profile',
      layers: ['app', 'domain', 'infra'],
    });
  });

  it('rejects an Nx Governance runtime profile file intentionally', () => {
    const fixturePath = nxRuntimeProfileFixturePath('frontend-layered.json');

    expect(() => loadStandaloneGovernanceProfile(fixturePath)).toThrow(
      StandaloneGovernanceProfileValidationError,
    );

    try {
      loadStandaloneGovernanceProfile(fixturePath);
    } catch (error) {
      expect(error).toBeInstanceOf(StandaloneGovernanceProfileValidationError);
      expect(
        (error as StandaloneGovernanceProfileValidationError).issues,
      ).toEqual([
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
      ]);
    }
  });

  it('throws a deterministic error for invalid JSON', () => {
    const dirPath = mkdtempSync(path.join(tmpdir(), 'standalone-profile-'));
    const filePath = path.join(dirPath, 'broken-profile.json');
    writeFileSync(filePath, '{"name": "broken"', 'utf8');

    expect(() => loadStandaloneGovernanceProfile(filePath)).toThrow(
      StandaloneGovernanceProfileLoadError,
    );

    try {
      loadStandaloneGovernanceProfile(filePath);
    } catch (error) {
      expect(error).toEqual(
        expect.objectContaining({
          code: 'governance.profile_loader.parse_error',
          filePath,
        }),
      );
    }
  });

  it('throws a deterministic error for a missing file', () => {
    const filePath = path.join(
      mkdtempSync(path.join(tmpdir(), 'standalone-profile-')),
      'missing-profile.json',
    );

    expect(() => loadStandaloneGovernanceProfile(filePath)).toThrow(
      StandaloneGovernanceProfileLoadError,
    );

    try {
      loadStandaloneGovernanceProfile(filePath);
    } catch (error) {
      expect(error).toEqual(
        expect.objectContaining({
          code: 'governance.profile_loader.read_failed',
          filePath,
        }),
      );
    }
  });

  it('reports deterministic validation errors for invalid profile shape', () => {
    expect(() =>
      validateStandaloneGovernanceProfile({
        name: '  ',
        boundaryPolicySource: 'custom',
        layers: ['app', 'app'],
        rules: {
          'project-name-convention': {
            severity: 'fatal',
          },
        },
        allowedLayerDependencies: {
          app: ['missing'],
          unknown: ['app'],
        },
        allowedDomainDependencies: {
          billing: ['shared', 'shared', '  '],
        },
        ownership: {
          required: 'yes',
        },
        health: {
          statusThresholds: {
            goodMinScore: 70,
            warningMinScore: 80,
          },
        },
        metrics: {
          'architectural-entropy': 'high',
        },
        extra: true,
      }),
    ).toThrow(StandaloneGovernanceProfileValidationError);

    try {
      validateStandaloneGovernanceProfile({
        name: '  ',
        boundaryPolicySource: 'custom',
        layers: ['app', 'app'],
        rules: {
          'project-name-convention': {
            severity: 'fatal',
          },
        },
        allowedLayerDependencies: {
          app: ['missing'],
          unknown: ['app'],
        },
        allowedDomainDependencies: {
          billing: ['shared', 'shared', '  '],
        },
        ownership: {
          required: 'yes',
        },
        health: {
          statusThresholds: {
            goodMinScore: 70,
            warningMinScore: 80,
          },
        },
        metrics: {
          'architectural-entropy': 'high',
        },
        extra: true,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(StandaloneGovernanceProfileValidationError);
      expect(
        (error as StandaloneGovernanceProfileValidationError).issues,
      ).toEqual([
        {
          code: 'governance.profile.unknown_field',
          message: 'Unknown field "extra" is not allowed.',
          path: '/extra',
        },
        {
          code: 'governance.profile.invalid_value',
          message: 'Profile name must be non-empty.',
          path: '/name',
        },
        {
          code: 'governance.profile.invalid_enum_value',
          message: 'boundaryPolicySource must be "profile" or "eslint".',
          path: '/boundaryPolicySource',
        },
        {
          code: 'governance.profile.invalid_value',
          message: 'Duplicate layer "app" is not allowed.',
          path: '/layers/1',
        },
        {
          code: 'governance.profile.invalid_enum_value',
          message: 'Rule severity must be "error", "warning", or "info".',
          path: '/rules/project-name-convention/severity',
        },
        {
          code: 'governance.profile.invalid_value',
          message:
            'allowedLayerDependencies source layer "unknown" is not declared in layers.',
          path: '/allowedLayerDependencies/unknown',
        },
        {
          code: 'governance.profile.invalid_value',
          message:
            'allowedLayerDependencies target layer "missing" for source layer "app" is not declared in layers.',
          path: '/allowedLayerDependencies/app/0',
        },
        {
          code: 'governance.profile.invalid_value',
          message: 'Allowed domain dependency must be non-empty.',
          path: '/allowedDomainDependencies/billing/2',
        },
        {
          code: 'governance.profile.invalid_field_type',
          message: 'ownership.required must be a boolean.',
          path: '/ownership/required',
        },
        {
          code: 'governance.profile.missing_required_field',
          message: 'ownership.metadataField is required.',
          path: '/ownership/metadataField',
        },
        {
          code: 'governance.profile.invalid_value',
          message:
            'health.statusThresholds.warningMinScore must be less than or equal to goodMinScore.',
          path: '/health/statusThresholds',
        },
        {
          code: 'governance.profile.invalid_field_type',
          message: 'Metric "architectural-entropy" must be a finite number.',
          path: '/metrics/architectural-entropy',
        },
      ]);
    }
  });

  it('normalizes valid profile data deterministically', () => {
    const profile = validateStandaloneGovernanceProfile({
      name: '  deterministic-profile  ',
      description: '  deterministic output fixture  ',
      boundaryPolicySource: 'profile',
      layers: ['app', 'domain', 'infra'],
      allowedLayerDependencies: {
        domain: ['infra', 'infra'],
        app: ['infra', 'domain', 'infra'],
      },
      allowedDomainDependencies: {
        billing: ['shared', 'billing', 'shared'],
        '*': ['shared'],
      },
      ownership: {
        required: true,
        metadataField: ' ownership ',
      },
      health: {
        statusThresholds: {
          goodMinScore: 85,
          warningMinScore: 70,
        },
      },
      metrics: {
        'ownership-coverage': 0.3,
        'architectural-entropy': 0.5,
      },
      rules: {
        'project-name-convention': {
          options: {
            pattern: '^[a-z-]+$',
          },
          severity: 'info',
          enabled: true,
        },
      },
    });

    expect(profile).toEqual({
      name: 'deterministic-profile',
      description: 'deterministic output fixture',
      boundaryPolicySource: 'profile',
      layers: ['app', 'domain', 'infra'],
      rules: {
        'project-name-convention': {
          enabled: true,
          severity: 'info',
          options: {
            pattern: '^[a-z-]+$',
          },
        },
      },
      allowedLayerDependencies: {
        app: ['domain', 'infra'],
        domain: ['infra'],
      },
      allowedDomainDependencies: {
        '*': ['shared'],
        billing: ['billing', 'shared'],
      },
      ownership: {
        required: true,
        metadataField: 'ownership',
      },
      health: {
        statusThresholds: {
          goodMinScore: 85,
          warningMinScore: 70,
        },
      },
      metrics: {
        'architectural-entropy': 0.5,
        'ownership-coverage': 0.3,
      },
    });
  });
});

function standaloneProfileFixturePath(fileName: string): string {
  return path.join(
    fileURLToPath(new URL('../../../tests/fixtures/profile', import.meta.url)),
    fileName,
  );
}

function nxRuntimeProfileFixturePath(fileName: string): string {
  return path.join(
    fileURLToPath(
      new URL('../../../tests/fixtures/nx-runtime-profile', import.meta.url),
    ),
    fileName,
  );
}
