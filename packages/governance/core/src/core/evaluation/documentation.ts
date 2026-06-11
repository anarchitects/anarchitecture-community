import type { GovernanceNode } from '../model/models.js';
import type {
  DocumentationPresenceOptions,
  GovernanceProfile,
} from './profile.js';
import { normalizeGovernanceProfile } from './profile.js';

export const DEFAULT_DOCUMENTATION_PRESENCE_OPTIONS = {
  metadataKeys: ['documentation'],
  requireAny: true,
} satisfies Required<DocumentationPresenceOptions>;

export function normalizeDocumentationPresenceOptions(
  options?: DocumentationPresenceOptions,
): Required<DocumentationPresenceOptions> {
  const metadataKeys = [
    ...new Set(
      (
        options?.metadataKeys ??
        DEFAULT_DOCUMENTATION_PRESENCE_OPTIONS.metadataKeys
      )
        .filter((key): key is string => typeof key === 'string')
        .map((key) => key.trim())
        .filter((key) => key.length > 0),
    ),
  ].sort((left, right) => left.localeCompare(right));

  return {
    metadataKeys:
      metadataKeys.length > 0
        ? metadataKeys
        : [...DEFAULT_DOCUMENTATION_PRESENCE_OPTIONS.metadataKeys],
    requireAny:
      options?.requireAny ?? DEFAULT_DOCUMENTATION_PRESENCE_OPTIONS.requireAny,
  };
}

export function resolveDocumentationPresenceOptions(
  profile?: GovernanceProfile,
): Required<DocumentationPresenceOptions> {
  const normalizedProfile = profile
    ? normalizeGovernanceProfile(profile)
    : undefined;
  const ruleOptions = normalizedProfile?.rules['documentation-gap']?.options as
    | DocumentationPresenceOptions
    | undefined;

  return normalizeDocumentationPresenceOptions(ruleOptions);
}

export function getDocumentationPresence(
  node: GovernanceNode,
  options?: DocumentationPresenceOptions,
): {
  documented: boolean;
  matchingMetadataKeys: string[];
} {
  const normalizedOptions = normalizeDocumentationPresenceOptions(options);
  const matchingMetadataKeys = normalizedOptions.metadataKeys.filter((key) =>
    hasDocumentationMetadataValue(node.metadata[key]),
  );

  return {
    documented: normalizedOptions.requireAny
      ? matchingMetadataKeys.length > 0
      : matchingMetadataKeys.length === normalizedOptions.metadataKeys.length,
    matchingMetadataKeys,
  };
}

export function isGovernanceNodeDocumented(
  node: GovernanceNode,
  options?: DocumentationPresenceOptions,
): boolean {
  return getDocumentationPresence(node, options).documented;
}

function hasDocumentationMetadataValue(value: unknown): boolean {
  return value === true || value === 'true';
}
