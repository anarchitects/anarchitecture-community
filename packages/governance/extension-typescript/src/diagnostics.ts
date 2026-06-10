import type {
  GovernanceDiagnostic,
  GovernanceDiagnosticCategory,
  GovernanceDiagnosticKind,
  GovernanceDiagnosticSeverity,
} from '@anarchitects/governance-core';

import type {
  TypeScriptGovernanceDiagnosticProvider,
  TypeScriptGovernanceDiagnosticProviderInput,
} from './contracts.js';
import {
  getImportRelations,
  getPathMappingRelations,
  getTsconfigNodes,
  getTypeScriptProjectNodes,
  readRecordMetadata,
  readStringMetadata,
  toNodeReference,
  toRelationReference,
} from './graph.js';

export const TYPESCRIPT_GOVERNANCE_DIAGNOSTIC_SOURCE =
  'governance.typescript_extension';

export const TYPESCRIPT_GOVERNANCE_DIAGNOSTIC_CODES = [
  'TYPESCRIPT_PROJECT_PACKAGE_METADATA_MISSING',
  'TYPESCRIPT_IMPORT_METADATA_INCOMPLETE',
  'TYPESCRIPT_PATH_MAPPING_UNRESOLVED',
] as const;

export type TypeScriptGovernanceDiagnosticCode =
  (typeof TYPESCRIPT_GOVERNANCE_DIAGNOSTIC_CODES)[number];

export interface TypeScriptGovernanceDiagnosticDetails
  extends Record<string, unknown> {
  nodeId?: string;
  relationId?: string;
  alias?: string;
  tsconfigPath?: string;
  missingFields?: string[];
  declaredTargets?: string[];
}

export interface TypeScriptGovernanceExtensionDiagnostic
  extends GovernanceDiagnostic {
  code: TypeScriptGovernanceDiagnosticCode;
  details?: TypeScriptGovernanceDiagnosticDetails;
}

export type TypeScriptGovernanceDiagnosticsProviderOptions = object

interface CreateDiagnosticOptions {
  code: TypeScriptGovernanceDiagnosticCode;
  message: string;
  recommendation: string;
  severity?: GovernanceDiagnosticSeverity;
  kind?: GovernanceDiagnosticKind;
  category?: GovernanceDiagnosticCategory;
  reference?: GovernanceDiagnostic['reference'];
  details?: TypeScriptGovernanceDiagnosticDetails;
}

const DEFAULT_PROVIDER_ID = 'typescript-governance-diagnostics';

export const typescriptGovernanceDiagnosticsProvider =
  createTypeScriptGovernanceDiagnosticsProvider();

export function createTypeScriptGovernanceDiagnosticsProvider(): TypeScriptGovernanceDiagnosticProvider {
  return {
    id: DEFAULT_PROVIDER_ID,
    provideDiagnostics: (input) => buildTypeScriptGovernanceDiagnostics(input),
  };
}

