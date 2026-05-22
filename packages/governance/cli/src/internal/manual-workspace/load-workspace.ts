import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parseDocument } from 'yaml';

import type {
  GovernanceDependencyInput,
  GovernanceDiagnostic,
  GovernanceProjectInput,
  GovernanceWorkspace,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';
import { buildInventory } from '../inventory/build-inventory.js';

import { createManualWorkspaceCapability } from './capability.js';

const TOP_LEVEL_FIELDS = new Set([
  'schemaVersion',
  'workspace',
  'projects',
  'dependencies',
]);
const WORKSPACE_FIELDS = new Set(['name', 'root']);
const PROJECT_FIELDS = new Set(['name', 'root', 'tags', 'type', 'metadata']);
const DEPENDENCY_FIELDS = new Set(['source', 'target', 'type']);

const PROJECT_TYPES = new Set(['application', 'library', 'tool', 'unknown']);
const DEPENDENCY_TYPES = new Set(['static', 'dynamic', 'implicit', 'unknown']);
const RESERVED_METADATA_FIELDS = new Set(['name', 'root', 'tags', 'type']);
const CLASSIFICATION_TAG_PREFIXES = ['domain', 'scope', 'layer'] as const;

type GenericWorkspaceFormat = 'json' | 'yaml';

interface GenericWorkspaceSchema {
  schemaVersion: 1;
  workspace: {
    name: string;
    root: string;
  };
  projects: GenericWorkspaceProject[];
  dependencies: GenericWorkspaceDependency[];
}

interface GenericWorkspaceProject {
  name: string;
  root: string;
  tags: string[];
  type: 'application' | 'library' | 'tool' | 'unknown';
  metadata: Record<string, unknown>;
}

interface GenericWorkspaceDependency {
  source: string;
  target: string;
  type: 'static' | 'dynamic' | 'implicit' | 'unknown';
}

interface ValidatedGenericWorkspaceProject extends GenericWorkspaceProject {
  index: number;
}

interface ValidatedGenericWorkspaceDependency
  extends GenericWorkspaceDependency {
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
    workspace: buildInventory(adapterResult),
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

  const schemaVersionValue = root.schemaVersion;
  let schemaVersion: 1 | undefined;

  if (schemaVersionValue === undefined) {
    issues.push(
      missingRequiredField('/schemaVersion', 'schemaVersion is required.'),
    );
  } else if (!Number.isInteger(schemaVersionValue)) {
    issues.push(
      invalidFieldType('/schemaVersion', 'schemaVersion must be an integer.'),
    );
  } else if (schemaVersionValue !== 1) {
    issues.push({
      code: 'governance.workspace_schema.unsupported_schema_version',
      message: 'schemaVersion must equal 1.',
      path: '/schemaVersion',
    });
  } else {
    schemaVersion = 1;
  }

  const workspace = validateWorkspace(root.workspace, issues);
  const projects = validateProjects(root.projects, issues);
  const dependencies = validateDependencies(root.dependencies, issues);

  validateProjectCrossReferences(projects, issues);
  validateDependencyReferences(projects, dependencies, issues);

  if (issues.length > 0 || !workspace || !schemaVersion) {
    throwValidationIssues('<memory>', issues);
  }

  return {
    schemaVersion,
    workspace,
    projects: projects.map(stripValidatedProjectIndex),
    dependencies: dependencies.map(stripValidatedDependencyIndex),
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

  const name = requiredString(record.name, `${pointer}/name`, issues, 'name');
  const rootValue = record.root ?? '.';
  const root = optionalString(rootValue, `${pointer}/root`, issues, 'root');

  if (name === undefined || root === undefined) {
    return undefined;
  }

  if (name.trim().length === 0) {
    issues.push(
      invalidValue(`${pointer}/name`, 'workspace.name must be non-empty.'),
    );
  }

  if (!isNormalizedWorkspacePath(root)) {
    issues.push(
      invalidPath(
        `${pointer}/root`,
        'workspace.root must be a normalized relative path.',
      ),
    );
  }

  return {
    name,
    root,
  };
}

function validateProjects(
  value: unknown,
  issues: GenericWorkspaceValidationIssue[],
): ValidatedGenericWorkspaceProject[] {
  const pointer = '/projects';
  if (value === undefined) {
    issues.push(missingRequiredField(pointer, 'projects is required.'));
    return [];
  }

  if (!Array.isArray(value)) {
    issues.push(invalidFieldType(pointer, 'projects must be an array.'));
    return [];
  }

  if (value.length === 0) {
    issues.push(
      invalidValue(pointer, 'projects must contain at least one project.'),
    );
  }

  const projects: ValidatedGenericWorkspaceProject[] = [];

  value.forEach((entry, index) => {
    const projectPointer = `${pointer}/${index}`;
    const record = asRecord(entry);

    if (!record) {
      issues.push(
        invalidFieldType(projectPointer, 'Each project must be an object.'),
      );
      return;
    }

    validateUnknownFields(record, PROJECT_FIELDS, projectPointer, issues);

    const name = requiredString(
      record.name,
      `${projectPointer}/name`,
      issues,
      'name',
    );
    const root = requiredString(
      record.root,
      `${projectPointer}/root`,
      issues,
      'root',
    );

    if (root !== undefined && !isNormalizedWorkspacePath(root)) {
      issues.push(
        invalidPath(
          `${projectPointer}/root`,
          'Project root must be a normalized relative path.',
        ),
      );
    }

    const tags = validateTags(record.tags, `${projectPointer}/tags`, issues);
    const type = validateProjectType(
      record.type,
      `${projectPointer}/type`,
      issues,
    );
    const metadata = validateProjectMetadata(
      record.metadata,
      `${projectPointer}/metadata`,
      issues,
    );

    if (name !== undefined && name.trim().length === 0) {
      issues.push(
        invalidValue(
          `${projectPointer}/name`,
          'Project name must be non-empty.',
        ),
      );
    }

    if (
      name === undefined ||
      root === undefined ||
      tags === undefined ||
      type === undefined ||
      metadata === undefined
    ) {
      return;
    }

    projects.push({
      index,
      name,
      root,
      tags,
      type,
      metadata,
    });
  });

  return projects;
}

function validateDependencies(
  value: unknown,
  issues: GenericWorkspaceValidationIssue[],
): ValidatedGenericWorkspaceDependency[] {
  const pointer = '/dependencies';
  if (value === undefined) {
    issues.push(missingRequiredField(pointer, 'dependencies is required.'));
    return [];
  }

  if (!Array.isArray(value)) {
    issues.push(invalidFieldType(pointer, 'dependencies must be an array.'));
    return [];
  }

  const dependencies: ValidatedGenericWorkspaceDependency[] = [];

  value.forEach((entry, index) => {
    const dependencyPointer = `${pointer}/${index}`;
    const record = asRecord(entry);

    if (!record) {
      issues.push(
        invalidFieldType(
          dependencyPointer,
          'Each dependency must be an object.',
        ),
      );
      return;
    }

    validateUnknownFields(record, DEPENDENCY_FIELDS, dependencyPointer, issues);

    const source = requiredString(
      record.source,
      `${dependencyPointer}/source`,
      issues,
      'source',
    );
    const target = requiredString(
      record.target,
      `${dependencyPointer}/target`,
      issues,
      'target',
    );
    const type = validateDependencyType(
      record.type,
      `${dependencyPointer}/type`,
      issues,
    );

    if (source !== undefined && target !== undefined && source === target) {
      issues.push({
        code: 'governance.workspace_schema.self_dependency',
        message: 'Dependency source and target must differ.',
        path: dependencyPointer,
      });
    }

    if (source === undefined || target === undefined || type === undefined) {
      return;
    }

    dependencies.push({
      index,
      source,
      target,
      type,
    });
  });

  return dependencies;
}

function validateProjectCrossReferences(
  projects: ValidatedGenericWorkspaceProject[],
  issues: GenericWorkspaceValidationIssue[],
): void {
  const names = new Set<string>();
  const roots = new Set<string>();

  projects.forEach((project) => {
    const projectPointer = `/projects/${project.index}`;

    if (names.has(project.name)) {
      issues.push({
        code: 'governance.workspace_schema.duplicate_project_name',
        message: `Duplicate project name "${project.name}" is not allowed.`,
        path: `${projectPointer}/name`,
      });
    } else {
      names.add(project.name);
    }

    if (roots.has(project.root)) {
      issues.push({
        code: 'governance.workspace_schema.duplicate_project_root',
        message: `Duplicate project root "${project.root}" is not allowed.`,
        path: `${projectPointer}/root`,
      });
    } else {
      roots.add(project.root);
    }
  });
}

function validateDependencyReferences(
  projects: ValidatedGenericWorkspaceProject[],
  dependencies: ValidatedGenericWorkspaceDependency[],
  issues: GenericWorkspaceValidationIssue[],
): void {
  const projectNames = new Set(projects.map((project) => project.name));
  const seenDependencies = new Set<string>();

  dependencies.forEach((dependency) => {
    const dependencyPointer = `/dependencies/${dependency.index}`;

    if (!projectNames.has(dependency.source)) {
      issues.push({
        code: 'governance.workspace_schema.unknown_dependency_source',
        message: `Dependency source "${dependency.source}" does not match a declared project.`,
        path: `${dependencyPointer}/source`,
      });
    }

    if (!projectNames.has(dependency.target)) {
      issues.push({
        code: 'governance.workspace_schema.unknown_dependency_target',
        message: `Dependency target "${dependency.target}" does not match a declared project.`,
        path: `${dependencyPointer}/target`,
      });
    }

    const key = `${dependency.source}\u0000${dependency.target}\u0000${dependency.type}`;
    if (seenDependencies.has(key)) {
      issues.push({
        code: 'governance.workspace_schema.duplicate_dependency',
        message: `Duplicate dependency "${dependency.source}" -> "${dependency.target}" of type "${dependency.type}" is not allowed.`,
        path: dependencyPointer,
      });
    } else {
      seenDependencies.add(key);
    }
  });
}

function validateTags(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
): string[] | undefined {
  if (value === undefined) {
    issues.push(missingRequiredField(pointer, 'tags is required.'));
    return undefined;
  }

  if (!Array.isArray(value)) {
    issues.push(invalidFieldType(pointer, 'tags must be an array of strings.'));
    return undefined;
  }

  const tags: string[] = [];
  const seenTags = new Set<string>();
  const classificationTagSeen = new Map<string, string>();

  value.forEach((entry, index) => {
    const tagPointer = `${pointer}/${index}`;
    if (typeof entry !== 'string') {
      issues.push(invalidFieldType(tagPointer, 'Each tag must be a string.'));
      return;
    }

    if (entry.length === 0 || entry.trim() !== entry) {
      issues.push(
        invalidTag(
          tagPointer,
          'Tags must be non-empty and may not contain leading or trailing whitespace.',
        ),
      );
      return;
    }

    if (seenTags.has(entry)) {
      issues.push(
        invalidTag(tagPointer, `Duplicate tag "${entry}" is not allowed.`),
      );
      return;
    }

    const classificationPrefix = classificationTagPrefix(entry);
    if (classificationPrefix) {
      const existing = classificationTagSeen.get(classificationPrefix);
      if (existing) {
        issues.push(
          invalidTag(
            tagPointer,
            `Multiple "${classificationPrefix}:" tags are not allowed on the same project.`,
          ),
        );
        return;
      }

      classificationTagSeen.set(classificationPrefix, entry);
    }

    seenTags.add(entry);
    tags.push(entry);
  });

  return tags;
}

function validateProjectType(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
): GenericWorkspaceProject['type'] | undefined {
  if (value === undefined) {
    return 'unknown';
  }

  if (typeof value !== 'string') {
    issues.push(invalidFieldType(pointer, 'Project type must be a string.'));
    return undefined;
  }

  if (!PROJECT_TYPES.has(value)) {
    issues.push(
      invalidEnumValue(
        pointer,
        'Project type must be one of application, library, tool, or unknown.',
      ),
    );
    return undefined;
  }

  return value as GenericWorkspaceProject['type'];
}

function validateDependencyType(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
): GenericWorkspaceDependency['type'] | undefined {
  if (typeof value !== 'string') {
    if (value === undefined) {
      issues.push(
        missingRequiredField(pointer, 'Dependency type is required.'),
      );
    } else {
      issues.push(
        invalidFieldType(pointer, 'Dependency type must be a string.'),
      );
    }

    return undefined;
  }

  if (!DEPENDENCY_TYPES.has(value)) {
    issues.push(
      invalidEnumValue(
        pointer,
        'Dependency type must be one of static, dynamic, implicit, or unknown.',
      ),
    );
    return undefined;
  }

  return value as GenericWorkspaceDependency['type'];
}

function validateProjectMetadata(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
): Record<string, unknown> | undefined {
  if (value === undefined) {
    return {};
  }

  const record = asRecord(value);
  if (!record) {
    issues.push(invalidFieldType(pointer, 'metadata must be an object.'));
    return undefined;
  }

  Object.keys(record).forEach((key) => {
    if (RESERVED_METADATA_FIELDS.has(key)) {
      issues.push(
        invalidValue(
          `${pointer}/${escapeJsonPointerSegment(key)}`,
          `metadata must not redefine first-class field "${key}".`,
        ),
      );
    }
  });

  return record;
}

function toGenericWorkspaceAdapterResult(
  schema: GenericWorkspaceSchema,
  format: GenericWorkspaceFormat,
): GovernanceWorkspaceAdapterResult {
  const projects: GovernanceProjectInput[] = [...schema.projects]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((project) => ({
      id: project.name,
      name: project.name,
      root: project.root,
      type: project.type,
      tags: [...project.tags].sort((left, right) => left.localeCompare(right)),
      metadata: { ...project.metadata },
    }));

  const dependencies: GovernanceDependencyInput[] = [...schema.dependencies]
    .sort(compareDependencies)
    .map((dependency) => ({
      sourceProjectId: dependency.source,
      targetProjectId: dependency.target,
      type: dependency.type,
    }));

  return {
    workspaceId: schema.workspace.name,
    workspaceName: schema.workspace.name,
    workspaceRoot: schema.workspace.root,
    projects,
    dependencies,
    capabilities: [
      createManualWorkspaceCapability({
        format,
        schemaVersion: schema.schemaVersion,
      }),
    ],
  };
}

function compareDependencies(
  left: GenericWorkspaceDependency,
  right: GenericWorkspaceDependency,
): number {
  return (
    left.source.localeCompare(right.source) ||
    left.target.localeCompare(right.target) ||
    left.type.localeCompare(right.type)
  );
}

function validateUnknownFields(
  record: Record<string, unknown>,
  allowedFields: Set<string>,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
): void {
  Object.keys(record).forEach((key) => {
    if (!allowedFields.has(key)) {
      issues.push({
        code: 'governance.workspace_schema.unknown_field',
        message: `Unknown field "${key}" is not allowed.`,
        path:
          pointer === '/'
            ? `/${escapeJsonPointerSegment(key)}`
            : `${pointer}/${escapeJsonPointerSegment(key)}`,
      });
    }
  });
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

  if (typeof value !== 'string') {
    issues.push(invalidFieldType(pointer, `${fieldName} must be a string.`));
    return undefined;
  }

  return value;
}

function optionalString(
  value: unknown,
  pointer: string,
  issues: GenericWorkspaceValidationIssue[],
  fieldName: string,
): string | undefined {
  if (typeof value !== 'string') {
    issues.push(invalidFieldType(pointer, `${fieldName} must be a string.`));
    return undefined;
  }

  return value;
}

function missingRequiredField(
  pointer: string,
  message: string,
): GenericWorkspaceValidationIssue {
  return {
    code: 'governance.workspace_schema.missing_required_field',
    message,
    path: pointer,
  };
}

function invalidFieldType(
  pointer: string,
  message: string,
): GenericWorkspaceValidationIssue {
  return {
    code: 'governance.workspace_schema.invalid_field_type',
    message,
    path: pointer,
  };
}

function invalidValue(
  pointer: string,
  message: string,
): GenericWorkspaceValidationIssue {
  return {
    code: 'governance.workspace_schema.invalid_value',
    message,
    path: pointer,
  };
}

function invalidPath(
  pointer: string,
  message: string,
): GenericWorkspaceValidationIssue {
  return {
    code: 'governance.workspace_schema.invalid_path',
    message,
    path: pointer,
  };
}

function invalidEnumValue(
  pointer: string,
  message: string,
): GenericWorkspaceValidationIssue {
  return {
    code: 'governance.workspace_schema.invalid_enum_value',
    message,
    path: pointer,
  };
}

function invalidTag(
  pointer: string,
  message: string,
): GenericWorkspaceValidationIssue {
  return {
    code: 'governance.workspace_schema.invalid_tag',
    message,
    path: pointer,
  };
}

function throwValidationIssues(
  filePath: string,
  issues: GenericWorkspaceValidationIssue[],
): never {
  throw new GenericWorkspaceValidationError(filePath, issues);
}

function classificationTagPrefix(
  tag: string,
): (typeof CLASSIFICATION_TAG_PREFIXES)[number] | undefined {
  return CLASSIFICATION_TAG_PREFIXES.find((prefix) =>
    tag.startsWith(`${prefix}:`),
  );
}

function stripValidatedProjectIndex(
  project: ValidatedGenericWorkspaceProject,
): GenericWorkspaceProject {
  return {
    name: project.name,
    root: project.root,
    tags: project.tags,
    type: project.type,
    metadata: project.metadata,
  };
}

function stripValidatedDependencyIndex(
  dependency: ValidatedGenericWorkspaceDependency,
): GenericWorkspaceDependency {
  return {
    source: dependency.source,
    target: dependency.target,
    type: dependency.type,
  };
}

function isNormalizedWorkspacePath(value: string): boolean {
  if (value.length === 0 || value.includes('\\')) {
    return false;
  }

  if (value.startsWith('/') || value.startsWith('./') || value.endsWith('/')) {
    return false;
  }

  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return false;
  }

  const segments = value.split('/');
  if (segments.some((segment) => segment === '..' || segment.length === 0)) {
    return false;
  }

  return path.posix.normalize(value) === value;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function escapeJsonPointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
