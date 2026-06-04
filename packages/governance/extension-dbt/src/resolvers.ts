import type { Ownership } from '@anarchitects/governance-core';

export const DBT_METADATA_RESOLUTION_STATUSES = [
  'resolved',
  'unresolved',
  'invalid',
  'ambiguous',
] as const;

export type DbtMetadataResolutionStatus =
  (typeof DBT_METADATA_RESOLUTION_STATUSES)[number];

export interface DbtGovernanceMetadataResolverInput {
  id: string;
  name?: string;
  root?: string;
  path?: string;
  tags?: readonly string[];
  domain?: string;
  layer?: string;
  ownership?: Ownership | Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface DbtMetadataResolution<TValue> {
  status: DbtMetadataResolutionStatus;
  governanceNodeId: string;
  dbtUniqueId?: string;
  sourcePaths: string[];
  value?: TValue;
  values?: TValue[];
  invalidSourcePaths?: string[];
  rawValues?: unknown[];
}

export interface DbtResolvedGovernanceMetadata {
  governanceNodeId: string;
  dbtUniqueId?: string;
  layer: DbtMetadataResolution<string>;
  domain: DbtMetadataResolution<string>;
  owner: DbtMetadataResolution<string>;
  criticality: DbtMetadataResolution<string>;
  publicInterface: DbtMetadataResolution<boolean>;
  materializationCategory: DbtMetadataResolution<string>;
  documentationPresent: DbtMetadataResolution<boolean>;
  testsPresent: DbtMetadataResolution<boolean>;
  contractPresent: DbtMetadataResolution<boolean>;
}

export type DbtGovernanceMetadataResolution = DbtResolvedGovernanceMetadata;

export interface DbtLayerResolutionOptions {
  fromTags?: boolean;
  fromPath?: boolean;
  tagPrefix?: string;
  pathSegments?: Readonly<Record<string, string>>;
}

export interface DbtDomainResolutionOptions {
  fromPath?: boolean;
  pathRootSegments?: readonly string[];
  ignoredPathSegments?: readonly string[];
}

export interface DbtPublicInterfaceResolutionOptions {
  publicTags?: readonly string[];
  governedTags?: readonly string[];
}

export interface DbtGovernanceMetadataResolverOptions {
  layer?: DbtLayerResolutionOptions;
  domain?: DbtDomainResolutionOptions;
  publicInterface?: DbtPublicInterfaceResolutionOptions;
}

const DEFAULT_LAYER_PATH_SEGMENTS: Readonly<Record<string, string>> = {
  staging: 'staging',
  intermediate: 'intermediate',
  marts: 'marts',
};

const DEFAULT_DOMAIN_PATH_ROOT_SEGMENTS = [
  'models',
  'seeds',
  'snapshots',
  'analyses',
  'exposures',
] as const;

const DEFAULT_PUBLIC_TAGS = ['public', 'published'] as const;
const DEFAULT_GOVERNED_TAGS = ['governed'] as const;

export function resolveDbtGovernanceMetadata(
  input: DbtGovernanceMetadataResolverInput,
  options: DbtGovernanceMetadataResolverOptions = {},
): DbtGovernanceMetadataResolution {
  return {
    governanceNodeId: input.id,
    dbtUniqueId: readDbtUniqueId(input),
    layer: resolveDbtLayer(input, options),
    domain: resolveDbtDomain(input, options),
    owner: resolveDbtOwner(input),
    criticality: resolveDbtCriticality(input),
    publicInterface: resolveDbtPublicInterface(input, options),
    materializationCategory: resolveDbtMaterializationCategory(input),
    documentationPresent: resolveDbtDocumentationPresence(input),
    testsPresent: resolveDbtTestPresence(input),
    contractPresent: resolveDbtContractPresence(input),
  };
}

export function resolveDbtLayer(
  input: DbtGovernanceMetadataResolverInput,
  options: DbtGovernanceMetadataResolverOptions = {},
): DbtMetadataResolution<string> {
  const layerOptions = options.layer ?? {};
  const explicitValid: ResolutionCandidate<string>[] = [];
  const explicitInvalid: InvalidResolutionCandidate[] = [];
  const tagValid: ResolutionCandidate<string>[] = [];
  const tagInvalid: InvalidResolutionCandidate[] = [];
  const pathValid: ResolutionCandidate<string>[] = [];

  collectStringCandidate(
    explicitValid,
    explicitInvalid,
    input.layer,
    'project.layer',
  );
  collectStringCandidate(
    explicitValid,
    explicitInvalid,
    readPathValue(input.metadata, ['dbt', 'resource', 'meta', 'layer']),
    'metadata.dbt.resource.meta.layer',
  );

  if (layerOptions.fromTags ?? true) {
    const prefix = layerOptions.tagPrefix ?? 'layer:';
    for (const tag of input.tags ?? []) {
      if (!tag.startsWith(prefix)) {
        continue;
      }

      collectStringCandidate(
        tagValid,
        tagInvalid,
        tag.slice(prefix.length),
        'tags',
      );
    }
  }

  if (layerOptions.fromPath ?? true) {
    const pathSegments = getDbtPathSegments(input);
    const layerPathSegments =
      layerOptions.pathSegments ?? DEFAULT_LAYER_PATH_SEGMENTS;

    for (const [segment, layer] of Object.entries(layerPathSegments)) {
      if (pathSegments.includes(segment)) {
        pathValid.push({
          value: layer,
          sourcePath: 'metadata.dbt.relation.originalFilePath',
          rawValue: segment,
        });
      }
    }
  }

  return buildResolutionFromGroups(
    input,
    { valid: explicitValid, invalid: explicitInvalid },
    { valid: tagValid, invalid: tagInvalid },
    { valid: pathValid, invalid: [] },
  );
}

export function resolveDbtDomain(
  input: DbtGovernanceMetadataResolverInput,
  options: DbtGovernanceMetadataResolverOptions = {},
): DbtMetadataResolution<string> {
  const domainOptions = options.domain ?? {};
  const explicitValid: ResolutionCandidate<string>[] = [];
  const explicitInvalid: InvalidResolutionCandidate[] = [];
  const pathValid: ResolutionCandidate<string>[] = [];

  collectStringCandidate(
    explicitValid,
    explicitInvalid,
    input.domain,
    'project.domain',
  );
  collectStringCandidate(
    explicitValid,
    explicitInvalid,
    readPathValue(input.metadata, ['dbt', 'resource', 'meta', 'domain']),
    'metadata.dbt.resource.meta.domain',
  );

  if (domainOptions.fromPath) {
    const pathSegments = getDbtPathSegments(input);
    const rootSegments =
      domainOptions.pathRootSegments ?? DEFAULT_DOMAIN_PATH_ROOT_SEGMENTS;
    const ignoredSegments = new Set([
      ...Object.keys(DEFAULT_LAYER_PATH_SEGMENTS),
      ...(domainOptions.ignoredPathSegments ?? []),
    ]);

    const rootIndex = pathSegments.findIndex((segment) =>
      rootSegments.includes(segment),
    );
    const domainSegment = pathSegments
      .slice(rootIndex >= 0 ? rootIndex + 1 : 0)
      .find((segment) => !ignoredSegments.has(segment));

    if (domainSegment) {
      pathValid.push({
        value: domainSegment,
        sourcePath: 'metadata.dbt.relation.originalFilePath',
        rawValue: domainSegment,
      });
    }
  }

  return buildResolutionFromGroups(
    input,
    { valid: explicitValid, invalid: explicitInvalid },
    { valid: pathValid, invalid: [] },
  );
}

export function resolveDbtOwner(
  input: DbtGovernanceMetadataResolverInput,
): DbtMetadataResolution<string> {
  const normalizedValid: ResolutionCandidate<string>[] = [];
  const normalizedInvalid: InvalidResolutionCandidate[] = [];
  const metadataValid: ResolutionCandidate<string>[] = [];
  const metadataInvalid: InvalidResolutionCandidate[] = [];

  collectStringCandidate(
    normalizedValid,
    normalizedInvalid,
    readOwnershipTeam(input.ownership),
    'project.ownership.team',
  );
  collectOwnerCandidate(
    metadataValid,
    metadataInvalid,
    readPathValue(input.metadata, ['dbt', 'resource', 'owner']),
    'metadata.dbt.resource.owner',
  );
  collectStringCandidate(
    metadataValid,
    metadataInvalid,
    readPathValue(input.metadata, ['dbt', 'resource', 'group']),
    'metadata.dbt.resource.group',
  );
  collectStringCandidate(
    metadataValid,
    metadataInvalid,
    readPathValue(input.metadata, ['dbt', 'resource', 'meta', 'owner']),
    'metadata.dbt.resource.meta.owner',
  );

  return buildResolutionFromGroups(
    input,
    { valid: normalizedValid, invalid: normalizedInvalid },
    { valid: metadataValid, invalid: metadataInvalid },
  );
}

export function resolveDbtCriticality(
  input: DbtGovernanceMetadataResolverInput,
): DbtMetadataResolution<string> {
  const valid: ResolutionCandidate<string>[] = [];
  const invalid: InvalidResolutionCandidate[] = [];

  collectStringCandidate(
    valid,
    invalid,
    readPathValue(input.metadata, ['dbt', 'resource', 'meta', 'criticality']),
    'metadata.dbt.resource.meta.criticality',
  );

  return buildResolution(input, valid, invalid);
}

export function resolveDbtPublicInterface(
  input: DbtGovernanceMetadataResolverInput,
  options: DbtGovernanceMetadataResolverOptions = {},
): DbtMetadataResolution<boolean> {
  const interfaceOptions = options.publicInterface ?? {};
  const explicitValid: ResolutionCandidate<boolean>[] = [];
  const explicitInvalid: InvalidResolutionCandidate[] = [];
  const tagValid: ResolutionCandidate<boolean>[] = [];

  collectBooleanCandidate(
    explicitValid,
    explicitInvalid,
    readPathValue(input.metadata, ['dbt', 'resource', 'meta', 'public']),
    'metadata.dbt.resource.meta.public',
  );
  collectBooleanCandidate(
    explicitValid,
    explicitInvalid,
    readPathValue(input.metadata, ['dbt', 'resource', 'meta', 'governed']),
    'metadata.dbt.resource.meta.governed',
  );

  const publicTags = new Set(
    interfaceOptions.publicTags ?? DEFAULT_PUBLIC_TAGS,
  );
  const governedTags = new Set(
    interfaceOptions.governedTags ?? DEFAULT_GOVERNED_TAGS,
  );

  if ((input.tags ?? []).some((tag) => publicTags.has(tag))) {
    tagValid.push({
      value: true,
      sourcePath: 'tags',
      rawValue: input.tags,
    });
  }

  if ((input.tags ?? []).some((tag) => governedTags.has(tag))) {
    tagValid.push({
      value: true,
      sourcePath: 'tags',
      rawValue: input.tags,
    });
  }

  return buildResolutionFromGroups(
    input,
    { valid: explicitValid, invalid: explicitInvalid },
    { valid: tagValid, invalid: [] },
  );
}

export function resolveDbtMaterializationCategory(
  input: DbtGovernanceMetadataResolverInput,
): DbtMetadataResolution<string> {
  const valid: ResolutionCandidate<string>[] = [];
  const invalid: InvalidResolutionCandidate[] = [];

  collectStringCandidate(
    valid,
    invalid,
    readPathValue(input.metadata, ['dbt', 'resource', 'materialization']),
    'metadata.dbt.resource.materialization',
  );

  return buildResolution(input, valid, invalid);
}

export function resolveDbtDocumentationPresence(
  input: DbtGovernanceMetadataResolverInput,
): DbtMetadataResolution<boolean> {
  const valid: ResolutionCandidate<boolean>[] = [];
  const invalid: InvalidResolutionCandidate[] = [];

  const description = readPathValue(input.metadata, [
    'dbt',
    'documentation',
    'description',
  ]);
  if (typeof description === 'string') {
    valid.push({
      value: description.trim().length > 0,
      sourcePath: 'metadata.dbt.documentation.description',
      rawValue: description,
    });
  } else if (description !== undefined) {
    invalid.push({
      sourcePath: 'metadata.dbt.documentation.description',
      rawValue: description,
    });
  }

  collectBooleanCandidate(
    valid,
    invalid,
    readPathValue(input.metadata, ['dbt', 'documentation', 'hasDescription']),
    'metadata.dbt.documentation.hasDescription',
  );
  collectBooleanCandidate(
    valid,
    invalid,
    readPathValue(input.metadata, ['dbt', 'documentation', 'hasDocs']),
    'metadata.dbt.documentation.hasDocs',
  );

  return buildResolution(input, valid, invalid);
}

export function resolveDbtTestPresence(
  input: DbtGovernanceMetadataResolverInput,
): DbtMetadataResolution<boolean> {
  const valid: ResolutionCandidate<boolean>[] = [];
  const invalid: InvalidResolutionCandidate[] = [];
  const tests = readPathValue(input.metadata, ['dbt', 'validation', 'tests']);

  if (Array.isArray(tests)) {
    valid.push({
      value: tests.length > 0,
      sourcePath: 'metadata.dbt.validation.tests',
      rawValue: tests,
    });
  } else if (typeof tests === 'boolean') {
    valid.push({
      value: tests,
      sourcePath: 'metadata.dbt.validation.tests',
      rawValue: tests,
    });
  } else if (typeof tests === 'string') {
    valid.push({
      value: tests.trim().length > 0,
      sourcePath: 'metadata.dbt.validation.tests',
      rawValue: tests,
    });
  } else if (tests !== undefined) {
    invalid.push({
      sourcePath: 'metadata.dbt.validation.tests',
      rawValue: tests,
    });
  }

  return buildResolution(input, valid, invalid);
}

export function resolveDbtContractPresence(
  input: DbtGovernanceMetadataResolverInput,
): DbtMetadataResolution<boolean> {
  const valid: ResolutionCandidate<boolean>[] = [];
  const invalid: InvalidResolutionCandidate[] = [];
  const contract = readPathValue(input.metadata, [
    'dbt',
    'validation',
    'contract',
  ]);

  if (typeof contract === 'boolean') {
    valid.push({
      value: contract,
      sourcePath: 'metadata.dbt.validation.contract',
      rawValue: contract,
    });
  } else if (isRecord(contract)) {
    valid.push({
      value: true,
      sourcePath: 'metadata.dbt.validation.contract',
      rawValue: contract,
    });
  } else if (contract !== undefined) {
    invalid.push({
      sourcePath: 'metadata.dbt.validation.contract',
      rawValue: contract,
    });
  }

  return buildResolution(input, valid, invalid);
}

interface ResolutionCandidate<TValue> {
  value: TValue;
  sourcePath: string;
  rawValue: unknown;
}

interface InvalidResolutionCandidate {
  sourcePath: string;
  rawValue: unknown;
}

function buildResolution<TValue>(
  input: DbtGovernanceMetadataResolverInput,
  valid: ResolutionCandidate<TValue>[],
  invalid: InvalidResolutionCandidate[],
): DbtMetadataResolution<TValue> {
  const base = {
    governanceNodeId: input.id,
    ...(readDbtUniqueId(input) ? { dbtUniqueId: readDbtUniqueId(input) } : {}),
  };

  if (valid.length === 0) {
    if (invalid.length > 0) {
      return {
        ...base,
        status: 'invalid',
        sourcePaths: [],
        invalidSourcePaths: invalid.map((candidate) => candidate.sourcePath),
        rawValues: invalid.map((candidate) => candidate.rawValue),
      };
    }

    return {
      ...base,
      status: 'unresolved',
      sourcePaths: [],
    };
  }

  const uniqueValues = dedupeResolutionValues(valid);
  if (uniqueValues.length === 1) {
    const resolvedValue = uniqueValues[0];

    if (!resolvedValue) {
      throw new Error('Expected at least one resolved dbt metadata value.');
    }

    return {
      ...base,
      status: 'resolved',
      value: resolvedValue.value,
      sourcePaths: valid
        .filter((candidate) =>
          isSameValue(candidate.value, resolvedValue.value),
        )
        .map((candidate) => candidate.sourcePath),
      ...(invalid.length > 0
        ? {
            invalidSourcePaths: invalid.map(
              (candidate) => candidate.sourcePath,
            ),
            rawValues: [
              ...valid.map((candidate) => candidate.rawValue),
              ...invalid.map((candidate) => candidate.rawValue),
            ],
          }
        : {
            rawValues: valid.map((candidate) => candidate.rawValue),
          }),
    };
  }

  return {
    ...base,
    status: 'ambiguous',
    values: uniqueValues.map((candidate) => candidate.value),
    sourcePaths: valid.map((candidate) => candidate.sourcePath),
    ...(invalid.length > 0
      ? {
          invalidSourcePaths: invalid.map((candidate) => candidate.sourcePath),
        }
      : {}),
    rawValues: [
      ...valid.map((candidate) => candidate.rawValue),
      ...invalid.map((candidate) => candidate.rawValue),
    ],
  };
}

function buildResolutionFromGroups<TValue>(
  input: DbtGovernanceMetadataResolverInput,
  ...groups: Array<{
    valid: ResolutionCandidate<TValue>[];
    invalid: InvalidResolutionCandidate[];
  }>
): DbtMetadataResolution<TValue> {
  for (const group of groups) {
    if (group.valid.length > 0 || group.invalid.length > 0) {
      return buildResolution(input, group.valid, group.invalid);
    }
  }

  return buildResolution(input, [], []);
}

function dedupeResolutionValues<TValue>(
  candidates: ResolutionCandidate<TValue>[],
): ResolutionCandidate<TValue>[] {
  const deduped: ResolutionCandidate<TValue>[] = [];

  for (const candidate of candidates) {
    if (
      deduped.some((existingCandidate) =>
        isSameValue(existingCandidate.value, candidate.value),
      )
    ) {
      continue;
    }

    deduped.push(candidate);
  }

  return deduped;
}

function isSameValue<TValue>(left: TValue, right: TValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readDbtUniqueId(
  input: DbtGovernanceMetadataResolverInput,
): string | undefined {
  const uniqueId = readPathValue(input.metadata, [
    'dbt',
    'identity',
    'uniqueId',
  ]);
  return typeof uniqueId === 'string' && uniqueId.trim().length > 0
    ? uniqueId.trim()
    : undefined;
}

function collectStringCandidate(
  valid: ResolutionCandidate<string>[],
  invalid: InvalidResolutionCandidate[],
  value: unknown,
  sourcePath: string,
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    valid.push({
      value: value.trim(),
      sourcePath,
      rawValue: value,
    });
    return;
  }

  invalid.push({
    sourcePath,
    rawValue: value,
  });
}

function collectBooleanCandidate(
  valid: ResolutionCandidate<boolean>[],
  invalid: InvalidResolutionCandidate[],
  value: unknown,
  sourcePath: string,
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value === 'boolean') {
    valid.push({
      value,
      sourcePath,
      rawValue: value,
    });
    return;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'false') {
      valid.push({
        value: normalized === 'true',
        sourcePath,
        rawValue: value,
      });
      return;
    }
  }

  invalid.push({
    sourcePath,
    rawValue: value,
  });
}

