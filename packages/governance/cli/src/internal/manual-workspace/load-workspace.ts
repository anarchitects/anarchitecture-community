import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parseDocument } from 'yaml';

import type {
  GovernanceCapability,
  GovernanceDiagnostic,
  GovernanceNodeInput,
  GovernanceRelationInput,
  GovernanceWorkspace,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';
import { buildGovernanceWorkspace } from '@anarchitects/governance-core';

import { createManualWorkspaceCapability } from './capability.js';

const TOP_LEVEL_FIELDS = new Set([
  'schemaVersion',
  'workspace',
  'nodes',
  'relations',
]);
const LEGACY_TOP_LEVEL_FIELDS = new Map([
  ['projects', 'nodes'],
  ['dependencies', 'relations'],
]);
const WORKSPACE_FIELDS = new Set([
  'id',
  'name',
  'root',
  'capabilities',
  'diagnostics',
  'metadata',
]);
const NODE_FIELDS = new Set([
  'id',
  'name',
  'kind',
  'technology',
  'sourceSystem',
  'root',
  'path',
  'tags',
  'classification',
  'ownership',
  'perspective',
  'source',
  'evidence',
  'authority',
  'confidence',
  'metadata',
]);
const RELATION_FIELDS = new Set([
  'id',
  'sourceNodeId',
  'targetNodeId',
  'kind',
  'perspective',
  'source',
  'evidence',
  'authority',
  'confidence',
  'metadata',
]);

type GenericWorkspaceFormat = 'json' | 'yaml';

interface GenericWorkspaceSchema {
  schemaVersion: 1;
  workspace: {
    id?: string;
    name: string;
    root: string;
    capabilities?: GovernanceCapability[];
    diagnostics?: GovernanceDiagnostic[];
    metadata?: Record<string, unknown>;
  };
  nodes: GovernanceNodeInput[];
  relations: GovernanceRelationInput[];
}

interface ValidatedNodeInput extends GovernanceNodeInput {
  index: number;
}

interface ValidatedRelationInput extends GovernanceRelationInput {
  index: number;
}

export interface GenericWorkspaceValidationIssue extends GovernanceDiagnostic {
  path: string;
}

export type GenericWorkspaceLoadErrorCode =
  | 'governance.workspace_loader.read_failed'
  | 'governance.workspace_loader.unsupported_extension'
  | 'governance.workspace_loader.parse_error';

export class GenericWorkspaceLoadError extends Error {
  constructor(
    message: string,
    public readonly code: GenericWorkspaceLoadErrorCode,
    public readonly filePath: string,
  ) {
    super(message);
    this.name = 'GenericWorkspaceLoadError';
  }
}

export class GenericWorkspaceValidationError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly issues: GenericWorkspaceValidationIssue[],
  ) {
    super(
      `Generic workspace validation failed for "${filePath}" with ${
        issues.length
      } issue${issues.length === 1 ? '' : 's'}.`,
    );
    this.name = 'GenericWorkspaceValidationError';
  }
}

export interface LoadedGenericWorkspace {
  filePath: string;
  format: GenericWorkspaceFormat;
  adapterResult: GovernanceWorkspaceAdapterResult;
  workspace: GovernanceWorkspace;
}

export function loadGenericWorkspace(
  workspaceFilePath: string,
): LoadedGenericWorkspace {
  const filePath = path.resolve(workspaceFilePath);
  const format = detectWorkspaceFormat(filePath);
  const source = readWorkspaceFile(filePath);
  const parsed = parseWorkspaceSource(source, filePath, format);
  let validated: GenericWorkspaceSchema;

  try {
    validated = validateGenericWorkspaceSchema(parsed);
  } catch (error) {
    if (error instanceof GenericWorkspaceValidationError) {
      throw new GenericWorkspaceValidationError(filePath, error.issues);
    }

    throw error;
  }

  const adapterResult = toGenericWorkspaceAdapterResult(validated, format);

  return {
    filePath,
    format,
    adapterResult,
    workspace: buildGovernanceWorkspace(adapterResult),
  };
}

