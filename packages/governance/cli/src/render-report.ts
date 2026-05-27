import { renderCliReport } from './internal/reporting/render-cli.js';
import { renderJsonReport } from './internal/reporting/render-json.js';

import type { AgovAssessResult, AgovCheckResult } from './check.js';

type AgovCommandResult = AgovCheckResult | AgovAssessResult;

export type AgovOutputFormat = 'json' | 'markdown' | 'table' | 'text';

export function renderAgovCheckReport(
  result: AgovCommandResult,
  format: AgovOutputFormat,
): string {
  switch (format) {
    case 'json':
      return renderAgovCheckJson(result);
    case 'markdown':
      return renderAgovCheckMarkdown(result);
    case 'table':
    case 'text':
      return renderAgovCheckTable(result);
  }
}

export function renderAgovCheckJson(result: AgovCommandResult): string {
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

function renderAgovCheckTable(result: AgovCommandResult): string {
  const lines: string[] = [];
  const { assessment } = result;
  const assessmentLines = renderCliReport(assessment).split('\n');

  if (assessmentLines[0]?.startsWith('Nx Governance - ')) {
    const headingVerb = result.command === 'assess' ? 'Assess' : 'Check';
    assessmentLines[0] = `Governance ${headingVerb} - ${assessment.profile}`;
  }

  lines.push(`agov ${result.command}`);
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

function renderAgovCheckMarkdown(result: AgovCommandResult): string {
  const { assessment } = result;
  const lines: string[] = [];
  const assessmentLines = renderCliReport(assessment).split('\n');

  if (assessmentLines[0]?.startsWith('Nx Governance - ')) {
    const headingVerb = result.command === 'assess' ? 'Assess' : 'Check';
    assessmentLines[0] = `Governance ${headingVerb} - ${assessment.profile}`;
  }

  lines.push(`# agov ${result.command}`);
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('| --- | --- |');
  lines.push(`| success | ${result.success ? 'true' : 'false'} |`);
  lines.push(
    `| workspace | ${escapeMarkdownCell(assessment.workspace.name)} |`,
  );
  lines.push(`| profile | ${escapeMarkdownCell(assessment.profile)} |`);
  lines.push('');

  for (const line of assessmentLines) {
    if (line.length === 0) {
      lines.push('');
      continue;
    }

    if (!line.startsWith('- ')) {
      lines.push(`## ${line}`);
      continue;
    }

    lines.push(line);
  }

  return lines.join('\n');
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

function escapeMarkdownCell(value: string): string {
  return value.replaceAll('|', '\\|');
}