export function buildTypeScriptGovernanceDiagnostics(
  input: TypeScriptGovernanceDiagnosticProviderInput,
): TypeScriptGovernanceExtensionDiagnostic[] {
  const diagnostics: TypeScriptGovernanceExtensionDiagnostic[] = [];

  for (const node of getTypeScriptProjectNodes(input.workspace)) {
    const packageJson = readRecordMetadata(node.metadata, [
      'packageManager',
      'packageJson',
    ]);

    if (packageJson) {
      continue;
    }

    diagnostics.push(
      createDiagnostic({
        code: 'TYPESCRIPT_PROJECT_PACKAGE_METADATA_MISSING',
        message: `TypeScript node "${node.id}" is missing package-manager package metadata.`,
        recommendation:
          'Attach metadata.packageManager.packageJson when emitting workspace project nodes.',
        severity: 'warning',
        kind: 'observation',
        category: 'configuration',
        reference: toNodeReference(node),
        details: {
          nodeId: node.id,
        },
      }),
    );
  }

  for (const relation of getImportRelations(input.workspace)) {
    const importMetadata = readRecordMetadata(relation.metadata, [
      'typescript',
      'import',
    ]);
    const missingFields: string[] = [];

    if (!readStringMetadata(importMetadata, ['sourceFile'])) {
      missingFields.push('sourceFile');
    }
    if (!readStringMetadata(importMetadata, ['specifier'])) {
      missingFields.push('specifier');
    }

    if (missingFields.length === 0) {
      continue;
    }

    diagnostics.push(
      createDiagnostic({
        code: 'TYPESCRIPT_IMPORT_METADATA_INCOMPLETE',
        message: `TypeScript relation "${relation.id}" is missing canonical import metadata: ${missingFields.join(', ')}.`,
        recommendation:
          'Populate metadata.typescript.import.sourceFile and metadata.typescript.import.specifier for import relations.',
        severity: 'warning',
        kind: 'observation',
        category: 'configuration',
        reference: toRelationReference(relation),
        details: {
          relationId: relation.id,
          missingFields,
        },
      }),
    );
  }

  const aliasesByTsconfigId = new Map<string, Set<string>>();
  for (const relation of getPathMappingRelations(input.workspace)) {
    const alias = readStringMetadata(relation.metadata, [
      'typescript',
      'pathMapping',
      'alias',
    ]);
    if (!alias) {
      continue;
    }

    const aliases = aliasesByTsconfigId.get(relation.sourceNodeId) ?? new Set();
    aliases.add(alias);
    aliasesByTsconfigId.set(relation.sourceNodeId, aliases);
  }

  for (const node of getTsconfigNodes(input.workspace)) {
    const aliases = readRecordMetadata(node.metadata, [
      'typescript',
      'tsconfig',
      'pathAliases',
    ]);
    if (!aliases) {
      continue;
    }

    const resolvedAliases =
      aliasesByTsconfigId.get(node.id) ?? new Set<string>();

    for (const alias of Object.keys(aliases).sort((left, right) =>
      left.localeCompare(right),
    )) {
      if (resolvedAliases.has(alias)) {
        continue;
      }

      const declaredTargets = Array.isArray(aliases[alias])
        ? aliases[alias].filter(
            (entry): entry is string =>
              typeof entry === 'string' && entry.length > 0,
          )
        : [];

      diagnostics.push(
        createDiagnostic({
          code: 'TYPESCRIPT_PATH_MAPPING_UNRESOLVED',
          message: `TypeScript path alias "${alias}" declared by "${node.id}" did not resolve to any canonical relation.`,
          recommendation:
            'Align tsconfig path aliases with emitted workspace project roots so canonical path-mapping relations can be created.',
          severity: 'warning',
          kind: 'observation',
          category: 'configuration',
          reference: toNodeReference(node),
          details: {
            nodeId: node.id,
            alias,
            tsconfigPath: node.path,
            declaredTargets,
          },
        }),
      );
    }
  }

  return diagnostics.sort(compareDiagnostics);
}

function createDiagnostic(
  options: CreateDiagnosticOptions,
): TypeScriptGovernanceExtensionDiagnostic {
  return {
    code: options.code,
    message: options.message,
    severity: options.severity ?? 'warning',
    kind: options.kind ?? 'observation',
    category: options.category ?? 'configuration',
    source: TYPESCRIPT_GOVERNANCE_DIAGNOSTIC_SOURCE,
    ...(options.reference ? { reference: options.reference } : {}),
    recommendation: options.recommendation,
    ...(options.details ? { details: options.details } : {}),
  };
}

function compareDiagnostics(
  left: TypeScriptGovernanceExtensionDiagnostic,
  right: TypeScriptGovernanceExtensionDiagnostic,
): number {
  const leftAlias =
    typeof left.details?.alias === 'string' ? left.details.alias : '';
  const rightAlias =
    typeof right.details?.alias === 'string' ? right.details.alias : '';

  return (
    left.code.localeCompare(right.code) ||
    (left.reference?.nodeId ?? '').localeCompare(
      right.reference?.nodeId ?? '',
    ) ||
    (left.reference?.relationId ?? '').localeCompare(
      right.reference?.relationId ?? '',
    ) ||
    leftAlias.localeCompare(rightAlias) ||
    left.message.localeCompare(right.message)
  );
}
