import type {
  AiAnalysisRequest,
  AiAnalysisResult,
  DriftSignal,
  DriftSummary,
  GovernanceDependency,
  GovernanceProject,
  MetricSnapshot,
  SnapshotViolation,
} from './models.js';
import { buildDriftSummary } from './drift.js';
import {
  compareGovernanceViolationsForPriority,
  sliceGovernancePayloadItems,
} from './ai-payload.js';

export interface GovernancePrImpactContext {
  changedFilesCount: number;
  affectedProjects: string[];
  affectedProjectsCount: number;
  affectedDomains: string[];
  affectedDomainCount: number;
  scopedDependencyCount: number;
  crossDomainDependencyEdges: number;
}

export interface FanoutProjectSummary {
  project: string;
  fanout: number;
}

export interface GovernanceCognitiveLoadContext {
  scope: string;
  selectedProjects: string[];
  selectedProjectsCount: number;
  affectedDomains: string[];
  affectedDomainCount: number;
  scopedDependencyCount: number;
  crossDomainDependencyEdges: number;
  averageFanout: number;
  maxFanout: number;
  topFanoutProjects: FanoutProjectSummary[];
  project?: string;
  domain?: string;
}

export interface GovernanceRecommendationsTrendContext {
  overallTrend: DriftSignal['status'];
  worseningSignalCount: number;
  improvingSignalCount: number;
  stableSignalCount: number;
  signalCount: number;
  snapshotCount: number;
  trendWindowInsufficient: boolean;
}

export interface GovernancePersistentSmellSignal {
  type: string;
  source: string;
  count: number;
}

export interface HotspotProjectSummary {
  project: string;
  count: number;
}

export interface GovernanceRefactoringSuggestionsContext {
  analyzedViolations: number;
  totalViolations: number;
  hotspotProjects: HotspotProjectSummary[];
  highFanoutProjects: HotspotProjectSummary[];
  hotspotDomains: string[];
  persistentSmellSignals: GovernancePersistentSmellSignal[];
  snapshotCount: number;
  sampledSnapshotCount: number;
}

export interface DomainCountSummary {
  domain: string;
  count: number;
}

export interface LayerCountSummary {
  layer: string;
  count: number;
}

export interface GovernanceOnboardingContext {
  projectCount: number;
  dependencyCount: number;
  ownershipCoverage: number;
  domainSummary: DomainCountSummary[];
  layerSummary: LayerCountSummary[];
  topFanoutProjects: HotspotProjectSummary[];
  analyzedViolations: number;
  totalViolations: number;
}

export interface BuildPrImpactContextInput {
  affectedProjects: readonly string[] | readonly GovernanceProject[];
  dependencies: readonly GovernanceDependency[];
  projects?: readonly GovernanceProject[];
  changedFiles?: readonly string[];
  changedFilesCount?: number;
}

export interface BuildCognitiveLoadContextInput {
  selectedProjects: readonly string[] | readonly GovernanceProject[];
  dependencies: readonly GovernanceDependency[];
  projects?: readonly GovernanceProject[];
  scope?: string;
  project?: string;
  domain?: string;
  topProjectsLimit?: number;
}

export interface BuildRecommendationsTrendContextInput {
  signals: readonly DriftSignal[];
  summary?: DriftSummary;
  snapshotCount?: number;
}

export interface BuildPersistentSmellSignalsInput {
  recentSnapshots: readonly MetricSnapshot[];
  minimumOccurrences?: number;
}

export interface BuildRefactoringSuggestionsContextInput {
  violations: readonly SnapshotViolation[];
  dependencies: readonly GovernanceDependency[];
  projects: readonly GovernanceProject[];
  recentSnapshots?: readonly MetricSnapshot[];
  topProjectsLimit?: number;
  analyzedViolationsLimit?: number;
  minimumPersistentOccurrences?: number;
}

export interface BuildOnboardingContextInput {
  projects: readonly GovernanceProject[];
  dependencies: readonly GovernanceDependency[];
  topViolations?: readonly SnapshotViolation[];
  topProjectsLimit?: number;
  totalViolationsCount?: number;
}

