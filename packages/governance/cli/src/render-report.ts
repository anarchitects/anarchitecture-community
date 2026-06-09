import { renderCliReport } from './internal/reporting/render-cli.js';
import {
  formatNodeDetails,
  formatRelationDetails,
  formatStringSummary,
} from './internal/reporting/render-canonical-graph.js';
import { renderJsonReport } from './internal/reporting/render-json.js';
import * as reportingPrimitives from './internal/reporting/render-primitives.js';
import {
  appendReportScopeMarkdown,
  appendReportScopeText,
} from './internal/reporting/render-report-scope.js';
import type { GovernanceSignal, Violation } from '@anarchitects/governance-core';

import type { AgovAssessResult, AgovCheckResult } from './check.js';
import type { AgovDependenciesResult } from './dependencies.js';
import type { AgovInspectResult } from './inspect.js';
import type { AgovMetricsResult } from './metrics.js';
import type { AgovProfileValidateResult } from './profile-validate.js';
import type { AgovRecommendationsResult } from './recommendations.js';
import type { AgovSignalsResult } from './signals.js';
import type { AgovViolationsResult } from './violations.js';
import type { AgovWorkspaceValidateResult } from './workspace-validate.js';

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

export function renderAgovProfileValidateReport(
  result: AgovProfileValidateResult,
  format: AgovOutputFormat,
): string {
  switch (format) {
    case 'json':
      return renderAgovProfileValidateJson(result);
    case 'markdown':
      return renderAgovProfileValidateMarkdown(result);
    case 'table':
    case 'text':
      return renderAgovProfileValidateTable(result);
  }
}

export function renderAgovWorkspaceValidateReport(
  result: AgovWorkspaceValidateResult,
  format: AgovOutputFormat,
): string {
  switch (format) {
    case 'json':
      return renderAgovWorkspaceValidateJson(result);
    case 'markdown':
      return renderAgovWorkspaceValidateMarkdown(result);
    case 'table':
    case 'text':
      return renderAgovWorkspaceValidateTable(result);
  }
}

