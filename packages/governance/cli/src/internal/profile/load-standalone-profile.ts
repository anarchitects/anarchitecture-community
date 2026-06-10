import { readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  GovernanceDiagnostic,
  GovernanceProfile,
  GovernanceRuleConfig,
  NormalizedGovernanceProfile,
} from '@anarchitects/governance-core';
import { normalizeGovernanceProfile } from '@anarchitects/governance-core';

const PROFILE_TOP_LEVEL_FIELDS = new Set([
  'name',
  'description',
  'boundaryPolicySource',
  'layers',
  'rules',
  'allowedLayerDependencies',
  'allowedDomainDependencies',
  'ownership',
  'health',
  'metrics',
]);
const NX_RUNTIME_PROFILE_ONLY_FIELDS = new Set([
  'nodeOverrides',
  'exceptions',
  'eslint',
]);
const NX_RUNTIME_PROFILE_LEGACY_METRIC_FIELDS = new Set([
  'architecturalEntropyWeight',
  'dependencyComplexityWeight',
  'domainIntegrityWeight',
  'ownershipCoverageWeight',
  'documentationCompletenessWeight',
  'layerIntegrityWeight',
]);
const OWNERSHIP_FIELDS = new Set(['required', 'metadataField']);
const HEALTH_FIELDS = new Set(['statusThresholds']);
const HEALTH_STATUS_THRESHOLD_FIELDS = new Set([
  'goodMinScore',
  'warningMinScore',
]);
const RULE_CONFIG_FIELDS = new Set(['enabled', 'severity', 'options']);
const PROFILE_SEVERITIES = new Set(['error', 'warning', 'info']);

export interface StandaloneGovernanceProfileValidationIssue
  extends GovernanceDiagnostic {
  path: string;
}

export type StandaloneGovernanceProfileLoadErrorCode =
  | 'governance.profile_loader.read_failed'
  | 'governance.profile_loader.parse_error';

export class StandaloneGovernanceProfileLoadError extends Error {
  constructor(
    message: string,
    public readonly code: StandaloneGovernanceProfileLoadErrorCode,
    public readonly filePath: string,
  ) {
    super(message);
    this.name = 'StandaloneGovernanceProfileLoadError';
  }
}

export class StandaloneGovernanceProfileValidationError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly issues: StandaloneGovernanceProfileValidationIssue[],
  ) {
    super(
      `Standalone governance profile validation failed for "${filePath}" with ${
        issues.length
      } issue${issues.length === 1 ? '' : 's'}.`,
    );
    this.name = 'StandaloneGovernanceProfileValidationError';
  }
}

export interface LoadedStandaloneGovernanceProfile {
  filePath: string;
  profile: GovernanceProfile;
  normalizedProfile: NormalizedGovernanceProfile;
}

export function loadStandaloneGovernanceProfile(
  profileFilePath: string,
): LoadedStandaloneGovernanceProfile {
  const filePath = path.resolve(profileFilePath);
  const source = readStandaloneProfileFile(filePath);
  const parsed = parseStandaloneProfileJson(source, filePath);

  try {
    const profile = validateStandaloneGovernanceProfile(parsed);

    return {
      filePath,
      profile,
      normalizedProfile: normalizeGovernanceProfile(profile),
    };
  } catch (error) {
    if (error instanceof StandaloneGovernanceProfileValidationError) {
      throw new StandaloneGovernanceProfileValidationError(
        filePath,
        error.issues,
      );
    }

    throw error;
  }
}

export function loadStandaloneGovernanceProfileConfig(
  profileFilePath: string,
): GovernanceProfile {
  return loadStandaloneGovernanceProfile(profileFilePath).profile;
}

