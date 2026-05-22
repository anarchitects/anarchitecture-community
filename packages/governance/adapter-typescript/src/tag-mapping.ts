import { invalidTagTemplateDiagnostic } from './diagnostics.js';
import { renderTagTemplate } from './project-naming.js';
import type { TypeScriptWorkspaceDetectionDiagnostic } from './types.js';

export interface DerivedProjectTags {
  tags: string[];
  domain?: string;
  layer?: string;
  scope?: string;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export function deriveProjectTags(
  templates: readonly string[] | undefined,
  wildcardSegments: readonly string[],
  path: string,
): DerivedProjectTags {
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const tags: string[] = [];
  const seenTags = new Set<string>();

  for (let index = 0; index < (templates?.length ?? 0); index += 1) {
    const template = templates?.[index];

    if (typeof template !== 'string') {
      diagnostics.push(
        invalidTagTemplateDiagnostic(
          `${path}/tags/${index}`,
          'Discovery tag template must be a string.',
        ),
      );
      continue;
    }

    const rendered = renderTagTemplate(
      template,
      wildcardSegments,
      `${path}/tags/${index}`,
    );
    diagnostics.push(...rendered.diagnostics);

    if (!rendered.value || seenTags.has(rendered.value)) {
      continue;
    }

    seenTags.add(rendered.value);
    tags.push(rendered.value);
  }

  return {
    tags,
    domain: readTagValue(tags, 'domain'),
    layer: readTagValue(tags, 'layer'),
    scope: readTagValue(tags, 'scope'),
    diagnostics,
  };
}

function readTagValue(
  tags: readonly string[],
  prefix: string,
): string | undefined {
  const tag = tags.find((entry) => entry.startsWith(`${prefix}:`));

  return tag?.slice(prefix.length + 1);
}