export function renderAgovDependenciesReport(
  result: AgovDependenciesResult,
  format: AgovOutputFormat,
): string {
  switch (format) {
    case 'json':
      return renderAgovDependenciesJson(result);
    case 'markdown':
      return renderAgovDependenciesMarkdown(result);
    case 'table':
    case 'text':
      return renderAgovDependenciesTable(result);
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

export function renderAgovMetricsReport(
  result: AgovMetricsResult,
  format: AgovOutputFormat,
): string {
  switch (format) {
    case 'json':
      return renderAgovMetricsJson(result);
    case 'markdown':
      return renderAgovMetricsMarkdown(result);
    case 'table':
    case 'text':
      return renderAgovMetricsTable(result);
  }
}

export function renderAgovViolationsReport(
  result: AgovViolationsResult,
  format: AgovOutputFormat,
): string {
  switch (format) {
    case 'json':
      return renderAgovViolationsJson(result);
    case 'markdown':
      return renderAgovViolationsMarkdown(result);
    case 'table':
    case 'text':
      return renderAgovViolationsTable(result);
  }
}

export function renderAgovRecommendationsReport(
  result: AgovRecommendationsResult,
  format: AgovOutputFormat,
): string {
  switch (format) {
    case 'json':
      return renderAgovRecommendationsJson(result);
    case 'markdown':
      return renderAgovRecommendationsMarkdown(result);
    case 'table':
    case 'text':
      return renderAgovRecommendationsTable(result);
  }
}

export function renderAgovSignalsReport(
  result: AgovSignalsResult,
  format: AgovOutputFormat,
): string {
  switch (format) {
    case 'json':
      return renderAgovSignalsJson(result);
    case 'markdown':
      return renderAgovSignalsMarkdown(result);
    case 'table':
    case 'text':
      return renderAgovSignalsTable(result);
  }
}

export function renderAgovCheckJson(result: AgovCommandResult): string {
  return reportingPrimitives.renderJsonValue({
    command: result.command,
    success: result.success,
    assessment: JSON.parse(renderJsonReport(result.assessment)) as object,
    graph: result.graph,
    artifacts: {
      capabilities: result.artifacts.capabilities,
      diagnostics: result.artifacts.diagnostics,
      extensionDiagnostics: result.artifacts.extensionDiagnostics,
    },
  });
}

export function renderAgovProfileValidateJson(
  result: AgovProfileValidateResult,
): string {
  return reportingPrimitives.renderJsonValue(result, { stable: true });
}

export function renderAgovWorkspaceValidateJson(
  result: AgovWorkspaceValidateResult,
): string {
  return reportingPrimitives.renderJsonValue(result, { stable: true });
}

export function renderAgovDependenciesJson(
  result: AgovDependenciesResult,
): string {
  return reportingPrimitives.renderJsonValue(result, { stable: true });
}

export function renderAgovInspectJson(result: AgovInspectResult): string {
  return reportingPrimitives.renderJsonValue(result, { stable: true });
}

export function renderAgovMetricsJson(result: AgovMetricsResult): string {
  return reportingPrimitives.renderJsonValue(result, { stable: true });
}

export function renderAgovViolationsJson(result: AgovViolationsResult): string {
  return reportingPrimitives.renderJsonValue(result, { stable: true });
}

export function renderAgovRecommendationsJson(
  result: AgovRecommendationsResult,
): string {
  return reportingPrimitives.renderJsonValue(result, { stable: true });
}

export function renderAgovSignalsJson(result: AgovSignalsResult): string {
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
  appendDiagnosticsText(lines, result);

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
  appendDiagnosticsMarkdown(lines, result);

  return lines.join('\n');
}

function appendDiagnosticsText(
  lines: string[],
  result: AgovCommandResult,
): void {
  if (result.artifacts.diagnostics.length > 0) {
    lines.push('');
    lines.push('Diagnostics');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Diagnostic', 'Details'],
        rows: result.artifacts.diagnostics.map((diagnostic) => [
          diagnostic.code,
          formatDiagnosticDetails(diagnostic),
        ]),
      }),
    );
  }

  if (result.artifacts.extensionDiagnostics.length > 0) {
    lines.push('');
    lines.push('Extension Diagnostics');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Diagnostic', 'Details'],
        rows: result.artifacts.extensionDiagnostics.map((diagnostic) => [
          diagnostic.code,
          [
            `message=${diagnostic.message}`,
            `severity=${diagnostic.severity}`,
            diagnostic.extensionId
              ? `extension=${diagnostic.extensionId}`
              : undefined,
            diagnostic.packageName
              ? `package=${diagnostic.packageName}`
              : undefined,
            diagnostic.moduleSpecifier
              ? `module=${diagnostic.moduleSpecifier}`
              : undefined,
          ]
            .filter((part): part is string => Boolean(part))
            .join(' :: '),
        ]),
      }),
    );
  }
}

function appendDiagnosticsMarkdown(
  lines: string[],
  result: AgovCommandResult,
): void {
  if (result.artifacts.diagnostics.length > 0) {
    lines.push('');
    lines.push('## Diagnostics');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['Diagnostic', 'Details'],
        rows: result.artifacts.diagnostics.map((diagnostic) => [
          diagnostic.code,
          formatDiagnosticDetails(diagnostic),
        ]),
      }),
    );
  }

  if (result.artifacts.extensionDiagnostics.length > 0) {
    lines.push('');
    lines.push('## Extension Diagnostics');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['Diagnostic', 'Details'],
        rows: result.artifacts.extensionDiagnostics.map((diagnostic) => [
          diagnostic.code,
          [
            `message=${diagnostic.message}`,
            `severity=${diagnostic.severity}`,
            diagnostic.extensionId
              ? `extension=${diagnostic.extensionId}`
              : undefined,
            diagnostic.packageName
              ? `package=${diagnostic.packageName}`
              : undefined,
            diagnostic.moduleSpecifier
              ? `module=${diagnostic.moduleSpecifier}`
              : undefined,
          ]
            .filter((part): part is string => Boolean(part))
            .join(' :: '),
        ]),
      }),
    );
  }
}

