import type {
  GovernanceDiagnostic,
  GovernanceDiagnosticCategory,
  GovernanceDiagnosticKind,
  GovernanceDiagnosticSeverity,
  GovernanceProfile,
} from '@anarchitects/governance-core';

import type {
  DbtGovernanceDiagnosticProvider,
  DbtGovernanceDiagnosticProviderInput,
} from './contracts.js';
import {
  resolveDbtGovernanceMetadata,
  type DbtGovernanceMetadataResolution,
  type DbtGovernanceMetadataResolverInput,
  type DbtMetadataResolution,
} from './resolvers.js';
import { toCompatibilityWorkspace } from './workspace-compat.js';

export const DBT_GOVERNANCE_DIAGNOSTIC_SOURCE = 'governance.dbt_extension';

export const DBT_GOVERNANCE_DIAGNOSTIC_CODES = [
  'DBT_LAYER_UNRESOLVED',
  'DBT_DOMAIN_UNRESOLVED',
  'DBT_OWNER_MISSING',
  'DBT_OWNER_INVALID',
  'DBT_CRITICALITY_INVALID',
  'DBT_PUBLIC_MARKER_INVALID',
  'DBT_RULE_SKIPPED_MISSING_METADATA',
  'DBT_GOVERNANCE_PROFILE_INVALID',
] as const;

export type DbtGovernanceDiagnosticCode =
  (typeof DBT_GOVERNANCE_DIAGNOSTIC_CODES)[number];

export interface DbtGovernanceDiagnosticDetails
  extends Record<string, unknown> {
  governanceNodeId: string;
  dbtUniqueId?: string;
  field?: string;
  resolution?: string;
  metadataPaths?: string[];
  invalidMetadataPaths?: string[];
  rawValues?: unknown[];
  value?: unknown;
  values?: unknown[];
  missingMetadata?: string[];
  skippedRuleIds?: string[];
  profileName?: string;
  profileLayers?: string[];
}

export interface DbtGovernanceExtensionDiagnostic extends GovernanceDiagnostic {
  code: DbtGovernanceDiagnosticCode;
  details?: DbtGovernanceDiagnosticDetails;
}

export interface DbtGovernanceDiagnosticsProviderOptions {
  includeSkippedRuleDiagnostics?: boolean;
}

interface DbtProjectLike {
  id: string;
  name?: string;
  root?: string;
  tags?: readonly string[];
  domain?: string;
  layer?: string;
  ownership?: unknown;
  metadata?: Record<string, unknown>;
}

interface CreateDiagnosticOptions {
  code: DbtGovernanceDiagnosticCode;
  governanceNodeId: string;
  dbtUniqueId?: string;
  field?: string;
  message: string;
  recommendation: string;
  severity?: GovernanceDiagnosticSeverity;
  kind?: GovernanceDiagnosticKind;
  category?: GovernanceDiagnosticCategory;
  details?: Omit<
    DbtGovernanceDiagnosticDetails,
    'governanceNodeId' | 'dbtUniqueId' | 'field'
  >;
}

const DEFAULT_PROVIDER_ID = 'dbt-governance-diagnostics';

export const dbtGovernanceDiagnosticsProvider =
  createDbtGovernanceDiagnosticsProvider();

export function createDbtGovernanceDiagnosticsProvider(
  options: DbtGovernanceDiagnosticsProviderOptions = {},
): DbtGovernanceDiagnosticProvider {
  return {
    id: DEFAULT_PROVIDER_ID,
    provideDiagnostics: (input) =>
      buildDbtGovernanceDiagnostics(input, options),
  };
}

export function buildDbtGovernanceDiagnostics(
  input: DbtGovernanceDiagnosticProviderInput,
  options: DbtGovernanceDiagnosticsProviderOptions = {},
): DbtGovernanceExtensionDiagnostic[] {
  const metadataResolutions = resolveMetadataResolutions(input);

  return metadataResolutions.flatMap((resolution) =>
    buildDiagnosticsForResolution(
      resolution,
      input.profile,
      input.context.profileName,
      options,
    ),
  );
}

function resolveMetadataResolutions(
  input: DbtGovernanceDiagnosticProviderInput,
): readonly DbtGovernanceMetadataResolution[] {
  if (input.metadataResolutions && input.metadataResolutions.length > 0) {
    return input.metadataResolutions;
  }

  return toCompatibilityWorkspace(input.workspace).projects
    .filter((project) => hasDbtMetadata(project.metadata))
    .map((project) => resolveDbtGovernanceMetadata(toResolverInput(project)));
}