export function loadGenericWorkspaceAdapterResult(
  workspaceFilePath: string,
): GovernanceWorkspaceAdapterResult {
  return loadGenericWorkspace(workspaceFilePath).adapterResult;
}

export function validateGenericWorkspaceSchema(
  value: unknown,
): GenericWorkspaceSchema {
  const issues: GenericWorkspaceValidationIssue[] = [];
  const root = asRecord(value);

  if (!root) {
    throwValidationIssues('<memory>', [
      {
        code: 'governance.workspace_schema.invalid_root',
        message: 'Workspace document root must be an object.',
        path: '/',
      },
    ]);
  }

  validateUnknownFields(root, TOP_LEVEL_FIELDS, '/', issues);
  validateUnsupportedLegacyFields(root, issues);

  const schemaVersion = validateSchemaVersion(root.schemaVersion, issues);
  const workspace = validateWorkspace(root.workspace, issues);
  const nodes = validateNodes(root.nodes, issues);
  const relations = validateRelations(root.relations, issues);

  validateNodeCrossReferences(nodes, issues);
  validateRelationCrossReferences(nodes, relations, issues);

  if (issues.length > 0 || !workspace || !schemaVersion) {
    throwValidationIssues('<memory>', issues);
  }

  return {
    schemaVersion,
    workspace,
    nodes: nodes.map(stripValidatedNodeIndex),
    relations: relations.map(stripValidatedRelationIndex),
  };
}

export function loadAndValidateGenericWorkspaceSchema(
  workspaceFilePath: string,
): GenericWorkspaceSchema {
  const filePath = path.resolve(workspaceFilePath);
  const format = detectWorkspaceFormat(filePath);
  const source = readWorkspaceFile(filePath);
  const parsed = parseWorkspaceSource(source, filePath, format);

  try {
    return validateGenericWorkspaceSchema(parsed);
  } catch (error) {
    if (error instanceof GenericWorkspaceValidationError) {
      throw new GenericWorkspaceValidationError(filePath, error.issues);
    }

    throw error;
  }
}

function readWorkspaceFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    throw new GenericWorkspaceLoadError(
      `Failed to read workspace file "${filePath}".`,
      'governance.workspace_loader.read_failed',
      filePath,
    );
  }
}

function detectWorkspaceFormat(filePath: string): GenericWorkspaceFormat {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.json') {
    return 'json';
  }

  if (extension === '.yaml' || extension === '.yml') {
    return 'yaml';
  }

  throw new GenericWorkspaceLoadError(
    `Unsupported workspace file extension for "${filePath}". Expected .json, .yaml, or .yml.`,
    'governance.workspace_loader.unsupported_extension',
    filePath,
  );
}

function parseWorkspaceSource(
  source: string,
  filePath: string,
  format: GenericWorkspaceFormat,
): unknown {
  try {
    if (format === 'json') {
      return JSON.parse(source) as unknown;
    }

    const document = parseDocument(source, {
      merge: false,
      strict: true,
      uniqueKeys: false,
    });

    if (document.errors.length > 0) {
      throw new Error(document.errors[0]?.message ?? 'Invalid YAML.');
    }

    return document.toJS();
  } catch {
    throw new GenericWorkspaceLoadError(
      `Failed to parse ${format.toUpperCase()} workspace file "${filePath}".`,
      'governance.workspace_loader.parse_error',
      filePath,
    );
  }
}

function validateSchemaVersion(
  value: unknown,
  issues: GenericWorkspaceValidationIssue[],
): 1 | undefined {
  if (value === undefined) {
    issues.push(
      missingRequiredField('/schemaVersion', 'schemaVersion is required.'),
    );
    return undefined;
  }

  if (!Number.isInteger(value)) {
    issues.push(
      invalidFieldType('/schemaVersion', 'schemaVersion must be an integer.'),
    );
    return undefined;
  }

  if (value !== 1) {
    issues.push({
      code: 'governance.workspace_schema.unsupported_schema_version',
      message: 'schemaVersion must equal 1.',
      path: '/schemaVersion',
    });
    return undefined;
  }

  return 1;
}