function formatDiagnosticDetails(
  diagnostic: AgovCommandResult['artifacts']['diagnostics'][number],
): string {
  const status = readDiagnosticStatus(diagnostic);

  return [
    `message=${diagnostic.message}`,
    diagnostic.severity ? `severity=${diagnostic.severity}` : undefined,
    diagnostic.kind ? `kind=${diagnostic.kind}` : undefined,
    diagnostic.category ? `category=${diagnostic.category}` : undefined,
    status ? `status=${status}` : undefined,
    diagnostic.source ? `source=${diagnostic.source}` : undefined,
    diagnostic.details
      ? `details=${compactJson(diagnostic.details)}`
      : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' :: ');
}

function readDiagnosticStatus(
  diagnostic: AgovCommandResult['artifacts']['diagnostics'][number],
): string | undefined {
  const metadataStatus =
    diagnostic.metadata &&
    typeof diagnostic.metadata.status === 'string' &&
    diagnostic.metadata.status.length > 0
      ? diagnostic.metadata.status
      : undefined;
  const detailsStatus =
    diagnostic.details &&
    typeof diagnostic.details.status === 'string' &&
    diagnostic.details.status.length > 0
      ? diagnostic.details.status
      : undefined;

  return metadataStatus ?? detailsStatus;
}

function renderAgovProfileValidateTable(
  result: AgovProfileValidateResult,
): string {
  const lines: string[] = [];

  lines.push('agov profile validate');
  lines.push('');
  lines.push('Summary');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['status', result.success ? 'valid' : 'invalid'],
        ['profile path', result.profilePath],
        ['profile name', result.summary.profileName ?? 'none'],
        ['error count', String(result.summary.errorCount)],
        ['warning count', String(result.summary.warningCount)],
      ],
    }),
  );

  if ((result.errors?.length ?? 0) > 0) {
    lines.push('');
    lines.push('Errors');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Issue', 'Details'],
        rows: (result.errors ?? []).map((issue) => [
          issue.code,
          [`message=${issue.message}`, `path=${issue.path}`]
            .filter((part): part is string => Boolean(part))
            .join(' :: '),
        ]),
      }),
    );
  }

  return lines.join('\n');
}

function renderAgovWorkspaceValidateTable(
  result: AgovWorkspaceValidateResult,
): string {
  const lines: string[] = [];

  lines.push('agov workspace validate');
  lines.push('');
  lines.push('Summary');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['status', result.success ? 'valid' : 'invalid'],
        ['workspace path', result.workspacePath ?? 'none'],
        ['adapter package', result.adapterPackage ?? 'none'],
        ['adapter id', result.adapter?.id ?? 'none'],
        ['workspace name', result.summary.workspaceName ?? 'none'],
        ['project count', String(result.summary.projectCount)],
        ['dependency count', String(result.summary.dependencyCount)],
        ['error count', String(result.summary.errorCount)],
        ['diagnostic count', String(result.summary.diagnosticCount)],
        ['warning count', String(result.summary.warningCount)],
      ],
    }),
  );

  if ((result.errors?.length ?? 0) > 0) {
    lines.push('');
    lines.push('Errors');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Issue', 'Details'],
        rows: (result.errors ?? []).map((issue) => [
          issue.code,
          [`message=${issue.message}`, `path=${issue.path}`]
            .filter((part): part is string => Boolean(part))
            .join(' :: '),
        ]),
      }),
    );
  }

  if ((result.diagnostics?.length ?? 0) > 0) {
    lines.push('');
    lines.push('Diagnostics');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Diagnostic', 'Details'],
        rows: (result.diagnostics ?? []).map((diagnostic) => [
          diagnostic.code,
          [
            `message=${diagnostic.message}`,
            diagnostic.source ? `source=${diagnostic.source}` : undefined,
            diagnostic.details
              ? `details=${compactJson(diagnostic.details)}`
              : undefined,
          ]
            .filter((part): part is string => Boolean(part))
            .join(' :: '),
        ]),
      }),
    );
  }

  return lines.join('\n');
}

