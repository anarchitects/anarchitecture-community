import {
  invalidDiscoveryProjectionDiagnostic,
  invalidProjectNameTemplateDiagnostic,
  invalidTagTemplateDiagnostic,
} from './diagnostics.js';
import type { TypeScriptWorkspaceDetectionDiagnostic } from './types.js';

interface RenderTemplateOptions {
  template: string;
  wildcardSegments: readonly string[];
  path: string;
  kind: 'name' | 'projection' | 'tag';
}

interface RenderTemplateResult {
  value?: string;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

const SEGMENT_PLACEHOLDER = /\{segment:(?<segmentIndex>[1-9]\d*)\}/g;

export function renderProjectNameTemplate(
  template: string | undefined,
  wildcardSegments: readonly string[],
  fallbackName: string,
  path: string,
): RenderTemplateResult {
  if (!template) {
    return {
      value: fallbackName,
      diagnostics: [],
    };
  }

  return renderTemplate({
    template,
    wildcardSegments,
    path,
    kind: 'name',
  });
}

export function renderTagTemplate(
  template: string,
  wildcardSegments: readonly string[],
  path: string,
): RenderTemplateResult {
  return renderTemplate({
    template,
    wildcardSegments,
    path,
    kind: 'tag',
  });
}

export function renderProjectionTemplate(
  template: string,
  wildcardSegments: readonly string[],
  path: string,
): RenderTemplateResult {
  return renderTemplate({
    template,
    wildcardSegments,
    path,
    kind: 'projection',
  });
}

function renderTemplate({
  template,
  wildcardSegments,
  path,
  kind,
}: RenderTemplateOptions): RenderTemplateResult {
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const matches = [...template.matchAll(SEGMENT_PLACEHOLDER)];
  let rendered = template;

  if (template.includes('{segment:') && matches.length === 0) {
    diagnostics.push(
      invalidTemplateDiagnostic(
        kind,
        path,
        `Template "${template}" contains an invalid {segment:N} placeholder.`,
      ),
    );
    return { diagnostics };
  }

  for (const match of matches) {
    const segmentIndex = Number(match.groups?.segmentIndex ?? '');
    const segmentValue = wildcardSegments[segmentIndex - 1];

    if (!segmentValue) {
      diagnostics.push(
        invalidTemplateDiagnostic(
          kind,
          path,
          `Template "${template}" references missing segment ${segmentIndex}.`,
        ),
      );
      return { diagnostics };
    }

    rendered = rendered.replace(match[0], segmentValue);
  }

  const normalized = rendered.trim();
  if (normalized.length === 0) {
    diagnostics.push(
      invalidTemplateDiagnostic(
        kind,
        path,
        `Template "${template}" resolved to an empty string.`,
      ),
    );
    return { diagnostics };
  }

  return {
    value: normalized,
    diagnostics,
  };
}

function invalidTemplateDiagnostic(
  kind: 'name' | 'projection' | 'tag',
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  switch (kind) {
    case 'name':
      return invalidProjectNameTemplateDiagnostic(path, message);
    case 'projection':
      return invalidDiscoveryProjectionDiagnostic(path, message);
    case 'tag':
    default:
      return invalidTagTemplateDiagnostic(path, message);
  }
}
