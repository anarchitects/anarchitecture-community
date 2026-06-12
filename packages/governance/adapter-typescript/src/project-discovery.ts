import path from 'node:path';

import { minimatch } from 'minimatch';

import {
  discoveryPatternNoMatchesDiagnostic,
  duplicateProjectNameDiagnostic,
  duplicateProjectRootDiagnostic,
  invalidDiscoveryProjectionDiagnostic,
  invalidDiscoveryPatternDiagnostic,
  invalidTagTemplateDiagnostic,
} from './diagnostics.js';
import { extractPackageGovernanceMetadata } from './extract-package-governance-metadata.js';
import {
  renderProjectNameTemplate,
  renderProjectionTemplate,
} from './project-naming.js';
import { deriveProjectTags } from './tag-mapping.js';
import type {
  TypeScriptProjectDiscoveryProjection,
  TypeScriptPackageGovernanceMetadataConfig,
  TypeScriptDiscoveredProject,
  TypeScriptProjectDiscoveryConfig,
  TypeScriptProjectDiscoveryResult,
  TypeScriptWorkspaceDetectionDiagnostic,
  WorkspacePackageResolution,
} from './types.js';

export function discoverTypeScriptProjects(
  workspace: WorkspacePackageResolution,
  config: TypeScriptProjectDiscoveryConfig,
  packageGovernanceMetadataConfig?: TypeScriptPackageGovernanceMetadataConfig,
): TypeScriptProjectDiscoveryResult {
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const projects: TypeScriptDiscoveredProject[] = [];
  const seenRoots = new Set<string>();
  const seenNames = new Set<string>();

  if (!Array.isArray(config.projects)) {
    return {
      workspaceRoot: workspace.workspaceRoot,
      projects: [],
      diagnostics: [
        invalidDiscoveryPatternDiagnostic(
          '/projects',
          'Discovery config must define a "projects" array.',
        ),
      ],
    };
  }

  config.projects.forEach((rule, ruleIndex) => {
    const rulePath = `/projects/${ruleIndex}`;
    const pattern = normalizeDiscoveryPattern(rule.pattern);

    if (!pattern) {
      diagnostics.push(
        invalidDiscoveryPatternDiagnostic(
          `${rulePath}/pattern`,
          'Discovery pattern must be a non-empty string.',
        ),
      );
      return;
    }

    if (rule.tags !== undefined && !Array.isArray(rule.tags)) {
      diagnostics.push(
        invalidTagTemplateDiagnostic(
          `${rulePath}/tags`,
          'Discovery rule tags must be an array of strings when present.',
        ),
      );
      return;
    }

    const matches = workspace.packageRoots
      .filter((packageRoot) =>
        minimatch(packageRoot, pattern, {
          dot: true,
          nocase: false,
        }),
      )
      .sort((left, right) => left.localeCompare(right));

    if (matches.length === 0) {
      diagnostics.push(
        discoveryPatternNoMatchesDiagnostic(pattern, `${rulePath}/pattern`),
      );
      return;
    }

    for (const match of matches) {
      const wildcardSegments = extractWildcardSegments(pattern, match);

      if (!wildcardSegments) {
        diagnostics.push(
          invalidDiscoveryPatternDiagnostic(
            `${rulePath}/pattern`,
            `Discovery pattern "${pattern}" could not derive wildcard segments for "${match}".`,
          ),
        );
        continue;
      }

      const fallbackName = match.split('/').at(-1) ?? match;
      const name = renderProjectNameTemplate(
        rule.name,
        wildcardSegments,
        fallbackName,
        `${rulePath}/name`,
      );
      diagnostics.push(...name.diagnostics);

      if (!name.value) {
        continue;
      }

      const tags = deriveProjectTags(rule.tags, wildcardSegments, rulePath);
      diagnostics.push(...tags.diagnostics);
      const projection = deriveProjectProjection(
        rule.projection,
        wildcardSegments,
        rulePath,
      );
      diagnostics.push(...projection.diagnostics);

      if (seenRoots.has(match)) {
        diagnostics.push(
          duplicateProjectRootDiagnostic(match, `${rulePath}/pattern`),
        );
        continue;
      }

      if (seenNames.has(name.value)) {
        diagnostics.push(
          duplicateProjectNameDiagnostic(name.value, `${rulePath}/name`),
        );
        continue;
      }

      seenRoots.add(match);
      seenNames.add(name.value);
      const extractedMetadata = extractPackageGovernanceMetadata(
        path.join(workspace.workspaceRoot, match),
        packageGovernanceMetadataConfig,
      );
      diagnostics.push(...extractedMetadata.diagnostics);

      projects.push(
        createDiscoveredProject({
          root: match,
          name: name.value,
          kind: projection.kind,
          type: projection.type,
          tags: tags.tags,
          domain: projection.domain ?? tags.domain,
          layer: projection.layer ?? tags.layer,
          scope: projection.scope ?? tags.scope,
          metadata: projection.metadata,
          owner: extractedMetadata.metadata?.owner,
          metadataDomain: extractedMetadata.metadata?.domain,
          metadataLayer: extractedMetadata.metadata?.layer,
          metadataScope: extractedMetadata.metadata?.scope,
        }),
      );
    }
  });

  return {
    workspaceRoot: workspace.workspaceRoot,
    projects: projects.sort((left, right) => {
      const leftRoot = left.root ?? '';
      const rightRoot = right.root ?? '';

      return (
        leftRoot.localeCompare(rightRoot) || left.id.localeCompare(right.id)
      );
    }),
    diagnostics,
  };
}