function renderAgovDependenciesTable(result: AgovDependenciesResult): string {
  const lines: string[] = [];

  lines.push('agov dependencies');
  lines.push('');
  lines.push('Summary');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.workspace.name],
        ['total dependencies', String(result.summary.totalDependencies)],
        ['by type', formatCountSummary(result.summary.byType, 'type')],
        ['project count', String(result.summary.projectCount)],
        ['source project count', String(result.summary.sourceProjectCount)],
        ['target project count', String(result.summary.targetProjectCount)],
        ['top outgoing', formatProjectCountSummary(result.summary.topOutgoing)],
        ['top incoming', formatProjectCountSummary(result.summary.topIncoming)],
      ],
    }),
  );

  lines.push('');
  lines.push('Dependencies');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Dependency', 'Details'],
      rows: result.dependencies.map((dependency) => [
        `${dependency.source} -> ${dependency.target}`,
        [
          `type=${dependency.type}`,
          dependency.sourceFile
            ? `sourceFile=${dependency.sourceFile}`
            : undefined,
        ]
          .filter((part): part is string => Boolean(part))
          .join(' :: '),
      ]),
    }),
  );

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
        ['nodes', String(result.summary?.nodeCount ?? result.nodes.length)],
        [
          'relations',
          String(result.summary?.relationCount ?? result.relations.length),
        ],
        [
          'projects',
          String(result.summary?.projectCount ?? result.projects.length),
        ],
        [
          'dependencies',
          String(result.summary?.dependencyCount ?? result.dependencies.length),
        ],
        [
          'node kinds',
          formatStringSummary(result.summary?.distinctNodeKinds ?? []),
        ],
        [
          'relation kinds',
          formatStringSummary(result.summary?.distinctRelationKinds ?? []),
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

  if (result.nodes.length > 0) {
    lines.push('');
    lines.push('Nodes');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Node', 'Details'],
        rows: result.nodes.map((node) => [node.id, formatNodeDetails(node)]),
      }),
    );
  }

  if (result.relations.length > 0) {
    lines.push('');
    lines.push('Relations');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Relation', 'Details'],
        rows: result.relations.map((relation) => [
          `${relation.sourceNodeId} -> ${relation.targetNodeId}`,
          formatRelationDetails(relation),
        ]),
      }),
    );
  }

  if (result.projects.length > 0) {
    lines.push('');
    lines.push('Compatibility Projects');
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
    lines.push('Compatibility Dependencies');
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
        ['nodes', String(result.summary?.nodeCount ?? result.nodes.length)],
        [
          'relations',
          String(result.summary?.relationCount ?? result.relations.length),
        ],
        [
          'projects',
          String(result.summary?.projectCount ?? result.projects.length),
        ],
        [
          'dependencies',
          String(result.summary?.dependencyCount ?? result.dependencies.length),
        ],
        [
          'node kinds',
          formatStringSummary(result.summary?.distinctNodeKinds ?? []),
        ],
        [
          'relation kinds',
          formatStringSummary(result.summary?.distinctRelationKinds ?? []),
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

  if (result.nodes.length > 0) {
    lines.push('');
    lines.push('## Nodes');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['node', 'details'],
        rows: result.nodes.map((node) => [node.id, formatNodeDetails(node)]),
      }),
    );
  }

  if (result.relations.length > 0) {
    lines.push('');
    lines.push('## Relations');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['source', 'target', 'details'],
        rows: result.relations.map((relation) => [
          relation.sourceNodeId,
          relation.targetNodeId,
          formatRelationDetails(relation),
        ]),
      }),
    );
  }

  if (result.projects.length > 0) {
    lines.push('');
    lines.push('## Compatibility Projects');
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
    lines.push('## Compatibility Dependencies');
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

function renderAgovDependenciesMarkdown(
  result: AgovDependenciesResult,
): string {
  const lines: string[] = [];

  lines.push('# agov dependencies');
  lines.push('');
  lines.push('## Summary');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.workspace.name],
        ['total dependencies', String(result.summary.totalDependencies)],
        ['by type', formatCountSummary(result.summary.byType, 'type')],
        ['project count', String(result.summary.projectCount)],
        ['source project count', String(result.summary.sourceProjectCount)],
        ['target project count', String(result.summary.targetProjectCount)],
        ['top outgoing', formatProjectCountSummary(result.summary.topOutgoing)],
        ['top incoming', formatProjectCountSummary(result.summary.topIncoming)],
      ],
    }),
  );

  lines.push('');
  lines.push('## Dependencies');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['source', 'target', 'type', 'source file'],
      rows: result.dependencies.map((dependency) => [
        dependency.source,
        dependency.target,
        dependency.type,
        dependency.sourceFile ?? 'none',
      ]),
    }),
  );

  return lines.join('\n');
}