function buildDiagnosticsForResolution(
  resolution: DbtGovernanceMetadataResolution,
  profile: GovernanceProfile,
  profileName: string,
  options: DbtGovernanceDiagnosticsProviderOptions,
): DbtGovernanceExtensionDiagnostic[] {
  const diagnostics: DbtGovernanceExtensionDiagnostic[] = [];

  appendUnresolvedMetadataDiagnostic(
    diagnostics,
    'DBT_LAYER_UNRESOLVED',
    resolution.layer,
    'layer',
    'Layer metadata could not be resolved from normalized dbt governance input.',
    'Populate project.layer, metadata.dbt.resource.meta.layer, or a supported layer tag/path convention.',
  );
  appendUnresolvedMetadataDiagnostic(
    diagnostics,
    'DBT_DOMAIN_UNRESOLVED',
    resolution.domain,
    'domain',
    'Domain metadata could not be resolved from normalized dbt governance input.',
    'Populate project.domain or metadata.dbt.resource.meta.domain, or provide a runtime-configured domain resolver convention.',
  );
  appendUnresolvedMetadataDiagnostic(
    diagnostics,
    'DBT_OWNER_MISSING',
    resolution.owner,
    'owner',
    'Owner metadata is missing, so dbt governance interpretation remains incomplete.',
    'Populate project.ownership.team, metadata.dbt.resource.owner, metadata.dbt.resource.group, or metadata.dbt.resource.meta.owner.',
  );

  appendInvalidMetadataDiagnostic(
    diagnostics,
    'DBT_OWNER_INVALID',
    resolution.owner,
    'owner',
    'Owner metadata was present but not in a supported string form.',
    'Normalize owner metadata to a non-empty string value before running governance interpretation.',
  );
  appendInvalidMetadataDiagnostic(
    diagnostics,
    'DBT_CRITICALITY_INVALID',
    resolution.criticality,
    'criticality',
    'Criticality metadata was present but not in a supported string form.',
    'Normalize metadata.dbt.resource.meta.criticality to a non-empty string value.',
  );
  appendInvalidMetadataDiagnostic(
    diagnostics,
    'DBT_PUBLIC_MARKER_INVALID',
    resolution.publicInterface,
    'publicInterface',
    'Public/governed marker metadata was present but not in a supported boolean form.',
    'Normalize metadata.dbt.resource.meta.public or metadata.dbt.resource.meta.governed to a boolean value, or use supported public/governed tags.',
  );

  appendProfileInterpretationDiagnostic(
    diagnostics,
    resolution.layer,
    'layer',
    profileName,
  );
  appendProfileInterpretationDiagnostic(
    diagnostics,
    resolution.domain,
    'domain',
    profileName,
  );
  appendUnsupportedLayerDiagnostic(
    diagnostics,
    resolution.layer,
    profile,
    profileName,
  );

  if (options.includeSkippedRuleDiagnostics ?? true) {
    appendSkippedRuleDiagnostic(diagnostics, resolution, profile, profileName);
  }

  return diagnostics;
}

function appendUnresolvedMetadataDiagnostic(
  diagnostics: DbtGovernanceExtensionDiagnostic[],
  code: Extract<
    DbtGovernanceDiagnosticCode,
    'DBT_LAYER_UNRESOLVED' | 'DBT_DOMAIN_UNRESOLVED' | 'DBT_OWNER_MISSING'
  >,
  resolution: DbtMetadataResolution<unknown>,
  field: string,
  message: string,
  recommendation: string,
): void {
  if (resolution.status !== 'unresolved') {
    return;
  }

  diagnostics.push(
    createDiagnostic({
      code,
      governanceNodeId: resolution.governanceNodeId,
      dbtUniqueId: resolution.dbtUniqueId,
      field,
      message,
      recommendation,
      severity: 'warning',
      kind: 'observation',
      details: {
        resolution: resolution.status,
        metadataPaths: resolution.sourcePaths,
      },
    }),
  );
}

function appendInvalidMetadataDiagnostic(
  diagnostics: DbtGovernanceExtensionDiagnostic[],
  code: Extract<
    DbtGovernanceDiagnosticCode,
    | 'DBT_OWNER_INVALID'
    | 'DBT_CRITICALITY_INVALID'
    | 'DBT_PUBLIC_MARKER_INVALID'
  >,
  resolution: DbtMetadataResolution<unknown>,
  field: string,
  message: string,
  recommendation: string,
): void {
  if (resolution.status !== 'invalid') {
    return;
  }

  diagnostics.push(
    createDiagnostic({
      code,
      governanceNodeId: resolution.governanceNodeId,
      dbtUniqueId: resolution.dbtUniqueId,
      field,
      message,
      recommendation,
      severity: 'warning',
      kind: 'warning',
      details: {
        resolution: resolution.status,
        invalidMetadataPaths: resolution.invalidSourcePaths,
        rawValues: resolution.rawValues,
      },
    }),
  );
}

