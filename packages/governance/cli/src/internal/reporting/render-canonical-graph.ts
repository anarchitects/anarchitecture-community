import type { AgovInspectResult } from '../../inspect.js';
import { renderJsonValue } from './render-primitives.js';

export function formatStringSummary(values: readonly string[]): string {
  if (values.length === 0) {
    return 'none';
  }

  return values.join(', ');
}

export function formatNodeDetails(
  node: AgovInspectResult['nodes'][number],
): string {
  return [
    `kind=${node.kind}`,
    node.name ? `name=${node.name}` : undefined,
    node.technology ? `technology=${node.technology}` : undefined,
    node.sourceSystem ? `sourceSystem=${node.sourceSystem}` : undefined,
    node.path ? `path=${node.path}` : undefined,
    node.root ? `root=${node.root}` : undefined,
    node.tags.length > 0 ? `tags=${node.tags.join(',')}` : undefined,
    node.classification
      ? `classification=${compactJson(node.classification)}`
      : undefined,
    node.ownership ? `ownership=${compactJson(node.ownership)}` : undefined,
    Object.keys(node.metadata).length > 0
      ? `metadata=${compactJson(node.metadata)}`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' :: ');
}

export function formatRelationDetails(
  relation: AgovInspectResult['relations'][number],
): string {
  return [
    `kind=${relation.kind}`,
    `id=${relation.id}`,
    Object.keys(relation.metadata).length > 0
      ? `metadata=${compactJson(relation.metadata)}`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' :: ');
}

function compactJson(value: unknown): string {
  return renderJsonValue(value, { stable: true }).replaceAll('\n', ' ');
}