export function validateStandaloneGovernanceProfile(
  value: unknown,
): GovernanceProfile {
  const issues: StandaloneGovernanceProfileValidationIssue[] = [];
  const root = asRecord(value);

  if (!root) {
    throwValidationIssues('<memory>', [
      {
        code: 'governance.profile.invalid_root',
        message: 'Governance profile document root must be an object.',
        path: '/',
      },
    ]);
  }

  const nxCompatibilityIssue = detectUnsupportedNxRuntimeProfile(root);
  if (nxCompatibilityIssue) {
    issues.push(nxCompatibilityIssue);
  }

  validateUnknownFields(root, PROFILE_TOP_LEVEL_FIELDS, '/', issues);

  const name = validateRequiredTrimmedString(
    root.name,
    '/name',
    issues,
    'Profile name',
  );
  const description = validateOptionalTrimmedString(
    root.description,
    '/description',
    issues,
    'Profile description',
  );
  const boundaryPolicySource = validateBoundaryPolicySource(
    root.boundaryPolicySource,
    '/boundaryPolicySource',
    issues,
  );
  const layers = validateLayers(root.layers, '/layers', issues);
  const rules = validateRules(root.rules, '/rules', issues);
  const allowedLayerDependencies = validateAllowedLayerDependencies(
    root.allowedLayerDependencies,
    '/allowedLayerDependencies',
    layers,
    issues,
  );
  const allowedDomainDependencies = validateAllowedDomainDependencies(
    root.allowedDomainDependencies,
    '/allowedDomainDependencies',
    issues,
  );
  const ownership = validateOwnership(root.ownership, '/ownership', issues);
  const health = validateHealth(root.health, '/health', issues);
  const metrics = validateMetrics(root.metrics, '/metrics', issues);

  if (
    issues.length > 0 ||
    !name ||
    !boundaryPolicySource ||
    !layers ||
    !allowedDomainDependencies ||
    !ownership ||
    !health ||
    !metrics
  ) {
    throwValidationIssues('<memory>', issues);
  }

  return {
    name,
    ...(description ? { description } : {}),
    boundaryPolicySource,
    layers,
    ...(rules ? { rules } : {}),
    ...(allowedLayerDependencies ? { allowedLayerDependencies } : {}),
    allowedDomainDependencies,
    ownership,
    health,
    metrics,
  };
}

function detectUnsupportedNxRuntimeProfile(
  root: Record<string, unknown>,
): StandaloneGovernanceProfileValidationIssue | undefined {
  const hasNxRuntimeOnlyField = Object.keys(root).some((key) =>
    NX_RUNTIME_PROFILE_ONLY_FIELDS.has(key),
  );
  const metrics = asRecord(root.metrics);
  const hasLegacyMetricField = Object.keys(metrics ?? {}).some((key) =>
    NX_RUNTIME_PROFILE_LEGACY_METRIC_FIELDS.has(key),
  );

  if (!hasNxRuntimeOnlyField && !hasLegacyMetricField) {
    return undefined;
  }

  return {
    code: 'governance.profile.unsupported_nx_runtime_profile',
    message:
      'Nx Governance runtime profile files are not supported by the standalone CLI. Use a standalone profile with an explicit "name" field and without Nx-only override fields such as "nodeOverrides", "exceptions", or legacy metric weight keys.',
    path: '/',
  };
}

function readStandaloneProfileFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    throw new StandaloneGovernanceProfileLoadError(
      `Failed to read governance profile file "${filePath}".`,
      'governance.profile_loader.read_failed',
      filePath,
    );
  }
}

function parseStandaloneProfileJson(source: string, filePath: string): unknown {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new StandaloneGovernanceProfileLoadError(
      `Failed to parse JSON governance profile file "${filePath}".`,
      'governance.profile_loader.parse_error',
      filePath,
    );
  }
}

function validateBoundaryPolicySource(
  value: unknown,
  pointer: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
): GovernanceProfile['boundaryPolicySource'] | undefined {
  if (value === undefined) {
    issues.push(
      missingRequiredField(pointer, 'boundaryPolicySource is required.'),
    );
    return undefined;
  }

  if (value !== 'profile' && value !== 'eslint') {
    issues.push(
      invalidEnumValue(
        pointer,
        'boundaryPolicySource must be "profile" or "eslint".',
      ),
    );
    return undefined;
  }

  return value;
}

function validateLayers(
  value: unknown,
  pointer: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
): string[] | undefined {
  if (value === undefined) {
    issues.push(missingRequiredField(pointer, 'layers is required.'));
    return undefined;
  }

  if (!Array.isArray(value)) {
    issues.push(
      invalidFieldType(pointer, 'layers must be an array of strings.'),
    );
    return undefined;
  }

  if (value.length === 0) {
    issues.push(
      invalidValue(pointer, 'layers must contain at least one layer.'),
    );
  }

  const layers: string[] = [];
  const seen = new Set<string>();

  value.forEach((entry, index) => {
    const layer = validateRequiredTrimmedString(
      entry,
      `${pointer}/${index}`,
      issues,
      'Layer',
    );

    if (!layer) {
      return;
    }

    if (seen.has(layer)) {
      issues.push(
        invalidValue(
          `${pointer}/${index}`,
          `Duplicate layer "${layer}" is not allowed.`,
        ),
      );
      return;
    }

    seen.add(layer);
    layers.push(layer);
  });

  return layers;
}