function renderAgovProfileValidateMarkdown(
  result: AgovProfileValidateResult,
): string {
  const lines: string[] = [];

  lines.push('# agov profile validate');
  lines.push('');
  lines.push('## Summary');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['status', result.success ? 'valid' : 'invalid'],
        ['profile path', result.profilePath],
        ['profile name', result.summary.profileName ?? 'none'],
        ['error count', String(result.summary.errorCount)],
        ['warning count', String(result.summary.warningCount)],
      ],
    }),
  );

  if ((result.errors?.length ?? 0) > 0) {
    lines.push('');
    lines.push('## Errors');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['code', 'message', 'path'],
        rows: (result.errors ?? []).map((issue) => [
          issue.code,
          issue.message,
          issue.path,
        ]),
      }),
    );
  }

  return lines.join('\n');
}

function renderAgovWorkspaceValidateMarkdown(
  result: AgovWorkspaceValidateResult,
): string {
  const lines: string[] = [];

  lines.push('# agov workspace validate');
  lines.push('');
  lines.push('## Summary');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['status', result.success ? 'valid' : 'invalid'],
        ['workspace path', result.workspacePath ?? 'none'],
        ['adapter package', result.adapterPackage ?? 'none'],
        ['adapter id', result.adapter?.id ?? 'none'],
        ['workspace name', result.summary.workspaceName ?? 'none'],
        ['project count', String(result.summary.projectCount)],
        ['dependency count', String(result.summary.dependencyCount)],
        ['error count', String(result.summary.errorCount)],
        ['diagnostic count', String(result.summary.diagnosticCount)],
        ['warning count', String(result.summary.warningCount)],
      ],
    }),
  );

  if ((result.errors?.length ?? 0) > 0) {
    lines.push('');
    lines.push('## Errors');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['code', 'message', 'path'],
        rows: (result.errors ?? []).map((issue) => [
          issue.code,
          issue.message,
          issue.path,
        ]),
      }),
    );
  }

  if ((result.diagnostics?.length ?? 0) > 0) {
    lines.push('');
    lines.push('## Diagnostics');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['code', 'message', 'source', 'details'],
        rows: (result.diagnostics ?? []).map((diagnostic) => [
          diagnostic.code,
          diagnostic.message,
          diagnostic.source ?? 'none',
          diagnostic.details ? compactJson(diagnostic.details) : 'none',
        ]),
      }),
    );
  }

  return lines.join('\n');
}

function renderAgovMetricsTable(result: AgovMetricsResult): string {
  const lines: string[] = [];

  lines.push('agov metrics');
  lines.push('');
  lines.push('Health');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.workspace.name],
        ['profile', result.profile],
        ['health score', String(result.health.score)],
        ['health grade', result.health.grade],
        ['health status', result.health.status],
        [
          'thresholds',
          result.health.thresholds
            ? `good>=${result.health.thresholds.goodMinScore}, warning>=${result.health.thresholds.warningMinScore}`
            : 'none',
        ],
      ],
    }),
  );
  appendReportScopeText(lines, result.scope);

  lines.push('');
  lines.push('Measurements');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Measurement', 'Details'],
      rows: result.measurements.map((measurement) => [
        measurement.id,
        [
          `name=${measurement.name}`,
          `family=${measurement.family}`,
          `score=${measurement.score}`,
          `value=${measurement.value}`,
          `max=${measurement.maxScore}`,
          `unit=${measurement.unit}`,
        ].join(' :: '),
      ]),
    }),
  );

  if ((result.summary?.weakestMetrics.length ?? 0) > 0) {
    lines.push('');
    lines.push('Weakest Metrics');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Metric', 'Score'],
        rows: (result.summary?.weakestMetrics ?? []).map((metric) => [
          `${metric.id} (${metric.name})`,
          String(metric.score),
        ]),
      }),
    );
  }

  lines.push('');
  lines.push('Summary');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['measurement count', String(result.summary?.measurementCount ?? 0)],
        ['metric family count', String(result.summary?.metricFamilyCount ?? 0)],
      ],
    }),
  );

  return lines.join('\n');
}