function validateWorkspace(
  value: unknown,
  issues: GenericWorkspaceValidationIssue[],
): GenericWorkspaceSchema['workspace'] | undefined {
  const pointer = '/workspace';
  if (value === undefined) {
    issues.push(missingRequiredField(pointer, 'workspace is required.'));
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    issues.push(invalidFieldType(pointer, 'workspace must be an object.'));
    return undefined;
  }

  validateUnknownFields(record, WORKSPACE_FIELDS, pointer, issues);

  const id = optionalNonEmptyString(record.id, `${pointer}/id`, issues, 'id');
  const name = requiredNonEmptyString(
    record.name,
    `${pointer}/name`,
    issues,
    'name',
  );
  const rootValue = record.root ?? '.';
  const root = optionalString(rootValue, `${pointer}/root`, issues, 'root');
  const capabilities = validateObjectArray(
    record.capabilities,
    `${pointer}/capabilities`,
    issues,
    'capabilities',
  ) as GovernanceCapability[] | undefined;
  const diagnostics = validateObjectArray(
    record.diagnostics,
    `${pointer}/diagnostics`,
    issues,
    'diagnostics',
  ) as GovernanceDiagnostic[] | undefined;
  const metadata = validateLooseRecord(
    record.metadata,
    `${pointer}/metadata`,
    issues,
    'metadata',
  );

  if (root !== undefined && !isNormalizedWorkspacePath(root)) {
    issues.push(
      invalidPath(
        `${pointer}/root`,
        'workspace.root must be a normalized relative path.',
      ),
    );
  }

  if (name === undefined || root === undefined) {
    return undefined;
  }

  return {
    ...(id ? { id } : {}),
    name,
    root,
    ...(capabilities ? { capabilities } : {}),
    ...(diagnostics ? { diagnostics } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function validateNodes(
  value: unknown,
  issues: GenericWorkspaceValidationIssue[],
): ValidatedNodeInput[] {
  const pointer = '/nodes';
  if (value === undefined) {
    issues.push(missingRequiredField(pointer, 'nodes is required.'));
    return [];
  }

  if (!Array.isArray(value)) {
    issues.push(invalidFieldType(pointer, 'nodes must be an array.'));
    return [];
  }

  const nodes: ValidatedNodeInput[] = [];

  value.forEach((entry, index) => {
    const nodePointer = `${pointer}/${index}`;
    const record = asRecord(entry);

    if (!record) {
      issues.push(
        invalidFieldType(nodePointer, 'Each node must be an object.'),
      );
      return;
    }

    validateUnknownFields(record, NODE_FIELDS, nodePointer, issues);

    const id = requiredNonEmptyString(
      record.id,
      `${nodePointer}/id`,
      issues,
      'id',
    );
    const name = optionalString(
      record.name,
      `${nodePointer}/name`,
      issues,
      'name',
    );
    const kind = optionalString(
      record.kind,
      `${nodePointer}/kind`,
      issues,
      'kind',
    );
    const technology = optionalString(
      record.technology,
      `${nodePointer}/technology`,
      issues,
      'technology',
    );
    const sourceSystem = optionalString(
      record.sourceSystem,
      `${nodePointer}/sourceSystem`,
      issues,
      'sourceSystem',
    );
    const rootValue = optionalString(
      record.root,
      `${nodePointer}/root`,
      issues,
      'root',
    );
    const pathValue = optionalString(
      record.path,
      `${nodePointer}/path`,
      issues,
      'path',
    );
    const tags = validateTags(record.tags, `${nodePointer}/tags`, issues);
    const classification = validateLooseRecord(
      record.classification,
      `${nodePointer}/classification`,
      issues,
      'classification',
    ) as GovernanceNodeInput['classification'];
    const ownership = validateLooseRecord(
      record.ownership,
      `${nodePointer}/ownership`,
      issues,
      'ownership',
    ) as GovernanceNodeInput['ownership'];
    const perspective = validateLooseRecord(
      record.perspective,
      `${nodePointer}/perspective`,
      issues,
      'perspective',
    ) as GovernanceNodeInput['perspective'];
    const source = validateLooseRecord(
      record.source,
      `${nodePointer}/source`,
      issues,
      'source',
    ) as GovernanceNodeInput['source'];
    const evidence = validateObjectArray(
      record.evidence,
      `${nodePointer}/evidence`,
      issues,
      'evidence',
    ) as GovernanceNodeInput['evidence'];
    const authority = optionalString(
      record.authority,
      `${nodePointer}/authority`,
      issues,
      'authority',
    ) as GovernanceNodeInput['authority'];
    const confidence = validateNumber(
      record.confidence,
      `${nodePointer}/confidence`,
      issues,
      'confidence',
    ) as GovernanceNodeInput['confidence'];
    const metadata =
      validateLooseRecord(
        record.metadata,
        `${nodePointer}/metadata`,
        issues,
        'metadata',
      ) ?? {};

    if (rootValue !== undefined && !isNormalizedWorkspacePath(rootValue)) {
      issues.push(
        invalidPath(
          `${nodePointer}/root`,
          'Node root must be a normalized relative path.',
        ),
      );
    }

    if (pathValue !== undefined && !isNormalizedWorkspacePath(pathValue)) {
      issues.push(
        invalidPath(
          `${nodePointer}/path`,
          'Node path must be a normalized relative path.',
        ),
      );
    }

    if (id === undefined || tags === undefined) {
      return;
    }

    nodes.push({
      index,
      id,
      ...(name !== undefined ? { name } : {}),
      ...(kind !== undefined ? { kind } : {}),
      ...(technology !== undefined ? { technology } : {}),
      ...(sourceSystem !== undefined ? { sourceSystem } : {}),
      ...(rootValue !== undefined ? { root: rootValue } : {}),
      ...(pathValue !== undefined ? { path: pathValue } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      ...(classification ? { classification } : {}),
      ...(ownership ? { ownership } : {}),
      ...(perspective ? { perspective } : {}),
      ...(source ? { source } : {}),
      ...(evidence ? { evidence } : {}),
      ...(authority !== undefined ? { authority } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      metadata,
    });
  });

  return nodes;
}

function validateRelations(
  value: unknown,
  issues: GenericWorkspaceValidationIssue[],
): ValidatedRelationInput[] {
  const pointer = '/relations';
  if (value === undefined) {
    issues.push(missingRequiredField(pointer, 'relations is required.'));
    return [];
  }

  if (!Array.isArray(value)) {
    issues.push(invalidFieldType(pointer, 'relations must be an array.'));
    return [];
  }

  const relations: ValidatedRelationInput[] = [];

  value.forEach((entry, index) => {
    const relationPointer = `${pointer}/${index}`;
    const record = asRecord(entry);

    if (!record) {
      issues.push(
        invalidFieldType(relationPointer, 'Each relation must be an object.'),
      );
      return;
    }

    validateUnknownFields(record, RELATION_FIELDS, relationPointer, issues);

    const id = optionalString(record.id, `${relationPointer}/id`, issues, 'id');
    const sourceNodeId = requiredNonEmptyString(
      record.sourceNodeId,
      `${relationPointer}/sourceNodeId`,
      issues,
      'sourceNodeId',
    );
    const targetNodeId = requiredNonEmptyString(
      record.targetNodeId,
      `${relationPointer}/targetNodeId`,
      issues,
      'targetNodeId',
    );
    const kind = optionalString(
      record.kind,
      `${relationPointer}/kind`,
      issues,
      'kind',
    );
    const perspective = validateLooseRecord(
      record.perspective,
      `${relationPointer}/perspective`,
      issues,
      'perspective',
    ) as GovernanceRelationInput['perspective'];
    const source = validateLooseRecord(
      record.source,
      `${relationPointer}/source`,
      issues,
      'source',
    ) as GovernanceRelationInput['source'];
    const evidence = validateObjectArray(
      record.evidence,
      `${relationPointer}/evidence`,
      issues,
      'evidence',
    ) as GovernanceRelationInput['evidence'];
    const authority = optionalString(
      record.authority,
      `${relationPointer}/authority`,
      issues,
      'authority',
    ) as GovernanceRelationInput['authority'];
    const confidence = validateNumber(
      record.confidence,
      `${relationPointer}/confidence`,
      issues,
      'confidence',
    ) as GovernanceRelationInput['confidence'];
    const metadata =
      validateLooseRecord(
        record.metadata,
        `${relationPointer}/metadata`,
        issues,
        'metadata',
      ) ?? {};

    if (
      sourceNodeId !== undefined &&
      targetNodeId !== undefined &&
      sourceNodeId === targetNodeId
    ) {
      issues.push({
        code: 'governance.workspace_schema.self_relation',
        message: 'Relation sourceNodeId and targetNodeId must differ.',
        path: relationPointer,
      });
    }

    if (sourceNodeId === undefined || targetNodeId === undefined) {
      return;
    }

    relations.push({
      index,
      ...(id !== undefined ? { id } : {}),
      sourceNodeId,
      targetNodeId,
      ...(kind !== undefined ? { kind } : {}),
      ...(perspective ? { perspective } : {}),
      ...(source ? { source } : {}),
      ...(evidence ? { evidence } : {}),
      ...(authority !== undefined ? { authority } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      metadata,
    });
  });

  return relations;
}

function validateNodeCrossReferences(
  nodes: ValidatedNodeInput[],
  issues: GenericWorkspaceValidationIssue[],
): void {
  const nodeIds = new Set<string>();
  const roots = new Set<string>();

  for (const node of nodes) {
    const pointer = `/nodes/${node.index}`;
    if (nodeIds.has(node.id)) {
      issues.push({
        code: 'governance.workspace_schema.duplicate_node_id',
        message: `Duplicate node id "${node.id}" is not allowed.`,
        path: `${pointer}/id`,
      });
    } else {
      nodeIds.add(node.id);
    }

    if (!node.root) {
      continue;
    }

    if (roots.has(node.root)) {
      issues.push({
        code: 'governance.workspace_schema.duplicate_node_root',
        message: `Duplicate node root "${node.root}" is not allowed.`,
        path: `${pointer}/root`,
      });
    } else {
      roots.add(node.root);
    }
  }
}

function validateRelationCrossReferences(
  nodes: ValidatedNodeInput[],
  relations: ValidatedRelationInput[],
  issues: GenericWorkspaceValidationIssue[],
): void {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const seenRelationIds = new Set<string>();
  const seenImplicitKeys = new Set<string>();

  for (const relation of relations) {
    const pointer = `/relations/${relation.index}`;

    if (!nodeIds.has(relation.sourceNodeId)) {
      issues.push({
        code: 'governance.workspace_schema.unknown_relation_source',
        message: `Relation sourceNodeId "${relation.sourceNodeId}" does not match a declared node.`,
        path: `${pointer}/sourceNodeId`,
      });
    }

    if (!nodeIds.has(relation.targetNodeId)) {
      issues.push({
        code: 'governance.workspace_schema.unknown_relation_target',
        message: `Relation targetNodeId "${relation.targetNodeId}" does not match a declared node.`,
        path: `${pointer}/targetNodeId`,
      });
    }

    if (relation.id) {
      if (seenRelationIds.has(relation.id)) {
        issues.push({
          code: 'governance.workspace_schema.duplicate_relation_id',
          message: `Duplicate relation id "${relation.id}" is not allowed.`,
          path: `${pointer}/id`,
        });
      } else {
        seenRelationIds.add(relation.id);
      }
      continue;
    }

    const key = [
      relation.sourceNodeId,
      relation.targetNodeId,
      relation.kind ?? 'unknown',
      relation.index,
    ].join('\u0000');
    if (seenImplicitKeys.has(key)) {
      issues.push({
        code: 'governance.workspace_schema.duplicate_relation',
        message:
          'Duplicate relation sourceNodeId/targetNodeId/kind combination without explicit ids is not allowed at the same position.',
        path: pointer,
      });
    } else {
      seenImplicitKeys.add(key);
    }
  }
}

function validateTags(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
): string[] | undefined {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    issues.push(invalidFieldType(pointer, 'tags must be an array of strings.'));
    return undefined;
  }

  const tags: string[] = [];
  const seen = new Set<string>();

  value.forEach((entry, index) => {
    const tagPointer = `${pointer}/${index}`;
    if (typeof entry !== 'string') {
      issues.push(invalidFieldType(tagPointer, 'Each tag must be a string.'));
      return;
    }

    if (entry.length === 0 || entry.trim() !== entry) {
      issues.push(
        invalidValue(
          tagPointer,
          'Tags must be non-empty and may not contain leading or trailing whitespace.',
        ),
      );
      return;
    }

    if (seen.has(entry)) {
      issues.push(
        invalidValue(tagPointer, `Duplicate tag "${entry}" is not allowed.`),
      );
      return;
    }

    seen.add(entry);
    tags.push(entry);
  });

  return tags;
}

function validateUnsupportedLegacyFields(
  root: Record<string, unknown>,
  issues: GenericWorkspaceValidationIssue[],
): void {
  for (const [field, replacement] of LEGACY_TOP_LEVEL_FIELDS) {
    if (root[field] === undefined) {
      continue;
    }

    issues.push({
      code: 'governance.workspace_schema.unsupported_legacy_field',
      message: `Legacy field "${field}" is not supported. Use "${replacement}" instead.`,
      path: `/${field}`,
    });
  }
}

function validateUnknownFields(
  record: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
): void {
  Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .forEach((key) => {
      if (allowedFields.has(key) || LEGACY_TOP_LEVEL_FIELDS.has(key)) {
        return;
      }

      const fieldPath =
        pointer === '/'
          ? `/${escapeJsonPointerSegment(key)}`
          : `${pointer}/${escapeJsonPointerSegment(key)}`;

      issues.push({
        code: 'governance.workspace_schema.unknown_field',
        message: `Unknown field "${key}" is not allowed.`,
        path: fieldPath,
      });
    });
}

function validateLooseRecord(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
  fieldName: string,
): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    issues.push(invalidFieldType(pointer, `${fieldName} must be an object.`));
    return undefined;
  }

  return record;
}

function validateObjectArray(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
  fieldName: string,
): Record<string, unknown>[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    issues.push(
      invalidFieldType(pointer, `${fieldName} must be an array of objects.`),
    );
    return undefined;
  }

  const values: Record<string, unknown>[] = [];
  value.forEach((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      issues.push(
        invalidFieldType(
          `${pointer}/${index}`,
          `Each ${fieldName.slice(0, -1)} must be an object.`,
        ),
      );
      return;
    }
    values.push(record);
  });
  return values;
}

function validateNumber(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
  fieldName: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    issues.push(invalidFieldType(pointer, `${fieldName} must be a number.`));
    return undefined;
  }

  return value;
}