function validateRules(
  value: unknown,
  pointer: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
): Record<string, GovernanceRuleConfig> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const rulesRecord = asRecord(value);
  if (!rulesRecord) {
    issues.push(invalidFieldType(pointer, 'rules must be an object.'));
    return undefined;
  }

  const normalizedEntries = Object.keys(rulesRecord)
    .sort((left, right) => left.localeCompare(right))
    .flatMap((ruleId) => {
      const rulePointer = `${pointer}/${escapeJsonPointerSegment(ruleId)}`;
      const normalizedRuleId = validateRequiredTrimmedString(
        ruleId,
        rulePointer,
        issues,
        'Rule id',
      );
      const ruleConfigValue = rulesRecord[ruleId];
      const ruleConfig = asRecord(ruleConfigValue);

      if (!ruleConfig) {
        issues.push(
          invalidFieldType(rulePointer, 'Rule config must be an object.'),
        );
        return [];
      }

      validateUnknownFields(
        ruleConfig,
        RULE_CONFIG_FIELDS,
        rulePointer,
        issues,
      );

      const normalizedConfig: GovernanceRuleConfig = {};

      if (ruleConfig.enabled !== undefined) {
        if (typeof ruleConfig.enabled !== 'boolean') {
          issues.push(
            invalidFieldType(
              `${rulePointer}/enabled`,
              'Rule enabled must be a boolean.',
            ),
          );
        } else {
          normalizedConfig.enabled = ruleConfig.enabled;
        }
      }

      if (ruleConfig.severity !== undefined) {
        if (
          typeof ruleConfig.severity !== 'string' ||
          !PROFILE_SEVERITIES.has(ruleConfig.severity)
        ) {
          issues.push(
            invalidEnumValue(
              `${rulePointer}/severity`,
              'Rule severity must be "error", "warning", or "info".',
            ),
          );
        } else {
          normalizedConfig.severity = ruleConfig.severity as
            | 'error'
            | 'warning'
            | 'info';
        }
      }

      if (ruleConfig.options !== undefined) {
        normalizedConfig.options = ruleConfig.options;
      }

      if (!normalizedRuleId) {
        return [];
      }

      return [[normalizedRuleId, normalizedConfig] as const];
    });

  return normalizedEntries.length > 0
    ? Object.fromEntries(normalizedEntries)
    : {};
}

function validateAllowedLayerDependencies(
  value: unknown,
  pointer: string,
  layers: string[] | undefined,
  issues: StandaloneGovernanceProfileValidationIssue[],
): GovernanceProfile['allowedLayerDependencies'] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    issues.push(
      invalidFieldType(pointer, 'allowedLayerDependencies must be an object.'),
    );
    return undefined;
  }

  if (!layers) {
    return undefined;
  }

  const declaredLayers = new Set(layers);
  const rawEntries = Object.keys(record);

  rawEntries.forEach((sourceLayer) => {
    if (!declaredLayers.has(sourceLayer)) {
      issues.push(
        invalidValue(
          `${pointer}/${escapeJsonPointerSegment(sourceLayer)}`,
          `allowedLayerDependencies source layer "${sourceLayer}" is not declared in layers.`,
        ),
      );
    }
  });

  const normalized: GovernanceProfile['allowedLayerDependencies'] = {};

  layers.forEach((sourceLayer) => {
    if (!Object.prototype.hasOwnProperty.call(record, sourceLayer)) {
      return;
    }

    const sourcePointer = `${pointer}/${escapeJsonPointerSegment(sourceLayer)}`;
    const rawTargets = record[sourceLayer];

    if (!Array.isArray(rawTargets)) {
      issues.push(
        invalidFieldType(
          sourcePointer,
          `allowedLayerDependencies target list for "${sourceLayer}" must be an array of strings.`,
        ),
      );
      return;
    }

    const seenTargets = new Set<string>();
    const normalizedTargets: string[] = [];

    rawTargets.forEach((rawTarget, index) => {
      const targetPointer = `${sourcePointer}/${index}`;
      const targetLayer = validateRequiredTrimmedString(
        rawTarget,
        targetPointer,
        issues,
        'Layer dependency target',
      );

      if (!targetLayer) {
        return;
      }

      if (!declaredLayers.has(targetLayer)) {
        issues.push(
          invalidValue(
            targetPointer,
            `allowedLayerDependencies target layer "${targetLayer}" for source layer "${sourceLayer}" is not declared in layers.`,
          ),
        );
        return;
      }

      if (seenTargets.has(targetLayer)) {
        return;
      }

      seenTargets.add(targetLayer);
      normalizedTargets.push(targetLayer);
    });

    normalized[sourceLayer] = layers.filter((layer) =>
      normalizedTargets.includes(layer),
    );
  });

  return normalized;
}

