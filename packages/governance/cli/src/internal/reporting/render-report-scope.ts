import * as reportingPrimitives from './render-primitives.js';

export interface RenderableReportScope {
  mode: string;
  filters: object;
}

export function appendReportScopeText(
  lines: string[],
  scope: RenderableReportScope | undefined,
): void {
  if (!scope) {
    return;
  }

  lines.push('');
  lines.push('Report Scope');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['mode', scope.mode],
        ['filters', formatReportScopeFilters(scope.filters)],
      ],
    }),
  );
}

export function appendReportScopeMarkdown(
  lines: string[],
  scope: RenderableReportScope | undefined,
): void {
  if (!scope) {
    return;
  }

  lines.push('');
  lines.push('## Report Scope');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['mode', scope.mode],
        ['filters', formatReportScopeFilters(scope.filters)],
      ],
    }),
  );
}

function formatReportScopeFilters(filters: object): string {
  const entries = Object.entries(filters as Record<string, unknown>).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );

  if (entries.length === 0) {
    return 'none';
  }

  return entries.map(([key, value]) => `${key}=${String(value)}`).join(', ');
}
