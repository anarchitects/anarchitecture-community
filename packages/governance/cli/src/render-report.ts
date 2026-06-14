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
import type {
  GovernanceNode,
  GovernanceRelation,
  GovernanceSignal,
  Measurement,
  Recommendation,
  Violation,
} from '@anarchitects/governance-core';

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

  lines.push(`agov ${result.command}`);
  lines.push('');
  lines.push('Summary');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['success', result.success ? 'true' : 'false'],
        ['workspace', assessment.workspace.name],
        ['profile', assessment.profile],
        ['health score', String(assessment.health.score)],
        ['health grade', assessment.health.grade],
        ['health status', assessment.health.status],
        ['violation count', String(assessment.violations.length)],
        ['signal count', String(result.artifacts.signals.length)],
        ['measurement count', String(assessment.measurements.length)],
        ['recommendation count', String(assessment.recommendations.length)],
      ],
    }),
  );

  if (assessment.measurements.length > 0) {
    lines.push('');
    lines.push('Measurements');
    lines.push(
      ...reportingPrimitives.renderTextTable({
        headers: [
          'id',
          'name',
          'family',
          'score',
          'value',
          'max score',
          'unit',
          'details',
        ],
        rows: assessment.measurements.map((measurement) => [
          measurement.id,
          measurement.name,
          measurement.family,
          String(measurement.score),
          String(measurement.value),
          String(measurement.maxScore),
          measurement.unit,
          formatMeasurementOverflowDetails(measurement),
        ]),
      }),
    );
  }

  if (assessment.topIssues.length > 0) {
    lines.push('');
    lines.push('Top Issues');
    lines.push(
      ...reportingPrimitives.renderTextTable({
        headers: [
          'severity',
          'type',
          'rule',
          'subjects',
          'source',
          'count',
          'message',
          'source plugin',
        ],
        rows: assessment.topIssues.map((issue) => [
          issue.severity,
          issue.type,
          issue.ruleId ?? '',
          issue.subjects.join(', '),
          issue.source,
          String(issue.count),
          issue.message,
          issue.sourcePluginId ?? '',
        ]),
      }),
    );
  }

  if (assessment.topSignals && assessment.topSignals.length > 0) {
    lines.push('');
    lines.push('Top Signals');
    lines.push(
      ...reportingPrimitives.renderTextTable({
        headers: [
          'severity',
          'type',
          'rule',
          'subjects',
          'source',
          'count',
          'message',
          'source plugin',
        ],
        rows: assessment.topSignals.map((signal) => [
          signal.severity,
          signal.type,
          signal.ruleId ?? '',
          signal.subjects.join(', '),
          signal.source,
          String(signal.count),
          signal.message,
          signal.sourcePluginId ?? '',
        ]),
      }),
    );
  }

  if (assessment.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations');
    lines.push(
      ...reportingPrimitives.renderTextTable({
        headers: [
          'priority',
          'id',
          'title',
          'category',
          'reason',
          'reference',
          'details',
        ],
        rows: assessment.recommendations.map((recommendation) => [
          recommendation.priority,
          recommendation.id,
          recommendation.title,
          recommendation.category ?? '',
          recommendation.reason,
          formatReferenceDetails(recommendation.reference) ?? '',
          formatRecommendationOverflowDetails(recommendation),
        ]),
      }),
    );
  }

  lines.push('');
  lines.push('Explainability');
  lines.push(
    ...reportingPrimitives.renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['summary', assessment.health.explainability.summary],
        ['status reason', assessment.health.explainability.statusReason],
        [
          'weakest metrics',
          assessment.health.explainability.weakestMetrics
            .map((metric) => `${metric.name} (${metric.score})`)
            .join(', '),
        ],
        [
          'dominant issues',
          assessment.health.explainability.dominantIssues
            .map((issue) => `${issue.type} x${issue.count}`)
            .join(', '),
        ],
      ],
    }),
  );

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
  const diagnostics = filterDiagnosticsForStandardOutput(
    result.artifacts.diagnostics,
  );

  if (diagnostics.length > 0) {
    lines.push('');
    lines.push('Diagnostics');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Diagnostic', 'Details'],
        rows: diagnostics.map((diagnostic) => [
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
  const diagnostics = filterDiagnosticsForStandardOutput(
    result.artifacts.diagnostics,
  );

  if (diagnostics.length > 0) {
    lines.push('');
    lines.push('## Diagnostics');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['Diagnostic', 'Details'],
        rows: diagnostics.map((diagnostic) => [
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

function filterDiagnosticsForStandardOutput<T extends { metadata?: unknown }>(
  diagnostics: readonly T[],
): T[] {
  return diagnostics.filter(
    (diagnostic) => readDiagnosticVisibility(diagnostic) !== 'detail',
  );
}

function readDiagnosticVisibility(diagnostic: {
  metadata?: unknown;
}): string | undefined {
  const metadata =
    typeof diagnostic.metadata === 'object' &&
    diagnostic.metadata !== null &&
    !Array.isArray(diagnostic.metadata)
      ? (diagnostic.metadata as Record<string, unknown>)
      : undefined;

  return typeof metadata?.visibility === 'string'
    ? metadata.visibility
    : undefined;
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
  const diagnostics = filterDiagnosticsForStandardOutput(
    result.diagnostics ?? [],
  );

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
        ['node count', String(result.summary.nodeCount)],
        ['relation count', String(result.summary.relationCount)],
        ['error count', String(result.summary.errorCount)],
        ['diagnostic count', String(diagnostics.length)],
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

  if (diagnostics.length > 0) {
    lines.push('');
    lines.push('Diagnostics');
    lines.push(
      ...reportingPrimitives.renderTwoColumnTextTable({
        headers: ['Diagnostic', 'Details'],
        rows: diagnostics.map((diagnostic) => [
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
        ['node count', String(result.summary.nodeCount)],
        ['source node count', String(result.summary.sourceNodeCount)],
        ['target node count', String(result.summary.targetNodeCount)],
        ['top outgoing', formatNodeCountSummary(result.summary.topOutgoing)],
        ['top incoming', formatNodeCountSummary(result.summary.topIncoming)],
      ],
    }),
  );

  lines.push('');
  lines.push('Dependencies');
  lines.push(
    ...reportingPrimitives.renderTextTable({
      headers: [
        'id',
        'source',
        'target',
        'kind',
        'dependency type',
        'source file',
      ],
      rows: result.dependencies.map((dependency) => [
        dependency.id,
        formatNodeLabel(dependency.sourceNodeId, dependency.sourceNodeName),
        formatNodeLabel(dependency.targetNodeId, dependency.targetNodeName),
        dependency.kind,
        dependency.type,
        dependency.sourceFile ?? '',
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
      ...reportingPrimitives.renderTextTable({
        headers: [
          'id',
          'kind',
          'name',
          'path',
          'root',
          'domain',
          'layer',
          'scope',
          'tags',
          'owner',
          'details',
        ],
        rows: result.nodes.map((node) => [
          node.id,
          node.kind,
          node.name ?? '',
          node.path ?? '',
          node.root ?? '',
          readNodeDomain(node),
          readNodeLayer(node),
          readNodeScope(node),
          node.tags.join(', '),
          readNodeOwner(node),
          formatNodeOverflowDetails(node),
        ]),
      }),
    );
  }

  if (result.relations.length > 0) {
    lines.push('');
    lines.push('Relations');
    lines.push(
      ...reportingPrimitives.renderTextTable({
        headers: [
          'id',
          'source',
          'target',
          'kind',
          'dependency type',
          'source file',
          'details',
        ],
        rows: result.relations.map((relation) => [
          relation.id,
          resolveNodeLabel(result, relation.sourceNodeId),
          resolveNodeLabel(result, relation.targetNodeId),
          relation.kind,
          readRelationDependencyType(relation),
          readStringMetadata(relation.metadata, 'sourceFile'),
          formatInspectRelationOverflowDetails(result, relation),
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
          resolveNodeLabel(result, relation.sourceNodeId),
          resolveNodeLabel(result, relation.targetNodeId),
          formatInspectRelationDetails(result, relation),
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
        ['node count', String(result.summary.nodeCount)],
        ['source node count', String(result.summary.sourceNodeCount)],
        ['target node count', String(result.summary.targetNodeCount)],
        ['top outgoing', formatNodeCountSummary(result.summary.topOutgoing)],
        ['top incoming', formatNodeCountSummary(result.summary.topIncoming)],
      ],
    }),
  );

  lines.push('');
  lines.push('## Dependencies');
  lines.push(
    ...reportingPrimitives.renderMarkdownTable({
      headers: ['source', 'target', 'type', 'source file'],
      rows: result.dependencies.map((dependency) => [
        formatNodeLabel(dependency.sourceNodeId, dependency.sourceNodeName),
        formatNodeLabel(dependency.targetNodeId, dependency.targetNodeName),
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
  const diagnostics = filterDiagnosticsForStandardOutput(
    result.diagnostics ?? [],
  );

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
        ['node count', String(result.summary.nodeCount)],
        ['relation count', String(result.summary.relationCount)],
        ['error count', String(result.summary.errorCount)],
        ['diagnostic count', String(diagnostics.length)],
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

  if (diagnostics.length > 0) {
    lines.push('');
    lines.push('## Diagnostics');
    lines.push(
      ...reportingPrimitives.renderMarkdownTable({
        headers: ['code', 'message', 'source', 'details'],
        rows: diagnostics.map((diagnostic) => [
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
    ...reportingPrimitives.renderTextTable({
      headers: [
        'id',
        'name',
        'family',
        'score',
        'value',
        'max score',
        'unit',
        'details',
      ],
      rows: result.measurements.map((measurement) => [
        measurement.id,
        measurement.name,
        measurement.family,
        String(measurement.score),
        String(measurement.value),
        String(measurement.maxScore),
        measurement.unit,
        formatMeasurementOverflowDetails(measurement),
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
        ['by subject', formatCountSummary(result.summary.bySubject, 'subject')],
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
    ...reportingPrimitives.renderTextTable({
      headers: [
        'severity',
        'rule',
        'category',
        'subject',
        'node',
        'relation',
        'message',
        'recommendation',
        'source plugin',
        'details',
      ],
      rows: result.violations.map((violation) => [
        violation.severity,
        violation.ruleId,
        violation.category,
        readViolationSubjectKey(violation),
        violation.reference?.nodeId ?? '',
        violation.reference?.relationId ?? '',
        violation.message,
        violation.recommendation ?? '',
        violation.sourcePluginId ?? '',
        formatViolationOverflowDetails(violation),
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
  if (
    groupedRecommendations.some((group) => group.recommendations.length > 0)
  ) {
    lines.push('');
    lines.push('Recommendations');
    lines.push(
      ...reportingPrimitives.renderTextTable({
        headers: [
          'priority',
          'id',
          'title',
          'category',
          'reason',
          'reference',
          'details',
        ],
        rows: result.recommendations.map((recommendation) => [
          recommendation.priority,
          recommendation.id,
          recommendation.title,
          recommendation.category ?? '',
          recommendation.reason,
          formatReferenceDetails(recommendation.reference) ?? '',
          formatRecommendationOverflowDetails(recommendation),
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
    ...reportingPrimitives.renderTextTable({
      headers: [
        'severity',
        'type',
        'rule',
        'id',
        'source',
        'node',
        'relation',
        'related nodes',
        'message',
        'source plugin',
        'details',
      ],
      rows: result.signals.map((signal) => [
        signal.severity,
        signal.type,
        readSignalRuleId(signal),
        signal.id,
        signal.source,
        signal.nodeId ?? '',
        signal.relationId ?? '',
        signal.relatedNodeIds?.join(', ') ?? '',
        signal.message,
        signal.sourcePluginId ?? '',
        formatSignalOverflowDetails(signal),
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
        ['by subject', formatCountSummary(result.summary.bySubject, 'subject')],
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
        'subject',
        'reference',
        'message',
        'source plugin',
      ],
      rows: result.violations.map((violation) => [
        violation.severity,
        violation.ruleId,
        violation.category,
        readViolationSubjectKey(violation),
        formatReferenceDetails(violation.reference, violation.subjectId) ??
          'none',
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
        headers: ['priority', 'id', 'title', 'reason', 'reference'],
        rows: group.recommendations.map((recommendation) => [
          recommendation.priority,
          recommendation.id,
          recommendation.title,
          recommendation.reason,
          formatReferenceDetails(recommendation.reference) ?? 'none',
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
        'node',
        'relation',
        'related nodes',
        'source plugin',
        'message',
      ],
      rows: result.signals.map((signal) => [
        signal.id,
        signal.severity,
        signal.source,
        signal.type,
        signal.nodeId ?? 'none',
        signal.relationId ?? 'none',
        signal.relatedNodeIds?.join(',') ?? 'none',
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

function formatNodeCountSummary(
  entries: Array<{ nodeId: string; nodeName: string; count: number }>,
): string {
  if (entries.length === 0) {
    return 'none';
  }

  return entries
    .map((entry) => `${entry.nodeName}(${entry.nodeId}):${entry.count}`)
    .join(', ');
}

function readNodeDomain(node: GovernanceNode): string {
  const domain = node.classification?.domain;
  if (typeof domain === 'string' && domain.length > 0) {
    return domain;
  }

  const scope = node.classification?.scope;
  return typeof scope === 'string' && scope.length > 0 ? scope : '';
}

function readNodeLayer(node: GovernanceNode): string {
  const layer = node.classification?.layer;
  return typeof layer === 'string' && layer.length > 0 ? layer : '';
}

function readNodeScope(node: GovernanceNode): string {
  const scope = node.classification?.scope;
  return typeof scope === 'string' && scope.length > 0 ? scope : '';
}

function readNodeOwner(node: GovernanceNode): string {
  if (node.ownership?.team) {
    return node.ownership.team;
  }

  return node.ownership?.contacts?.join(', ') ?? '';
}

function resolveNodeLabel(result: AgovInspectResult, nodeId: string): string {
  const node = result.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    return nodeId;
  }

  return formatNodeLabel(node.id, node.name);
}

function formatNodeLabel(nodeId: string, nodeName?: string): string {
  return nodeName && nodeName !== nodeId ? `${nodeName} (${nodeId})` : nodeId;
}

function formatNodeOverflowDetails(node: GovernanceNode): string {
  return [
    node.technology ? `technology=${node.technology}` : undefined,
    node.sourceSystem ? `sourceSystem=${node.sourceSystem}` : undefined,
    node.source ? `source=${compactJson(node.source)}` : undefined,
    node.perspective
      ? `perspective=${compactJson(node.perspective)}`
      : undefined,
    node.authority ? `authority=${node.authority}` : undefined,
    typeof node.confidence === 'number'
      ? `confidence=${node.confidence}`
      : undefined,
    node.ownership &&
    !node.ownership.team &&
    (node.ownership.contacts?.length ?? 0) > 0
      ? `ownership=${compactJson(node.ownership)}`
      : undefined,
    Object.keys(node.metadata).length > 0
      ? `metadata=${compactJson(node.metadata)}`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' :: ');
}

function readRelationDependencyType(relation: GovernanceRelation): string {
  return (
    readStringMetadata(relation.metadata, 'dependencyType') ||
    readStringMetadata(relation.metadata, 'type')
  );
}

function formatInspectRelationDetails(
  result: AgovInspectResult,
  relation: AgovInspectResult['relations'][number],
): string {
  return [
    formatRelationDetails(relation),
    `sourceNodeId=${relation.sourceNodeId}`,
    `targetNodeId=${relation.targetNodeId}`,
    `sourceNode=${resolveNodeLabel(result, relation.sourceNodeId)}`,
    `targetNode=${resolveNodeLabel(result, relation.targetNodeId)}`,
  ].join(' :: ');
}

function formatInspectRelationOverflowDetails(
  result: AgovInspectResult,
  relation: AgovInspectResult['relations'][number],
): string {
  return [
    Object.keys(relation.metadata).length > 0
      ? `metadata=${compactJson(relation.metadata)}`
      : undefined,
    relation.source ? `source=${compactJson(relation.source)}` : undefined,
    relation.perspective
      ? `perspective=${compactJson(relation.perspective)}`
      : undefined,
    relation.authority ? `authority=${relation.authority}` : undefined,
    typeof relation.confidence === 'number'
      ? `confidence=${relation.confidence}`
      : undefined,
    `source node id=${relation.sourceNodeId}`,
    `target node id=${relation.targetNodeId}`,
    `source node=${resolveNodeLabel(result, relation.sourceNodeId)}`,
    `target node=${resolveNodeLabel(result, relation.targetNodeId)}`,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' :: ');
}

function readViolationSubjectKey(violation: Violation): string {
  return (
    violation.subjectId ??
    violation.reference?.relationId ??
    violation.reference?.nodeId ??
    'unknown'
  );
}

function formatReferenceDetails(
  reference:
    | Violation['reference']
    | AgovRecommendationsResult['recommendations'][number]['reference']
    | undefined,
  subjectId?: string,
): string | undefined {
  if (!reference && !subjectId) {
    return undefined;
  }

  return [
    subjectId ? `subject=${subjectId}` : undefined,
    reference?.nodeId ? `nodeId=${reference.nodeId}` : undefined,
    reference?.relationId ? `relationId=${reference.relationId}` : undefined,
    reference?.relatedNodeIds?.length
      ? `relatedNodeIds=${reference.relatedNodeIds.join(',')}`
      : undefined,
    reference?.relatedRelationIds?.length
      ? `relatedRelationIds=${reference.relatedRelationIds.join(',')}`
      : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' :: ');
}

function formatMeasurementOverflowDetails(measurement: Measurement): string {
  return [
    measurement.sourcePluginId
      ? `sourcePlugin=${measurement.sourcePluginId}`
      : undefined,
    measurement.dimensions
      ? `dimensions=${compactJson(measurement.dimensions)}`
      : undefined,
    measurement.signalIds?.length
      ? `signals=${measurement.signalIds.join(',')}`
      : undefined,
    measurement.findingIds?.length
      ? `findings=${measurement.findingIds.join(',')}`
      : undefined,
    measurement.metadata
      ? `metadata=${compactJson(measurement.metadata)}`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' :: ');
}

function formatViolationOverflowDetails(violation: Violation): string {
  return [
    violation.reference?.relatedNodeIds?.length
      ? `relatedNodeIds=${violation.reference.relatedNodeIds.join(',')}`
      : undefined,
    violation.reference?.relatedRelationIds?.length
      ? `relatedRelationIds=${violation.reference.relatedRelationIds.join(',')}`
      : undefined,
    violation.details ? `details=${compactJson(violation.details)}` : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' :: ');
}

function formatRecommendationOverflowDetails(
  recommendation: Recommendation,
): string {
  return [
    recommendation.description
      ? `description=${recommendation.description}`
      : undefined,
    recommendation.findingIds?.length
      ? `findings=${recommendation.findingIds.join(',')}`
      : undefined,
    recommendation.measurementIds?.length
      ? `measurements=${recommendation.measurementIds.join(',')}`
      : undefined,
    recommendation.signalIds?.length
      ? `signals=${recommendation.signalIds.join(',')}`
      : undefined,
    recommendation.metadata
      ? `metadata=${compactJson(recommendation.metadata)}`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' :: ');
}

function readSignalRuleId(signal: GovernanceSignal): string {
  const ruleId = signal.metadata?.ruleId;
  return typeof ruleId === 'string' && ruleId.length > 0 ? ruleId : '';
}

function formatSignalOverflowDetails(signal: GovernanceSignal): string {
  return [
    `category=${signal.category}`,
    signal.relatedRelationIds?.length
      ? `relatedRelations=${signal.relatedRelationIds.join(',')}`
      : undefined,
    signal.metricIds?.length
      ? `metrics=${signal.metricIds.join(',')}`
      : undefined,
    signal.findingIds?.length
      ? `findings=${signal.findingIds.join(',')}`
      : undefined,
    signal.metadata ? `metadata=${compactJson(signal.metadata)}` : undefined,
    signal.createdAt ? `createdAt=${signal.createdAt}` : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' :: ');
}

function readStringMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function compactJson(value: unknown): string {
  return reportingPrimitives
    .renderJsonValue(value, { stable: true })
    .replaceAll('\n', ' ');
}