function validateAllowedDomainDependencies(
  value: unknown,
  pointer: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
): GovernanceProfile['allowedDomainDependencies'] | undefined {
  if (value === undefined) {
    issues.push(
      missingRequiredField(pointer, 'allowedDomainDependencies is required.'),
    );
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    issues.push(
      invalidFieldType(pointer, 'allowedDomainDependencies must be an object.'),
    );
    return undefined;
  }

  const normalizedEntries = Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((domain) => {
      const domainPointer = `${pointer}/${escapeJsonPointerSegment(domain)}`;
      const normalizedDomain = validateRequiredTrimmedString(
        domain,
        domainPointer,
        issues,
        'Domain key',
      );
      const rawTargets = record[domain];

      if (!Array.isArray(rawTargets)) {
        issues.push(
          invalidFieldType(
            domainPointer,
            `allowedDomainDependencies entry for "${domain}" must be an array of strings.`,
          ),
        );
        return null;
      }

      const normalizedTargets = [
        ...new Set(
          rawTargets
            .map((target, index) =>
              validateRequiredTrimmedString(
                target,
                `${domainPointer}/${index}`,
                issues,
                'Allowed domain dependency',
              ),
            )
            .filter((target): target is string => !!target),
        ),
      ].sort((left, right) => left.localeCompare(right));

      if (!normalizedDomain) {
        return null;
      }

      return [normalizedDomain, normalizedTargets] as const;
    })
    .filter((entry): entry is readonly [string, string[]] => entry !== null);

  return Object.fromEntries(normalizedEntries);
}

function validateOwnership(
  value: unknown,
  pointer: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
): GovernanceProfile['ownership'] | undefined {
  if (value === undefined) {
    issues.push(missingRequiredField(pointer, 'ownership is required.'));
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    issues.push(invalidFieldType(pointer, 'ownership must be an object.'));
    return undefined;
  }

  validateUnknownFields(record, OWNERSHIP_FIELDS, pointer, issues);

  const required = record.required;
  if (typeof required !== 'boolean') {
    issues.push(
      invalidFieldType(
        `${pointer}/required`,
        'ownership.required must be a boolean.',
      ),
    );
  }

  const metadataField = validateRequiredTrimmedString(
    record.metadataField,
    `${pointer}/metadataField`,
    issues,
    'ownership.metadataField',
  );

  if (typeof required !== 'boolean' || !metadataField) {
    return undefined;
  }

  return {
    required,
    metadataField,
  };
}

function validateHealth(
  value: unknown,
  pointer: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
): GovernanceProfile['health'] | undefined {
  if (value === undefined) {
    issues.push(missingRequiredField(pointer, 'health is required.'));
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    issues.push(invalidFieldType(pointer, 'health must be an object.'));
    return undefined;
  }

  validateUnknownFields(record, HEALTH_FIELDS, pointer, issues);

  const thresholdsRecord = asRecord(record.statusThresholds);
  const thresholdsPointer = `${pointer}/statusThresholds`;
  if (!thresholdsRecord) {
    issues.push(
      invalidFieldType(
        thresholdsPointer,
        'health.statusThresholds must be an object.',
      ),
    );
    return undefined;
  }

  validateUnknownFields(
    thresholdsRecord,
    HEALTH_STATUS_THRESHOLD_FIELDS,
    thresholdsPointer,
    issues,
  );

  const goodMinScore = validateFiniteNumber(
    thresholdsRecord.goodMinScore,
    `${thresholdsPointer}/goodMinScore`,
    issues,
    'goodMinScore',
  );
  const warningMinScore = validateFiniteNumber(
    thresholdsRecord.warningMinScore,
    `${thresholdsPointer}/warningMinScore`,
    issues,
    'warningMinScore',
  );

  if (
    goodMinScore !== undefined &&
    warningMinScore !== undefined &&
    warningMinScore > goodMinScore
  ) {
    issues.push(
      invalidValue(
        thresholdsPointer,
        'health.statusThresholds.warningMinScore must be less than or equal to goodMinScore.',
      ),
    );
  }

  if (goodMinScore === undefined || warningMinScore === undefined) {
    return undefined;
  }

  return {
    statusThresholds: {
      goodMinScore,
      warningMinScore,
    },
  };
}