function collectOwnerCandidate(
  valid: ResolutionCandidate<string>[],
  invalid: InvalidResolutionCandidate[],
  value: unknown,
  sourcePath: string,
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value === 'string') {
    collectStringCandidate(valid, invalid, value, sourcePath);
    return;
  }

  if (isRecord(value)) {
    collectStringCandidate(
      valid,
      invalid,
      value.name ?? value.team,
      sourcePath,
    );
    return;
  }

  invalid.push({
    sourcePath,
    rawValue: value,
  });
}

function readOwnershipTeam(
  ownership: DbtGovernanceMetadataResolverInput['ownership'],
): unknown {
  if (!isRecord(ownership)) {
    return undefined;
  }

  return ownership.team;
}

function readPathValue(
  value: Record<string, unknown> | undefined,
  path: readonly string[],
): unknown {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getDbtPathSegments(
  input: DbtGovernanceMetadataResolverInput,
): string[] {
  const rawPath =
    readPathValue(input.metadata, ['dbt', 'relation', 'originalFilePath']) ??
    readPathValue(input.metadata, ['dbt', 'relation', 'sourcePath']) ??
    readPathValue(input.metadata, ['dbt', 'relation', 'path']) ??
    input.path ??
    input.root;

  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    return [];
  }

  return rawPath
    .replaceAll('\\', '/')
    .split('/')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)
    .filter((segment, index, segments) => {
      const lastIndex = segments.length - 1;
      return index !== lastIndex || !segment.includes('.');
    });
}
