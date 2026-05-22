import { renderCliReport } from './internal/reporting/render-cli.js';
import { renderJsonReport } from './internal/reporting/render-json.js';

import type { AgovCheckResult } from './check.js';

export type AgovOutputFormat = 'json' | 'markdown' | 'table';

export function renderAgovCheckReport(
  result: AgovCheckResult,
  format: AgovOutputFormat,
): string {
  switch (format) {
    case 'json':
      return renderAgovCheckJson(result);
    case 'markdown':
      return renderAgovCheckMarkdown(result);
    case 'table':
      return renderAgovCheckTable(result);
  }
}

export function renderAgovCheckJson(result: AgovCheckResult): string {
  return JSON.stringify(
    {
      command: result.command,
      success: result.success,
      assessment: JSON.parse(renderJsonReport(result.assessment)) as object,
    },
    null,
    2,
  );
}

function renderAgovCheckMarkdown(result: AgovCheckResult): string {
  const { assessment } = result;
  const lines: string[] = [];

  lines.push('# agov check');
  lines.push('');
  lines.push(`- Success: ${result.success}`);
  lines.push(`- Workspace: ${assessment.workspace.name}`);
  lines.push(`- Profile: ${assessment.profile}`);
  lines.push(`- Projects: ${assessment.workspace.projects.length}`);
  lines.push(`- Dependencies: ${assessment.workspace.dependencies.length}`);
  lines.push(`- Violations: ${assessment.violations.length}`);
  lines.push(`- Health Score: ${assessment.health.score}`);
  lines.push(`- Health Status: ${assessment.health.status}`);
  lines.push(`- Health Grade: ${assessment.health.grade}`);
  lines.push('');

  lines.push('## Signal Sources');
  lines.push(
    ...renderMarkdownTable(
      ['Source', 'Count'],
      assessment.signalBreakdown.bySource.map((entry) => [
        entry.source,
        `${entry.count}`,
      ]),
    ),
  );
  lines.push('');

  lines.push('## Signal Severity');
  lines.push(
    ...renderMarkdownTable(
      ['Severity', 'Count'],
      assessment.signalBreakdown.bySeverity.map((entry) => [
        entry.severity,
        `${entry.count}`,
      ]),
    ),
  );
  lines.push('');

  lines.push('## Metrics');
  if (assessment.measurements.length === 0) {
    lines.push('No metrics.');
  } else {
    lines.push(
      ...renderMarkdownTable(
        ['Metric', 'Family', 'Score'],
        assessment.measurements.map((measurement) => [
          measurement.name,
          measurement.family,
          `${measurement.score}`,
        ]),
      ),
    );
  }
  lines.push('');

  lines.push('## Top Issues');
  if (assessment.topIssues.length === 0) {
    lines.push('No top issues.');
  } else {
    lines.push(
      ...renderMarkdownTable(
        ['Severity', 'Type', 'Source', 'Count', 'Message'],
        assessment.topIssues.map((issue) => [
          issue.severity,
          issue.type,
          issue.source,
          `${issue.count}`,
          issue.message,
        ]),
      ),
    );
  }
  lines.push('');

  lines.push('## Recommendations');
  if (assessment.recommendations.length === 0) {
    lines.push('No recommendations.');
  } else {
    for (const recommendation of assessment.recommendations) {
      lines.push(
        `- ${recommendation.priority}: ${recommendation.title} - ${recommendation.reason}`,
      );
    }
  }

  return lines.join('\n');
}

function renderAgovCheckTable(result: AgovCheckResult): string {
  const lines: string[] = [];
  const { assessment } = result;
  const assessmentLines = renderCliReport(assessment).split('\n');

  if (assessmentLines[0]?.startsWith('Nx Governance - ')) {
    assessmentLines[0] = `Governance Check - ${assessment.profile}`;
  }

  lines.push('agov check');
  lines.push('');
  lines.push(
    ...renderTextTable(
      ['Field', 'Value'],
      [
        ['success', result.success ? 'true' : 'false'],
        ['workspace', assessment.workspace.name],
        ['profile', assessment.profile],
      ],
    ),
  );
  lines.push('');
  lines.push(...assessmentLines);

  return lines.join('\n');
}

function renderMarkdownTable(
  headers: readonly string[],
  rows: string[][],
): string[] {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ];
}

function renderTextTable(
  headers: [string, string],
  rows: string[][],
): string[] {
  const leftWidth = Math.max(
    headers[0].length,
    ...rows.map((row) => row[0]?.length ?? 0),
  );
  const rightWidth = Math.max(
    headers[1].length,
    ...rows.map((row) => row[1]?.length ?? 0),
  );

  return [
    `${padCell(headers[0], leftWidth)}  ${padCell(headers[1], rightWidth)}`,
    `${'-'.repeat(leftWidth)}  ${'-'.repeat(rightWidth)}`,
    ...rows.map(
      (row) =>
        `${padCell(row[0] ?? '', leftWidth)}  ${padCell(
          row[1] ?? '',
          rightWidth,
        )}`,
    ),
  ];
}

function padCell(value: string, width: number): string {
  return value.padEnd(width, ' ');
}