function renderAgovMetricsMarkdown(result: AgovMetricsResult): string {
  const lines: string[] = [];

  lines.push('# agov metrics');
  lines.push('');
  lines.push('## Health');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.workspace.name],
        ['profile', result.profile],
        ['health score', String(result.health.score)],
        ['health grade', result.health.grade],
        ['health status', result.health.status],
        [
          'thresholds',
          result.health.thresholds
            ? `good>=${result.health.thresholds.goodMinScore}, warning>=${result.health.thresholds.warningMinScore}`
            : 'none',
        ],
      ],
    }),
  );
  appendReportScopeMarkdown(lines, result.scope);

  lines.push('');
  lines.push('## Measurements');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Measurement', 'Details'],
      rows: result.measurements.map((measurement) => [
        measurement.id,
        [
          `name=${measurement.name}`,
          `family=${measurement.family}`,
          `score=${measurement.score}`,
          `value=${measurement.value}`,
          `max=${measurement.maxScore}`,
          `unit=${measurement.unit}`,
        ].join(' :: '),
      ]),
    }),
  );

  if ((result.summary?.weakestMetrics.length ?? 0) > 0) {
    lines.push('');
    lines.push('## Weakest Metrics');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['Metric', 'Score'],
        rows: (result.summary?.weakestMetrics ?? []).map((metric) => [
          `${metric.id} (${metric.name})`,
          String(metric.score),
        ]),
      }),
    );
  }

  lines.push('');
  lines.push('## Summary');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['measurement count', String(result.summary?.measurementCount ?? 0)],
        ['metric family count', String(result.summary?.metricFamilyCount ?? 0)],
      ],
    }),
  );

  return lines.join('\n');
}

function renderAgovViolationsTable(result: AgovViolationsResult): string {
  const lines: string[] = [];

  lines.push('agov violations');
  lines.push('');
  lines.push('Summary');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.workspace.name],
        ['profile', result.profile],
        ['total', String(result.summary.total)],
        [
          'by severity',
          formatCountSummary(result.summary.bySeverity, 'severity'),
        ],
        [
          'by category',
          formatCountSummary(result.summary.byCategory, 'category'),
        ],
        ['by rule', formatCountSummary(result.summary.byRule, 'rule')],
        ['by project', formatCountSummary(result.summary.byProject, 'project')],
        [
          'by source plugin',
          formatCountSummary(result.summary.bySourcePlugin, 'sourcePlugin'),
        ],
      ],
    }),
  );
  appendReportScopeText(lines, result.scope);

  lines.push('');
  lines.push('Violations');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Violation', 'Details'],
      rows: result.violations.map((violation) => [
        `${violation.ruleId} @ ${readViolationProjectKey(violation)}`,
        [
          `severity=${violation.severity}`,
          `category=${violation.category}`,
          `message=${violation.message}`,
          `sourcePlugin=${violation.sourcePluginId ?? 'none'}`,
        ].join(' :: '),
      ]),
    }),
  );

  return lines.join('\n');
}