export function summarizeDriftInterpretation(
  request: AiAnalysisRequest,
  signals: readonly DriftSignal[],
  summary: DriftSummary,
): AiAnalysisResult {
  const findings = signals.map((signal) => ({
    id: `drift-${signal.id}`,
    title: signal.label,
    detail: `Status is ${signal.status} with delta ${formatSignedDelta(
      signal.delta,
    )} and magnitude ${signal.magnitude.toFixed(3)}.`,
    signals: ['drift-analysis', 'snapshot-comparison'],
    confidence: 1,
  }));

  return {
    kind: 'drift',
    summary: `Deterministic drift interpretation indicates a ${summary.overallTrend} trend (${summary.worseningCount} worsening, ${summary.improvingCount} improving, ${summary.stableCount} stable).`,
    findings,
    recommendations: [
      {
        id: 'drift-review-regressing-signals',
        title: 'Review Regressing Signals First',
        priority: summary.worseningCount > 0 ? 'high' : 'low',
        reason:
          summary.worseningCount > 0
            ? `There are ${summary.worseningCount} worsening drift signals. Prioritize investigation of those signals before broader refactoring.`
            : 'No worsening drift signals were detected in this comparison window.',
      },
      {
        id: 'drift-validate-trend-window',
        title: 'Validate Trend Window Confidence',
        priority: 'medium',
        reason: isTrendWindowInsufficient(request)
          ? 'Fewer than four snapshots were available. Treat conclusions as provisional and continue collecting trend data.'
          : 'Trend window is sufficient for directional interpretation. Continue monitoring for persistence across future snapshots.',
      },
    ],
    metadata: {
      trend: summary.overallTrend,
      worseningCount: summary.worseningCount,
      improvingCount: summary.improvingCount,
      stableCount: summary.stableCount,
      signalCount: signals.length,
      topWorsening: summary.topWorsening,
      topImproving: summary.topImproving,
      ...request.inputs.metadata,
    },
  };
}

export const buildDriftInterpretationAnalysis = summarizeDriftInterpretation;

export function buildPrImpactContext(
  input: BuildPrImpactContextInput,
): GovernancePrImpactContext {
  const selection = resolveProjectSelection(
    input.affectedProjects,
    input.projects,
  );
  const scopedDependencies = input.dependencies.filter(
    (dependency) =>
      selection.projectNames.has(dependency.source) ||
      selection.projectNames.has(dependency.target),
  );
  const affectedDomains = uniqueSortedStrings(
    selection.projects
      .map((project) => project.domain)
      .filter((domain): domain is string => Boolean(domain)),
  );

  return {
    changedFilesCount:
      input.changedFilesCount ?? input.changedFiles?.length ?? 0,
    affectedProjects: [...selection.projectNames].sort((left, right) =>
      left.localeCompare(right),
    ),
    affectedProjectsCount: selection.projectNames.size,
    affectedDomains,
    affectedDomainCount: affectedDomains.length,
    scopedDependencyCount: scopedDependencies.length,
    crossDomainDependencyEdges: countCrossDomainDependencies(
      scopedDependencies,
      selection.projectsByName,
    ),
  };
}

export function buildCognitiveLoadContext(
  input: BuildCognitiveLoadContextInput,
): GovernanceCognitiveLoadContext {
  const selection = resolveProjectSelection(
    input.selectedProjects,
    input.projects,
  );
  const scopedDependencies = input.dependencies.filter(
    (dependency) =>
      selection.projectNames.has(dependency.source) ||
      selection.projectNames.has(dependency.target),
  );
  const fanoutByProject = new Map<string, number>();

  for (const dependency of scopedDependencies) {
    if (!selection.projectNames.has(dependency.source)) {
      continue;
    }

    fanoutByProject.set(
      dependency.source,
      (fanoutByProject.get(dependency.source) ?? 0) + 1,
    );
  }

  const fanoutValues = [...fanoutByProject.values()];
  const averageFanout =
    fanoutValues.length > 0
      ? Number(
          (
            fanoutValues.reduce((sum, value) => sum + value, 0) /
            fanoutValues.length
          ).toFixed(2),
        )
      : 0;
  const maxFanout = fanoutValues.length > 0 ? Math.max(...fanoutValues) : 0;
  const affectedDomains = uniqueSortedStrings(
    selection.projects
      .map((project) => project.domain)
      .filter((domain): domain is string => Boolean(domain)),
  );
  const topFanoutProjects = [...fanoutByProject.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, Math.max(1, input.topProjectsLimit ?? 10))
    .map(([project, fanout]) => ({ project, fanout }));

  return {
    scope: input.scope ?? 'workspace',
    ...(input.project ? { project: input.project } : {}),
    ...(input.domain ? { domain: input.domain } : {}),
    selectedProjects: [...selection.projectNames].sort((left, right) =>
      left.localeCompare(right),
    ),
    selectedProjectsCount: selection.projectNames.size,
    affectedDomains,
    affectedDomainCount: affectedDomains.length,
    scopedDependencyCount: scopedDependencies.length,
    crossDomainDependencyEdges: countCrossDomainDependencies(
      scopedDependencies,
      selection.projectsByName,
    ),
    averageFanout,
    maxFanout,
    topFanoutProjects,
  };
}

