import { invalidWorkspaceConfigDiagnostic } from './diagnostics.js';
import type { TypeScriptWorkspaceDetectionDiagnostic } from './types.js';

export interface NormalizedWorkspacePatterns {
  patterns: string[];
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export function normalizeWorkspacePatterns(
  patterns: readonly unknown[],
  pathPrefix: string,
): NormalizedWorkspacePatterns {
  const normalizedPatterns: string[] = [];
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const seenPatterns = new Set<string>();

  patterns.forEach((pattern, index) => {
    const path = `${pathPrefix}/${index}`;

    if (typeof pattern !== 'string') {
      diagnostics.push(
        invalidWorkspaceConfigDiagnostic(
          path,
          'Workspace pattern must be a non-empty string.',
        ),
      );
      return;
    }

    const normalizedPattern = normalizeWorkspacePattern(pattern);

    if (!normalizedPattern) {
      diagnostics.push(
        invalidWorkspaceConfigDiagnostic(
          path,
          'Workspace pattern must be a non-empty string.',
        ),
      );
      return;
    }

    if (seenPatterns.has(normalizedPattern)) {
      return;
    }

    seenPatterns.add(normalizedPattern);
    normalizedPatterns.push(normalizedPattern);
  });

  return {
    patterns: normalizedPatterns,
    diagnostics,
  };
}

function normalizeWorkspacePattern(pattern: string): string | undefined {
  let normalized = pattern.trim().replaceAll('\\', '/');

  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  normalized = normalized.replace(/\/{2,}/g, '/');

  while (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  if (normalized.length === 0) {
    return undefined;
  }

  return normalized;
}