function renderAgovRecommendationsTable(
  result: AgovRecommendationsResult,
): string {
  const lines: string[] = [];

  lines.push('agov recommendations');
  lines.push('');
  lines.push('Summary');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.workspace.name],
        ['profile', result.profile],
        ['total', String(result.summary.total)],
        [
          'by priority',
          formatCountSummary(result.summary.byPriority, 'priority'),
        ],
        ['highest priority', result.summary.highestPriority],
      ],
    }),
  );
  appendReportScopeText(lines, result.scope);

  const groupedRecommendations = groupRecommendationsByPriority(result);

  for (const group of groupedRecommendations) {
    lines.push('');
    lines.push(`Recommendations (${group.priority})`);
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Recommendation', 'Details'],
        rows: group.recommendations.map((recommendation) => [
          recommendation.id,
          [
            `priority=${recommendation.priority}`,
            `title=${recommendation.title}`,
            `reason=${recommendation.reason}`,
          ].join(' :: '),
        ]),
      }),
    );
  }

  return lines.join('\n');
}

function renderAgovSignalsTable(result: AgovSignalsResult): string {
  const lines: string[] = [];

  lines.push('agov signals');
  lines.push('');
  lines.push('Summary');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.workspace.name],
        ['profile', result.profile],
        ['total', String(result.summary.total)],
        ['by source', formatCountSummary(result.summary.bySource, 'source')],
        ['by type', formatCountSummary(result.summary.byType, 'type')],
        [
          'by severity',
          formatCountSummary(result.summary.bySeverity, 'severity'),
        ],
        ['extension signal count', String(result.summary.extensionSignalCount)],
      ],
    }),
  );
  appendReportScopeText(lines, result.scope);

  lines.push('');
  lines.push('Signals');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Signal', 'Details'],
      rows: result.signals.map((signal) => [
        signal.id,
        [
          `severity=${signal.severity}`,
          `source=${signal.source}`,
          `type=${signal.type}`,
          readSignalSourceProjectId(signal)
            ? `sourceProject=${readSignalSourceProjectId(signal)}`
            : undefined,
          readSignalTargetProjectId(signal)
            ? `targetProject=${readSignalTargetProjectId(signal)}`
            : undefined,
          signal.sourcePluginId
            ? `sourcePlugin=${signal.sourcePluginId}`
            : undefined,
          `message=${signal.message}`,
        ]
          .filter((part): part is string => Boolean(part))
          .join(' :: '),
      ]),
    }),
  );

  lines.push('');
  lines.push('Signal Breakdown');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['total', String(result.signalBreakdown.total)],
        [
          'by source',
          formatCountSummary(result.signalBreakdown.bySource, 'source'),
        ],
        ['by type', formatCountSummary(result.signalBreakdown.byType, 'type')],
        [
          'by severity',
          formatCountSummary(result.signalBreakdown.bySeverity, 'severity'),
        ],
      ],
    }),
  );

  return lines.join('\n');
}

function renderAgovViolationsMarkdown(result: AgovViolationsResult): string {
  const lines: string[] = [];

  lines.push('# agov violations');
  lines.push('');
  lines.push('## Summary');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.workspace.name],
        ['profile', result.profile],
        ['total', String(result.summary.total)],
        [
          'by severity',
          formatCountSummary(result.summary.bySeverity, 'severity'),
        ],
        [
          'by category',
          formatCountSummary(result.summary.byCategory, 'category'),
        ],
        ['by rule', formatCountSummary(result.summary.byRule, 'rule')],
        ['by project', formatCountSummary(result.summary.byProject, 'project')],
        [
          'by source plugin',
          formatCountSummary(result.summary.bySourcePlugin, 'sourcePlugin'),
        ],
      ],
    }),
  );
  appendReportScopeMarkdown(lines, result.scope);

  lines.push('');
  lines.push('## Violations');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: [
        'severity',
        'rule',
        'category',
        'project',
        'message',
        'source plugin',
      ],
      rows: result.violations.map((violation) => [
        violation.severity,
        violation.ruleId,
        violation.category,
        readViolationProjectKey(violation),
        violation.message,
        violation.sourcePluginId ?? 'none',
      ]),
    }),
  );

  return lines.join('\n');
}