export function countWorseningDriftSignals(
  signals: readonly DriftSignal[],
): number {
  return signals.filter((signal) => signal.status === 'worsening').length;
}

export function buildRecommendationsTrendContext(
  input: BuildRecommendationsTrendContextInput,
): GovernanceRecommendationsTrendContext {
  const summary = input.summary ?? buildDriftSummary([...input.signals]);
  const snapshotCount = input.snapshotCount ?? 0;

  return {
    overallTrend: summary.overallTrend,
    worseningSignalCount: summary.worseningCount,
    improvingSignalCount: summary.improvingCount,
    stableSignalCount: summary.stableCount,
    signalCount: input.signals.length,
    snapshotCount,
    trendWindowInsufficient: snapshotCount > 0 && snapshotCount < 4,
  };
}

export function buildPersistentSmellSignals(
  input: BuildPersistentSmellSignalsInput,
): GovernancePersistentSmellSignal[] {
  const minimumOccurrences = Math.max(1, input.minimumOccurrences ?? 2);
  const persistentKeyCounts = new Map<string, number>();

  for (const snapshot of input.recentSnapshots) {
    const uniqueKeys = new Set(
      snapshot.violations.map((violation) =>
        buildPersistentViolationKey(violation),
      ),
    );

    for (const key of uniqueKeys) {
      persistentKeyCounts.set(key, (persistentKeyCounts.get(key) ?? 0) + 1);
    }
  }

  return [...persistentKeyCounts.entries()]
    .filter(([, count]) => count >= minimumOccurrences)
    .map(([key, count]) => {
      const [type, source] = key.split('|');
      return {
        type: type ?? 'unknown',
        source: source ?? 'unknown',
        count,
      };
    })
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.type.localeCompare(right.type) ||
        left.source.localeCompare(right.source),
    );
}

export function buildRefactoringSuggestionsContext(
  input: BuildRefactoringSuggestionsContextInput,
): GovernanceRefactoringSuggestionsContext {
  const prioritizedViolations = sliceGovernancePayloadItems(
    input.violations,
    input.analyzedViolationsLimit ?? 10,
    compareGovernanceViolationsForPriority,
  ).items;
  const hotspotCounts = new Map<string, number>();
  for (const violation of prioritizedViolations) {
    hotspotCounts.set(
      violation.source,
      (hotspotCounts.get(violation.source) ?? 0) + 1,
    );
  }

  const fanoutCounts = new Map<string, number>();
  for (const dependency of input.dependencies) {
    fanoutCounts.set(
      dependency.source,
      (fanoutCounts.get(dependency.source) ?? 0) + 1,
    );
  }

  const topProjectsLimit = Math.max(1, input.topProjectsLimit ?? 5);
  const hotspotProjects = [...hotspotCounts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, topProjectsLimit)
    .map(([project, count]) => ({ project, count }));
  const highFanoutProjects = [...fanoutCounts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, topProjectsLimit)
    .map(([project, count]) => ({ project, count }));
  const projectsByName = new Map(
    input.projects.map((project) => [project.name, project] as const),
  );
  const hotspotDomains = uniqueSortedStrings(
    hotspotProjects
      .map((entry) => projectsByName.get(entry.project)?.domain)
      .filter((domain): domain is string => Boolean(domain)),
  );
  const recentSnapshots = input.recentSnapshots ?? [];

  return {
    analyzedViolations: prioritizedViolations.length,
    totalViolations: input.violations.length,
    hotspotProjects,
    highFanoutProjects,
    hotspotDomains,
    persistentSmellSignals: buildPersistentSmellSignals({
      recentSnapshots,
      minimumOccurrences: input.minimumPersistentOccurrences,
    }),
    snapshotCount: recentSnapshots.length,
    sampledSnapshotCount: recentSnapshots.length,
  };
}