function requiredNonEmptyString(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
  fieldName: string,
): string | undefined {
  const result = requiredString(value, pointer, issues, fieldName);
  if (result === undefined) {
    return undefined;
  }

  if (result.trim().length === 0) {
    issues.push(invalidValue(pointer, `${fieldName} must be non-empty.`));
    return undefined;
  }

  return result;
}

function optionalNonEmptyString(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
  fieldName: string,
): string | undefined {
  const result = optionalString(value, pointer, issues, fieldName);
  if (result === undefined) {
    return undefined;
  }

  if (result.trim().length === 0) {
    issues.push(invalidValue(pointer, `${fieldName} must be non-empty.`));
    return undefined;
  }

  return result;
}

function requiredString(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
  fieldName: string,
): string | undefined {
  if (value === undefined) {
    issues.push(missingRequiredField(pointer, `${fieldName} is required.`));
    return undefined;
  }

  return optionalString(value, pointer, issues, fieldName);
}

function optionalString(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
  fieldName: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    issues.push(invalidFieldType(pointer, `${fieldName} must be a string.`));
    return undefined;
  }

  return value;
}

function toGenericWorkspaceAdapterResult(
  schema: GenericWorkspaceSchema,
  format: GenericWorkspaceFormat,
): GovernanceWorkspaceAdapterResult {
  const capabilities = [
    createManualWorkspaceCapability({
      format,
      schemaVersion: schema.schemaVersion,
    }),
    ...(schema.workspace.capabilities ?? []),
  ];

  return {
    workspaceId: schema.workspace.id ?? schema.workspace.name,
    workspaceName: schema.workspace.name,
    workspaceRoot: schema.workspace.root,
    nodes: sortNodes(schema.nodes),
    relations: sortRelations(schema.relations),
    capabilities,
    ...(schema.workspace.diagnostics
      ? { diagnostics: [...schema.workspace.diagnostics] }
      : {}),
    ...(schema.workspace.metadata
      ? { metadata: { ...schema.workspace.metadata } }
      : {}),
  };
}