function createDiscoveredProject({
  root,
  name,
  kind,
  type,
  tags,
  domain,
  layer,
  scope,
  metadata,
  owner,
  metadataDomain,
  metadataLayer,
  metadataScope,
}: {
  root: string;
  name: string;
  kind?: string;
  type?: string;
  tags: string[];
  domain?: string;
  layer?: string;
  scope?: string;
  metadata?: Record<string, unknown>;
  owner?: string;
  metadataDomain?: string;
  metadataLayer?: string;
  metadataScope?: string;
}): TypeScriptDiscoveredProject {
  const resolvedGovernance = resolveGovernanceWithMetadataPrecedence({
    domain,
    layer,
    scope,
    metadataDomain,
    metadataLayer,
    metadataScope,
  });

  return {
    id: name,
    name,
    root,
    ...(kind ? { kind } : {}),
    type: type ?? 'unknown',
    tags: mergeResolvedGovernanceTags(
      tags,
      resolvedGovernance.domain,
      resolvedGovernance.layer,
      resolvedGovernance.scope,
    ),
    ...(resolvedGovernance.domain ? { domain: resolvedGovernance.domain } : {}),
    ...(resolvedGovernance.layer ? { layer: resolvedGovernance.layer } : {}),
    ...(resolvedGovernance.scope ? { scope: resolvedGovernance.scope } : {}),
    ...(owner
      ? {
          ownership: {
            team: owner,
            source: 'project-metadata',
          },
        }
      : {}),
    metadata: metadata ?? {},
  };
}

function resolveGovernanceWithMetadataPrecedence({
  domain,
  layer,
  scope,
  metadataDomain,
  metadataLayer,
  metadataScope,
}: {
  domain?: string;
  layer?: string;
  scope?: string;
  metadataDomain?: string;
  metadataLayer?: string;
  metadataScope?: string;
}): { domain?: string; layer?: string; scope?: string } {
  // Package metadata is explicit project-owned governance metadata, so it wins
  // over discovery-derived defaults when both are present.
  return {
    domain: metadataDomain ?? domain,
    layer: metadataLayer ?? layer,
    scope: metadataScope ?? scope,
  };
}

function mergeResolvedGovernanceTags(
  existingTags: readonly string[],
  domain?: string,
  layer?: string,
  scope?: string,
): string[] {
  const merged: string[] = [];
  const seenTags = new Set<string>();

  for (const tag of existingTags) {
    if (isGovernanceDimensionTag(tag)) {
      continue;
    }

    if (seenTags.has(tag)) {
      continue;
    }

    seenTags.add(tag);
    merged.push(tag);
  }

  for (const tag of [
    ...(domain ? [`domain:${domain}`] : []),
    ...(layer ? [`layer:${layer}`] : []),
    ...(scope ? [`scope:${scope}`] : []),
  ]) {
    if (seenTags.has(tag)) {
      continue;
    }

    seenTags.add(tag);
    merged.push(tag);
  }

  return merged;
}

function isGovernanceDimensionTag(tag: string): boolean {
  return (
    tag.startsWith('domain:') ||
    tag.startsWith('layer:') ||
    tag.startsWith('scope:')
  );
}