export function buildOnboardingContext(
  input: BuildOnboardingContextInput,
): GovernanceOnboardingContext {
  const domainCounts = new Map<string, number>();
  const layerCounts = new Map<string, number>();
  const fanoutCounts = new Map<string, number>();

  for (const project of input.projects) {
    if (project.domain) {
      domainCounts.set(
        project.domain,
        (domainCounts.get(project.domain) ?? 0) + 1,
      );
    }

    if (project.layer) {
      layerCounts.set(project.layer, (layerCounts.get(project.layer) ?? 0) + 1);
    }
  }

  for (const dependency of input.dependencies) {
    fanoutCounts.set(
      dependency.source,
      (fanoutCounts.get(dependency.source) ?? 0) + 1,
    );
  }

  const topProjectsLimit = Math.max(1, input.topProjectsLimit ?? 5);
  const ownedProjectsCount = input.projects.filter((project) =>
    Boolean(project.ownership?.team),
  ).length;
  const analyzedViolations = input.topViolations?.length ?? 0;

  return {
    projectCount: input.projects.length,
    dependencyCount: input.dependencies.length,
    ownershipCoverage:
      input.projects.length > 0
        ? Number((ownedProjectsCount / input.projects.length).toFixed(3))
        : 0,
    domainSummary: [...domainCounts.entries()]
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .map(([domain, count]) => ({ domain, count })),
    layerSummary: [...layerCounts.entries()]
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .map(([layer, count]) => ({ layer, count })),
    topFanoutProjects: [...fanoutCounts.entries()]
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .slice(0, topProjectsLimit)
      .map(([project, count]) => ({ project, count })),
    analyzedViolations,
    totalViolations: input.totalViolationsCount ?? analyzedViolations,
  };
}

function resolveProjectSelection(
  selectedProjects: readonly string[] | readonly GovernanceProject[],
  allProjects: readonly GovernanceProject[] | undefined,
): {
  projectNames: Set<string>;
  projects: GovernanceProject[];
  projectsByName: Map<string, GovernanceProject>;
} {
  const selectedProjectNames = new Set<string>();
  const selectedProjectRecords: GovernanceProject[] = [];
  const selectedProjectByName = new Map<string, GovernanceProject>();

  if (
    selectedProjects.length > 0 &&
    typeof selectedProjects[0] === 'object' &&
    selectedProjects[0] !== null
  ) {
    for (const project of selectedProjects as readonly GovernanceProject[]) {
      selectedProjectNames.add(project.name);
      selectedProjectRecords.push(project);
      selectedProjectByName.set(project.name, project);
    }
  } else {
    const projectLookup = new Map(
      (allProjects ?? []).map((project) => [project.name, project] as const),
    );

    for (const projectName of selectedProjects as readonly string[]) {
      selectedProjectNames.add(projectName);
      const project = projectLookup.get(projectName);
      if (project) {
        selectedProjectRecords.push(project);
        selectedProjectByName.set(project.name, project);
      }
    }
  }

  return {
    projectNames: selectedProjectNames,
    projects: selectedProjectRecords.sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
    projectsByName: selectedProjectByName,
  };
}

function countCrossDomainDependencies(
  dependencies: readonly GovernanceDependency[],
  projectsByName: ReadonlyMap<string, GovernanceProject>,
): number {
  return dependencies.filter((dependency) => {
    const sourceDomain = projectsByName.get(dependency.source)?.domain;
    const targetDomain = projectsByName.get(dependency.target)?.domain;

    return Boolean(
      sourceDomain && targetDomain && sourceDomain !== targetDomain,
    );
  }).length;
}

function buildPersistentViolationKey(violation: SnapshotViolation): string {
  return `${violation.type}|${violation.source}`;
}

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isTrendWindowInsufficient(request: AiAnalysisRequest): boolean {
  return request.inputs.metadata?.trendWindowInsufficient === true;
}

function formatSignedDelta(delta: number): string {
  return `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`;
}