function sortNodes(
  nodes: readonly GovernanceNodeInput[],
): GovernanceNodeInput[] {
  return [...nodes].sort((left, right) => left.id.localeCompare(right.id));
}

function sortRelations(
  relations: readonly GovernanceRelationInput[],
): GovernanceRelationInput[] {
  return [...relations].sort(
    (left, right) =>
      (left.id ?? '').localeCompare(right.id ?? '') ||
      left.sourceNodeId.localeCompare(right.sourceNodeId) ||
      left.targetNodeId.localeCompare(right.targetNodeId) ||
      (left.kind ?? '').localeCompare(right.kind ?? ''),
  );
}

function stripValidatedNodeIndex(
  node: ValidatedNodeInput,
): GovernanceNodeInput {
  const { index: _index, ...rest } = node;
  return rest;
}

function stripValidatedRelationIndex(
  relation: ValidatedRelationInput,
): GovernanceRelationInput {
  const { index: _index, ...rest } = relation;
  return rest;
}

function throwValidationIssues(
  filePath: string,
  issues: GenericWorkspaceValidationIssue[],
): never {
  throw new GenericWorkspaceValidationError(
    filePath,
    [...issues].sort((left, right) => left.path.localeCompare(right.path)),
  );
}

function missingRequiredField(
  pathValue: string,
  message: string,
): GenericWorkspaceValidationIssue {
  return {
    code: 'governance.workspace_schema.missing_required_field',
    message,
    path: pathValue,
  };
}

function invalidFieldType(
  pathValue: string,
  message: string,
): GenericWorkspaceValidationIssue {
  return {
    code: 'governance.workspace_schema.invalid_field_type',
    message,
    path: pathValue,
  };
}

function invalidValue(
  pathValue: string,
  message: string,
): GenericWorkspaceValidationIssue {
  return {
    code: 'governance.workspace_schema.invalid_value',
    message,
    path: pathValue,
  };
}

function invalidPath(
  pathValue: string,
  message: string,
): GenericWorkspaceValidationIssue {
  return {
    code: 'governance.workspace_schema.invalid_path',
    message,
    path: pathValue,
  };
}

function isNormalizedWorkspacePath(value: string): boolean {
  if (value === '.') {
    return true;
  }

  if (value.length === 0 || path.isAbsolute(value)) {
    return false;
  }

  return normalizePath(value) === value;
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}

function escapeJsonPointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