function validateMetrics(
  value: unknown,
  pointer: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
): GovernanceProfile['metrics'] | undefined {
  if (value === undefined) {
    issues.push(missingRequiredField(pointer, 'metrics is required.'));
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    issues.push(invalidFieldType(pointer, 'metrics must be an object.'));
    return undefined;
  }

  const normalizedEntries = Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((metricId) => {
      const metricPointer = `${pointer}/${escapeJsonPointerSegment(metricId)}`;
      const normalizedMetricId = validateRequiredTrimmedString(
        metricId,
        metricPointer,
        issues,
        'Metric id',
      );
      const value = validateFiniteNumber(
        record[metricId],
        metricPointer,
        issues,
        `Metric "${metricId}"`,
      );

      return normalizedMetricId && value !== undefined
        ? ([normalizedMetricId, value] as const)
        : null;
    })
    .filter((entry): entry is readonly [string, number] => entry !== null);

  return Object.fromEntries(normalizedEntries);
}

function validateRequiredTrimmedString(
  value: unknown,
  pointer: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
  label: string,
): string | undefined {
  if (typeof value !== 'string') {
    if (value === undefined) {
      issues.push(missingRequiredField(pointer, `${label} is required.`));
    } else {
      issues.push(invalidFieldType(pointer, `${label} must be a string.`));
    }

    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    issues.push(invalidValue(pointer, `${label} must be non-empty.`));
    return undefined;
  }

  return normalized;
}

function validateOptionalTrimmedString(
  value: unknown,
  pointer: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
  label: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    issues.push(invalidFieldType(pointer, `${label} must be a string.`));
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    issues.push(invalidValue(pointer, `${label} must be non-empty.`));
    return undefined;
  }

  return normalized;
}

function validateFiniteNumber(
  value: unknown,
  pointer: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
  label: string,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    if (value === undefined) {
      issues.push(missingRequiredField(pointer, `${label} is required.`));
    } else {
      issues.push(
        invalidFieldType(pointer, `${label} must be a finite number.`),
      );
    }

    return undefined;
  }

  return value;
}

function validateUnknownFields(
  record: Record<string, unknown>,
  allowedFields: Set<string>,
  pointer: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
): void {
  Object.keys(record).forEach((key) => {
    if (!allowedFields.has(key)) {
      issues.push({
        code: 'governance.profile.unknown_field',
        message: `Unknown field "${key}" is not allowed.`,
        path:
          pointer === '/'
            ? `/${escapeJsonPointerSegment(key)}`
            : `${pointer}/${escapeJsonPointerSegment(key)}`,
      });
    }
  });
}

function missingRequiredField(
  pointer: string,
  message: string,
): StandaloneGovernanceProfileValidationIssue {
  return {
    code: 'governance.profile.missing_required_field',
    message,
    path: pointer,
  };
}

function invalidFieldType(
  pointer: string,
  message: string,
): StandaloneGovernanceProfileValidationIssue {
  return {
    code: 'governance.profile.invalid_field_type',
    message,
    path: pointer,
  };
}

function invalidValue(
  pointer: string,
  message: string,
): StandaloneGovernanceProfileValidationIssue {
  return {
    code: 'governance.profile.invalid_value',
    message,
    path: pointer,
  };
}

function invalidEnumValue(
  pointer: string,
  message: string,
): StandaloneGovernanceProfileValidationIssue {
  return {
    code: 'governance.profile.invalid_enum_value',
    message,
    path: pointer,
  };
}

function throwValidationIssues(
  filePath: string,
  issues: StandaloneGovernanceProfileValidationIssue[],
): never {
  throw new StandaloneGovernanceProfileValidationError(filePath, issues);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function escapeJsonPointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
