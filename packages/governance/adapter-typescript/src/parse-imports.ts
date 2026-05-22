import * as ts from 'typescript';

import {
  nonLiteralDynamicImportDiagnostic,
  sourceFileParseErrorDiagnostic,
  unsupportedImportSyntaxDiagnostic,
} from './diagnostics.js';
import type {
  TypeScriptImportKind,
  TypeScriptWorkspaceDetectionDiagnostic,
} from './types.js';

export interface ParsedImportReference {
  specifier: string;
  kind: TypeScriptImportKind;
}

export interface ParsedImportReferencesResult {
  imports: ParsedImportReference[];
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export function parseImportReferences(
  sourceText: string,
  filePath: string,
): ParsedImportReferencesResult {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(filePath),
  );
  const imports: ParsedImportReference[] = [];
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const parseDiagnostics =
    (
      sourceFile as ts.SourceFile & {
        parseDiagnostics?: readonly ts.DiagnosticWithLocation[];
      }
    ).parseDiagnostics ?? [];

  diagnostics.push(
    ...parseDiagnostics.map((diagnostic: ts.DiagnosticWithLocation) =>
      sourceFileParseErrorDiagnostic(
        filePointer(filePath),
        `Failed to parse source file "${filePath}": ${ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n',
        )}`,
      ),
    ),
  );

  visitNode(sourceFile);

  return {
    imports: imports.sort((left, right) => {
      return (
        left.specifier.localeCompare(right.specifier) ||
        left.kind.localeCompare(right.kind)
      );
    }),
    diagnostics,
  };

  function visitNode(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push({
        specifier: node.moduleSpecifier.text,
        kind: 'static-import',
      });
      return;
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push({
        specifier: node.moduleSpecifier.text,
        kind: 're-export',
      });
      return;
    }

    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      diagnostics.push(
        unsupportedImportSyntaxDiagnostic(
          filePointer(filePath),
          `Import-equals syntax is not supported for deterministic analysis in "${filePath}".`,
        ),
      );
      return;
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const dynamicImport = parseDynamicImport(node, filePath);
      imports.push(...dynamicImport.imports);
      diagnostics.push(...dynamicImport.diagnostics);
      return;
    }

    ts.forEachChild(node, visitNode);
  }
}

function parseDynamicImport(
  expression: ts.CallExpression,
  filePath: string,
): ParsedImportReferencesResult {
  const [argument] = expression.arguments;

  if (argument && ts.isStringLiteralLike(argument)) {
    return {
      imports: [
        {
          specifier: argument.text,
          kind: 'dynamic-import',
        },
      ],
      diagnostics: [],
    };
  }

  return {
    imports: [],
    diagnostics: [nonLiteralDynamicImportDiagnostic(filePointer(filePath))],
  };
}

function scriptKindForFile(filePath: string): ts.ScriptKind {
  if (filePath.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }

  if (filePath.endsWith('.jsx')) {
    return ts.ScriptKind.JSX;
  }

  if (filePath.endsWith('.js')) {
    return ts.ScriptKind.JS;
  }

  return ts.ScriptKind.TS;
}

function filePointer(filePath: string): string {
  return `/${escapeJsonPointer(filePath)}`;
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