function appendProfileInterpretationDiagnostic(
  diagnostics: DbtGovernanceExtensionDiagnostic[],
  resolution: DbtMetadataResolution<unknown>,
  field: string,
  profileName: string,
): void {
  if (resolution.status !== 'ambiguous') {
    return;
  }

  diagnostics.push(
    createDiagnostic({
      code: 'DBT_GOVERNANCE_PROFILE_INVALID',
      governanceNodeId: resolution.governanceNodeId,
      dbtUniqueId: resolution.dbtUniqueId,
      field,
      message: `Ambiguous ${field} interpretation prevents deterministic dbt governance analysis for profile "${profileName}".`,
      recommendation:
        'Provide one authoritative metadata source for this field or disable the conflicting resolver convention in the runtime.',
      severity: 'warning',
      kind: 'warning',
      details: {
        resolution: resolution.status,
        metadataPaths: resolution.sourcePaths,
        invalidMetadataPaths: resolution.invalidSourcePaths,
        values: resolution.values,
        rawValues: resolution.rawValues,
        profileName,
      },
    }),
  );
}

function appendUnsupportedLayerDiagnostic(
  diagnostics: DbtGovernanceExtensionDiagnostic[],
  resolution: DbtMetadataResolution<string>,
  profile: GovernanceProfile,
  profileName: string,
): void {
  if (
    resolution.status !== 'resolved' ||
    resolution.value === undefined ||
    profile.layers.length === 0 ||
    profile.layers.includes(resolution.value)
  ) {
    return;
  }

  diagnostics.push(
    createDiagnostic({
      code: 'DBT_GOVERNANCE_PROFILE_INVALID',
      governanceNodeId: resolution.governanceNodeId,
      dbtUniqueId: resolution.dbtUniqueId,
      field: 'layer',
      message: `Resolved dbt layer "${resolution.value}" is not supported by governance profile "${profileName}".`,
      recommendation:
        'Align the normalized dbt layer metadata with one of the profile layers or update the runtime profile configuration.',
      severity: 'warning',
      kind: 'warning',
      details: {
        resolution: resolution.status,
        metadataPaths: resolution.sourcePaths,
        value: resolution.value,
        profileName,
        profileLayers: profile.layers,
      },
    }),
  );
}

function appendSkippedRuleDiagnostic(
  diagnostics: DbtGovernanceExtensionDiagnostic[],
  resolution: DbtGovernanceMetadataResolution,
  profile: GovernanceProfile,
  profileName: string,
): void {
  const missingMetadata: string[] = [];
  const skippedRuleIds: string[] = [];

  if (resolution.layer.status === 'unresolved') {
    missingMetadata.push('layer');
    skippedRuleIds.push('layer-boundary');
  }

  if (resolution.domain.status === 'unresolved') {
    missingMetadata.push('domain');
    skippedRuleIds.push('domain-boundary');
  }

  if (profile.ownership.required && resolution.owner.status === 'unresolved') {
    missingMetadata.push('owner');
    skippedRuleIds.push('ownership-presence');
  }

  if (missingMetadata.length === 0) {
    return;
  }

  diagnostics.push(
    createDiagnostic({
      code: 'DBT_RULE_SKIPPED_MISSING_METADATA',
      governanceNodeId: resolution.governanceNodeId,
      dbtUniqueId: resolution.dbtUniqueId,
      field: 'governance-analysis',
      message:
        'Metadata-dependent governance analysis is partial because required dbt governance metadata is missing.',
      recommendation:
        'Populate the missing metadata fields so downstream governance checks can run deterministically.',
      severity: 'warning',
      kind: 'observation',
      details: {
        missingMetadata,
        skippedRuleIds,
        profileName,
      },
    }),
  );
}

function createDiagnostic({
  code,
  governanceNodeId,
  dbtUniqueId,
  field,
  message,
  recommendation,
  severity,
  kind,
  category,
  details,
}: CreateDiagnosticOptions): DbtGovernanceExtensionDiagnostic {
  return {
    id: [code, governanceNodeId, field].filter(Boolean).join(':'),
    code,
    message,
    severity: severity ?? 'warning',
    kind: kind ?? 'warning',
    category: category ?? 'configuration',
    source: DBT_GOVERNANCE_DIAGNOSTIC_SOURCE,
    reference: {
      nodeId: governanceNodeId,
    },
    recommendation,
    details: {
      governanceNodeId,
      ...(dbtUniqueId ? { dbtUniqueId } : {}),
      ...(field ? { field } : {}),
      ...details,
    },
    metadata: {
      technology: 'dbt',
      boundary: 'extension',
      ...(field ? { field } : {}),
    },
  };
}

function hasDbtMetadata(
  metadata: unknown,
): metadata is Record<string, unknown> {
  return isRecord(metadata) && isRecord(metadata.dbt);
}

function toResolverInput(
  project: DbtProjectLike,
): DbtGovernanceMetadataResolverInput {
  return {
    id: project.id,
    name: project.name,
    root: project.root,
    tags: project.tags,
    domain: project.domain,
    layer: project.layer,
    ownership: isRecord(project.ownership) ? project.ownership : undefined,
    metadata: project.metadata,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