function normalizeDiscoveryPattern(pattern: unknown): string | undefined {
  if (typeof pattern !== 'string') {
    return undefined;
  }

  let normalized = pattern.trim().replaceAll('\\', '/');

  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  normalized = normalized.replace(/\/{2,}/g, '/');

  while (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized.length > 0 ? normalized : undefined;
}

function deriveProjectProjection(
  projection: TypeScriptProjectDiscoveryProjection | undefined,
  wildcardSegments: readonly string[],
  rulePath: string,
): {
  kind?: string;
  type?: string;
  domain?: string;
  layer?: string;
  scope?: string;
  metadata?: Record<string, unknown>;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
} {
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const projectionPath = `${rulePath}/projection`;

  if (projection === undefined) {
    return { diagnostics };
  }

  if (!isRecord(projection)) {
    diagnostics.push(
      invalidDiscoveryProjectionDiagnostic(
        projectionPath,
        'Discovery rule projection must be an object when present.',
      ),
    );
    return { diagnostics };
  }

  const kind = renderOptionalProjectionString(
    projection.kind,
    wildcardSegments,
    `${projectionPath}/kind`,
  );
  const type = renderOptionalProjectionString(
    projection.type,
    wildcardSegments,
    `${projectionPath}/type`,
  );
  const domain = renderOptionalProjectionString(
    projection.domain,
    wildcardSegments,
    `${projectionPath}/domain`,
  );
  const layer = renderOptionalProjectionString(
    projection.layer,
    wildcardSegments,
    `${projectionPath}/layer`,
  );
  const scope = renderOptionalProjectionString(
    projection.scope,
    wildcardSegments,
    `${projectionPath}/scope`,
  );
  const metadata = renderProjectedMetadata(
    projection.metadata,
    wildcardSegments,
    `${projectionPath}/metadata`,
  );

  diagnostics.push(
    ...kind.diagnostics,
    ...type.diagnostics,
    ...domain.diagnostics,
    ...layer.diagnostics,
    ...scope.diagnostics,
    ...metadata.diagnostics,
  );

  return {
    ...(kind.value ? { kind: kind.value } : {}),
    ...(type.value ? { type: type.value } : {}),
    ...(domain.value ? { domain: domain.value } : {}),
    ...(layer.value ? { layer: layer.value } : {}),
    ...(scope.value ? { scope: scope.value } : {}),
    ...(metadata.value ? { metadata: metadata.value } : {}),
    diagnostics,
  };
}

function renderOptionalProjectionString(
  value: unknown,
  wildcardSegments: readonly string[],
  path: string,
): {
  value?: string;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
} {
  if (value === undefined) {
    return { diagnostics: [] };
  }

  if (typeof value !== 'string') {
    return {
      diagnostics: [
        invalidDiscoveryProjectionDiagnostic(
          path,
          'Discovery projection field must be a string when present.',
        ),
      ],
    };
  }

  return renderProjectionTemplate(value, wildcardSegments, path);
}

function renderProjectedMetadata(
  value: unknown,
  wildcardSegments: readonly string[],
  path: string,
): {
  value?: Record<string, unknown>;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
} {
  if (value === undefined) {
    return { diagnostics: [] };
  }

  if (!isRecord(value)) {
    return {
      diagnostics: [
        invalidDiscoveryProjectionDiagnostic(
          path,
          'Discovery projection metadata must be an object when present.',
        ),
      ],
    };
  }

  const rendered = renderProjectedMetadataValue(value, wildcardSegments, path);
  return {
    value: isRecord(rendered.value) ? rendered.value : undefined,
    diagnostics: rendered.diagnostics,
  };
}

function renderProjectedMetadataValue(
  value: unknown,
  wildcardSegments: readonly string[],
  path: string,
): {
  value?: unknown;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
} {
  if (typeof value === 'string') {
    return renderProjectionTemplate(value, wildcardSegments, path);
  }

  if (Array.isArray(value)) {
    const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
    const renderedValues: unknown[] = [];

    for (let index = 0; index < value.length; index += 1) {
      const rendered = renderProjectedMetadataValue(
        value[index],
        wildcardSegments,
        `${path}/${index}`,
      );
      diagnostics.push(...rendered.diagnostics);
      if (rendered.value !== undefined) {
        renderedValues.push(rendered.value);
      }
    }

    return {
      value: renderedValues,
      diagnostics,
    };
  }

  if (isRecord(value)) {
    const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
    const renderedEntries: [string, unknown][] = [];

    for (const [key, entryValue] of Object.entries(value)) {
      const rendered = renderProjectedMetadataValue(
        entryValue,
        wildcardSegments,
        `${path}/${key}`,
      );
      diagnostics.push(...rendered.diagnostics);
      if (rendered.value !== undefined) {
        renderedEntries.push([key, rendered.value]);
      }
    }

    return {
      value: Object.fromEntries(renderedEntries),
      diagnostics,
    };
  }

  return {
    value,
    diagnostics: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractWildcardSegments(
  pattern: string,
  matchedPath: string,
): string[] | undefined {
  const patternSegments = pattern.split('/');
  const pathSegments = matchedPath.split('/');
  const wildcardSegments: string[] = [];
  let patternIndex = 0;
  let pathIndex = 0;

  while (
    patternIndex < patternSegments.length &&
    pathIndex < pathSegments.length
  ) {
    const patternSegment = patternSegments[patternIndex];

    if (patternSegment === '**') {
      const remainingPatternCount = patternSegments.length - patternIndex - 1;
      const captureCount =
        pathSegments.length - pathIndex - remainingPatternCount;

      if (captureCount < 0) {
        return undefined;
      }

      wildcardSegments.push(
        pathSegments.slice(pathIndex, pathIndex + captureCount).join('/'),
      );
      pathIndex += captureCount;
      patternIndex += 1;
      continue;
    }

    const pathSegment = pathSegments[pathIndex];
    if (patternSegment === '*') {
      wildcardSegments.push(pathSegment);
    } else if (patternSegment !== pathSegment) {
      return undefined;
    }

    patternIndex += 1;
    pathIndex += 1;
  }

  if (
    patternIndex !== patternSegments.length ||
    pathIndex !== pathSegments.length
  ) {
    return undefined;
  }

  return wildcardSegments;
}
