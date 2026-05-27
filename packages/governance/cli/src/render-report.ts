import { renderCliReport } from './internal/reporting/render-cli.js';
import { renderJsonReport } from './internal/reporting/render-json.js';
import * as reportingPrimitives from './internal/reporting/render-primitives.js';

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
  return reportingPrimitives.renderJsonValue({
    command: result.command,
    success: result.success,
    assessment: JSON.parse(renderJsonReport(result.assessment)) as object,
  });
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
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['success', result.success ? 'true' : 'false'],
        ['workspace', assessment.workspace.name],
        ['profile', assessment.profile],
      ],
    }),
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
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['success', result.success ? 'true' : 'false'],
        ['workspace', assessment.workspace.name],
        ['profile', assessment.profile],
      ],
    }),
  );
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
