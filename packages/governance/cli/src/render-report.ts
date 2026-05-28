import { renderCliReport } from './internal/reporting/render-cli.js';
import { renderJsonReport } from './internal/reporting/render-json.js';
import * as reportingPrimitives from './internal/reporting/render-primitives.js';

import type { AgovAssessResult, AgovCheckResult } from './check.js';
import type { AgovInspectResult } from './inspect.js';

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

export function renderAgovInspectReport(
  result: AgovInspectResult,
  format: AgovOutputFormat,
): string {
  switch (format) {
    case 'json':
      return renderAgovInspectJson(result);
    case 'markdown':
      return renderAgovInspectMarkdown(result);
    case 'table':
    case 'text':
      return renderAgovInspectTable(result);
  }
}

export function renderAgovCheckJson(result: AgovCommandResult): string {
  return reportingPrimitives.renderJsonValue({
    command: result.command,
    success: result.success,
    assessment: JSON.parse(renderJsonReport(result.assessment)) as object,
  });
}

export function renderAgovInspectJson(result: AgovInspectResult): string {
  return reportingPrimitives.renderJsonValue(result, { stable: true });
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

function renderAgovInspectTable(result: AgovInspectResult): string {
  const lines: string[] = [];

  lines.push('agov inspect');
  lines.push('');
  lines.push('Workspace');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['id', result.workspace.id],
        ['name', result.workspace.name],
        ['root', result.workspace.root],
        [
          'metadata',
          result.workspace.metadata
            ? compactJson(result.workspace.metadata)
            : 'none',
        ],
      ],
    }),
  );
  lines.push('');
  lines.push('Adapter');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['id', result.adapter.id],
        [
          'metadata',
          result.adapter.metadata
            ? compactJson(result.adapter.metadata)
            : 'none',
        ],
        ['capabilities', String(result.adapter.capabilities.length)],
        ['diagnostics', String(result.adapter.diagnostics.length)],
      ],
    }),
  );
  lines.push('');
  lines.push('Summary');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.summary?.workspaceName ?? result.workspace.name],
        [
          'projects',
          String(result.summary?.projectCount ?? result.projects.length),
        ],
        [
          'dependencies',
          String(result.summary?.dependencyCount ?? result.dependencies.length),
        ],
        ['domains', String(result.summary?.distinctDomains.length ?? 0)],
        ['layers', String(result.summary?.distinctLayers.length ?? 0)],
        [
          'ownership coverage',
          formatCoverage(result.summary?.ownershipCoverage),
        ],
      ],
    }),
  );

  if (result.projects.length > 0) {
    lines.push('');
    lines.push('Projects');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Project', 'Details'],
        rows: result.projects.map((project) => [
          project.id,
          formatProjectDetails(project),
        ]),
      }),
    );
  }

  if (result.dependencies.length > 0) {
    lines.push('');
    lines.push('Dependencies');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Dependency', 'Details'],
        rows: result.dependencies.map((dependency) => [
          `${dependency.source} -> ${dependency.target}`,
          formatDependencyDetails(dependency),
        ]),
      }),
    );
  }

  return lines.join('\n');
}

function renderAgovInspectMarkdown(result: AgovInspectResult): string {
  const lines: string[] = [];

  lines.push('# agov inspect');
  lines.push('');
  lines.push('## Workspace');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['id', result.workspace.id],
        ['name', result.workspace.name],
        ['root', result.workspace.root],
        [
          'metadata',
          result.workspace.metadata
            ? compactJson(result.workspace.metadata)
            : 'none',
        ],
      ],
    }),
  );
  lines.push('');
  lines.push('## Adapter');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['id', result.adapter.id],
        [
          'metadata',
          result.adapter.metadata
            ? compactJson(result.adapter.metadata)
            : 'none',
        ],
        ['capabilities', String(result.adapter.capabilities.length)],
        ['diagnostics', String(result.adapter.diagnostics.length)],
      ],
    }),
  );
  lines.push('');
  lines.push('## Summary');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.summary?.workspaceName ?? result.workspace.name],
        [
          'projects',
          String(result.summary?.projectCount ?? result.projects.length),
        ],
        [
          'dependencies',
          String(result.summary?.dependencyCount ?? result.dependencies.length),
        ],
        ['domains', String(result.summary?.distinctDomains.length ?? 0)],
        ['layers', String(result.summary?.distinctLayers.length ?? 0)],
        [
          'ownership coverage',
          formatCoverage(result.summary?.ownershipCoverage),
        ],
      ],
    }),
  );

  if (result.projects.length > 0) {
    lines.push('');
    lines.push('## Projects');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['Project', 'Details'],
        rows: result.projects.map((project) => [
          project.id,
          formatProjectDetails(project),
        ]),
      }),
    );
  }

  if (result.dependencies.length > 0) {
    lines.push('');
    lines.push('## Dependencies');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['Dependency', 'Details'],
        rows: result.dependencies.map((dependency) => [
          `${dependency.source} -> ${dependency.target}`,
          formatDependencyDetails(dependency),
        ]),
      }),
    );
  }

  return lines.join('\n');
}

function formatProjectDetails(
  project: AgovInspectResult['projects'][number],
): string {
  return [
    `type=${project.type}`,
    project.domain ? `domain=${project.domain}` : undefined,
    project.layer ? `layer=${project.layer}` : undefined,
    project.ownership?.team ? `ownership=${project.ownership.team}` : undefined,
    project.ownership?.contacts?.length
      ? `contacts=${project.ownership.contacts.join(',')}`
      : undefined,
    project.tags.length > 0 ? `tags=${project.tags.join(',')}` : undefined,
    `root=${project.root}`,
    Object.keys(project.metadata).length > 0
      ? `metadata=${compactJson(project.metadata)}`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' :: ');
}

function formatDependencyDetails(
  dependency: AgovInspectResult['dependencies'][number],
): string {
  return [
    `type=${dependency.type}`,
    dependency.sourceFile ? `sourceFile=${dependency.sourceFile}` : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' :: ');
}

function formatCoverage(
  coverage: AgovInspectResult['summary'] extends infer T
    ? T extends { ownershipCoverage: infer U }
      ? U | undefined
      : undefined
    : undefined,
): string {
  if (!coverage) {
    return '0/0 (0%)';
  }

  return `${coverage.covered}/${coverage.total} (${Math.round(coverage.ratio * 100)}%)`;
}

function compactJson(value: unknown): string {
  return reportingPrimitives
    .renderJsonValue(value, { stable: true })
    .replaceAll('\n', ' ');
}