function renderAgovRecommendationsMarkdown(
  result: AgovRecommendationsResult,
): string {
  const lines: string[] = [];

  lines.push('# agov recommendations');
  lines.push('');
  lines.push('## Summary');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.workspace.name],
        ['profile', result.profile],
        ['total', String(result.summary.total)],
        [
          'by priority',
          formatCountSummary(result.summary.byPriority, 'priority'),
        ],
        ['highest priority', result.summary.highestPriority],
      ],
    }),
  );
  appendReportScopeMarkdown(lines, result.scope);

  const groupedRecommendations = groupRecommendationsByPriority(result);

  for (const group of groupedRecommendations) {
    lines.push('');
    lines.push(`## Recommendations (${group.priority})`);
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['priority', 'id', 'title', 'reason'],
        rows: group.recommendations.map((recommendation) => [
          recommendation.priority,
          recommendation.id,
          recommendation.title,
          recommendation.reason,
        ]),
      }),
    );
  }

  return lines.join('\n');
}

function renderAgovSignalsMarkdown(result: AgovSignalsResult): string {
  const lines: string[] = [];

  lines.push('# agov signals');
  lines.push('');
  lines.push('## Summary');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['workspace', result.workspace.name],
        ['profile', result.profile],
        ['total', String(result.summary.total)],
        ['by source', formatCountSummary(result.summary.bySource, 'source')],
        ['by type', formatCountSummary(result.summary.byType, 'type')],
        [
          'by severity',
          formatCountSummary(result.summary.bySeverity, 'severity'),
        ],
        ['extension signal count', String(result.summary.extensionSignalCount)],
      ],
    }),
  );
  appendReportScopeMarkdown(lines, result.scope);

  lines.push('');
  lines.push('## Signals');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: [
        'id',
        'severity',
        'source',
        'type',
        'source project',
        'target project',
        'source plugin',
        'message',
      ],
      rows: result.signals.map((signal) => [
        signal.id,
        signal.severity,
        signal.source,
        signal.type,
        readSignalSourceProjectId(signal) || 'none',
        readSignalTargetProjectId(signal) || 'none',
        signal.sourcePluginId ?? 'none',
        signal.message,
      ]),
    }),
  );

  lines.push('');
  lines.push('## Signal Breakdown');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [
        ['total', String(result.signalBreakdown.total)],
        [
          'by source',
          formatCountSummary(result.signalBreakdown.bySource, 'source'),
        ],
        ['by type', formatCountSummary(result.signalBreakdown.byType, 'type')],
        [
          'by severity',
          formatCountSummary(result.signalBreakdown.bySeverity, 'severity'),
        ],
      ],
    }),
  );

  return lines.join('\n');
}

function groupRecommendationsByPriority(result: AgovRecommendationsResult): {
  priority: string;
  recommendations: AgovRecommendationsResult['recommendations'];
}[] {
  return result.summary.groupedByPriority.map((group) => ({
    priority: group.priority,
    recommendations: result.recommendations.filter(
      (recommendation) => recommendation.priority === group.priority,
    ),
  }));
}

function formatCountSummary<
  T extends { count: number },
  K extends Exclude<keyof T, 'count'>,
>(entries: T[], key: K): string {
  if (entries.length === 0) {
    return 'none';
  }

  return entries
    .map((entry) => `${String(entry[key])}:${entry.count}`)
    .join(', ');
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

function formatProjectCountSummary(
  entries: Array<{ projectId: string; projectName: string; count: number }>,
): string {
  if (entries.length === 0) {
    return 'none';
  }

  return entries
    .map((entry) => `${entry.projectName}(${entry.projectId}):${entry.count}`)
    .join(', ');
}

function readViolationProjectKey(violation: Violation): string {
  return violation.subjectId ?? violation.reference?.nodeId ?? 'unknown';
}

function readSignalSourceProjectId(signal: GovernanceSignal): string {
  return signal.nodeId ?? '';
}

function readSignalTargetProjectId(signal: GovernanceSignal): string {
  const sourceNodeId = signal.nodeId;
  return (
    signal.relatedNodeIds?.find((nodeId) => nodeId !== sourceNodeId) ?? ''
  );
}

function compactJson(value: unknown): string {
  return reportingPrimitives
    .renderJsonValue(value, { stable: true })
    .replaceAll('\n', ' ');
}
