import type {
  GovernanceSignal,
  GovernanceSignalCategory,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
} from '../evaluation/signals.js';
import type {
  GovernanceAuthority,
  GovernanceConfidence,
  GovernanceEvidence,
  GovernancePerspective,
  GovernanceSource,
} from '../adapter/adapter.js';

export interface GovernanceWorkspace {
  id: string;
  name: string;
  root: string;
  projects: GovernanceProject[];
  dependencies: GovernanceDependency[];
}

export interface GovernanceProject {
  id: string;
  name: string;
  root: string;
  type: 'application' | 'library' | 'tool' | 'unknown';
  tags: string[];
  domain?: string;
  layer?: string;
  ownership?: Ownership;
  metadata: Record<string, unknown>;
}

export interface GovernanceDependency {
  source: string;
  target: string;
  type: 'static' | 'dynamic' | 'implicit' | 'unknown';
  sourceFile?: string;
}

export interface Ownership {
  team?: string;
  contacts?: string[];
  source: 'project-metadata' | 'codeowners' | 'merged' | 'none';
}

export interface GovernanceRuntimeReference {
  nodeId?: string;
  relationId?: string;
  relatedNodeIds?: string[];
  relatedRelationIds?: string[];
  projectId?: string;
  targetProjectId?: string;
  relatedProjectIds?: string[];
}

export interface GovernanceAssessmentScope {
  workspaceId?: string;
  nodeIds?: string[];
  relationIds?: string[];
  projectIds?: string[];
  perspectives?: GovernancePerspective[];
  metadata?: Record<string, unknown>;
}

export interface GovernanceFinding {
  id: string;
  type: string;
  severity: GovernanceSignalSeverity;
  category: GovernanceSignalCategory | (string & {});
  message: string;
  reference?: GovernanceRuntimeReference;
  perspective?: GovernancePerspective;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  recommendation?: string;
  sourcePluginId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface Violation {
  id: string;
  ruleId: string;
  project: string;
  severity: 'error' | 'warning' | 'info';
  category:
    | GovernanceSignalCategory
    | 'architecture'
    | 'documentation'
    | 'convention'
    | 'metadata';
  message: string;
  details?: Record<string, unknown>;
  recommendation?: string;
  sourcePluginId?: string;
  reference?: GovernanceRuntimeReference;
  perspective?: GovernancePerspective;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
}

export type KnownGovernanceMetricFamily =
  | 'architecture'
  | 'boundaries'
  | 'ownership'
  | 'documentation';

export type GovernanceMetricFamily =
  | KnownGovernanceMetricFamily
  | (string & {});

export interface Measurement {
  id: string;
  name: string;
  family: GovernanceMetricFamily;
  value: number;
  score: number;
  maxScore: number;
  unit: 'ratio' | 'count' | 'score';
  sourcePluginId?: string;
  dimensions?: Record<string, string | number | boolean>;
  signalIds?: GovernanceSignal['id'][];
  findingIds?: GovernanceFinding['id'][];
  perspective?: GovernancePerspective;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

export interface Recommendation {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  description?: string;
  category?: string;
  reference?: GovernanceRuntimeReference;
  perspective?: GovernancePerspective;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  findingIds?: GovernanceFinding['id'][];
  signalIds?: GovernanceSignal['id'][];
  measurementIds?: Measurement['id'][];
  metadata?: Record<string, unknown>;
}

export type HealthStatus = 'good' | 'warning' | 'critical';

export interface HealthStatusThresholds {
  goodMinScore: number;
  warningMinScore: number;
}

export interface HealthMetricHotspot {
  id: Measurement['id'];
  name: string;
  score: number;
}

export interface HealthProjectHotspot {
  project: string;
  count: number;
  dominantIssueTypes: GovernanceSignalType[];
}

export interface HealthExplainability {
  summary: string;
  statusReason: string;
  weakestMetrics: HealthMetricHotspot[];
  dominantIssues: GovernanceTopIssue[];
}

export interface HealthScore {
  score: number;
  status: HealthStatus;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  hotspots: string[];
  metricHotspots: HealthMetricHotspot[];
  projectHotspots: HealthProjectHotspot[];
  explainability: HealthExplainability;
  dimensions?: GovernanceScore[];
  metadata?: Record<string, unknown>;
}

export interface GovernanceScore {
  id: string;
  name: string;
  value: number;
  maxScore: number;
  family?: GovernanceMetricFamily | (string & {});
  status?: HealthStatus | (string & {});
  grade?: HealthScore['grade'] | (string & {});
  measurementIds?: Measurement['id'][];
  findingIds?: GovernanceFinding['id'][];
  signalIds?: GovernanceSignal['id'][];
  perspective?: GovernancePerspective;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

export interface SignalBreakdownEntry {
  source: GovernanceSignalSource;
  count: number;
}

export interface SignalTypeBreakdownEntry {
  type: GovernanceSignalType;
  count: number;
}

export interface SignalSeverityBreakdownEntry {
  severity: GovernanceSignalSeverity;
  count: number;
}

export interface SignalBreakdown {
  total: number;
  bySource: SignalBreakdownEntry[];
  byType: SignalTypeBreakdownEntry[];
  bySeverity: SignalSeverityBreakdownEntry[];
}

export interface MetricBreakdownMeasurement {
  id: Measurement['id'];
  name: string;
  score: number;
}

export interface MetricBreakdownFamily {
  family: GovernanceMetricFamily;
  score: number;
  measurements: MetricBreakdownMeasurement[];
}

export interface MetricBreakdown {
  families: MetricBreakdownFamily[];
}

export interface GovernanceTopIssue {
  type: GovernanceSignalType;
  source: GovernanceSignalSource;
  severity: GovernanceSignalSeverity;
  count: number;
  projects: string[];
  ruleId?: string;
  message: string;
  sourcePluginId?: string;
}

export interface GovernanceExceptionSummary {
  declaredCount: number;
  matchedCount: number;
  suppressedPolicyViolationCount: number;
  suppressedConformanceFindingCount: number;
  unusedExceptionCount: number;
  activeExceptionCount: number;
  staleExceptionCount: number;
  expiredExceptionCount: number;
  reactivatedPolicyViolationCount: number;
  reactivatedConformanceFindingCount: number;
}

export type GovernanceExceptionStatus = 'active' | 'stale' | 'expired';

export interface GovernanceExceptionUsage {
  id: string;
  source: 'policy' | 'conformance';
  status: GovernanceExceptionStatus;
  reason: string;
  owner: string;
  review: import('../diagnostics/exceptions.js').GovernanceExceptionReview;
  matchCount: number;
}

export interface GovernanceExceptionFinding {
  kind: 'policy-violation' | 'conformance-finding';
  exceptionId: string;
  source: 'policy' | 'conformance';
  status: GovernanceExceptionStatus;
  ruleId?: string;
  category:
    | GovernanceSignalCategory
    | 'architecture'
    | 'documentation'
    | 'convention'
    | 'metadata';
  severity: GovernanceSignalSeverity;
  projectId?: string;
  targetProjectId?: string;
  relatedProjectIds: string[];
  message: string;
  sourcePluginId?: string;
}

export interface GovernanceExceptionReport {
  summary: GovernanceExceptionSummary;
  used: GovernanceExceptionUsage[];
  unused: GovernanceExceptionUsage[];
  suppressedFindings: GovernanceExceptionFinding[];
  reactivatedFindings: GovernanceExceptionFinding[];
}

export interface GovernanceAssessment {
  workspace: GovernanceWorkspace;
  profile: string;
  warnings: string[];
  exceptions: GovernanceExceptionReport;
  violations: Violation[];
  findings?: GovernanceFinding[];
  signals?: GovernanceSignal[];
  measurements: Measurement[];
  scores?: GovernanceScore[];
  scope?: GovernanceAssessmentScope;
  perspectives?: GovernancePerspective[];
  signalBreakdown: SignalBreakdown;
  metricBreakdown: MetricBreakdown;
  topIssues: GovernanceTopIssue[];
  health: HealthScore;
  recommendations: Recommendation[];
  metadata?: Record<string, unknown>;
}

export interface SnapshotViolation {
  type: string;
  source: string;
  target?: string;
  ruleId?: string;
  severity?: Violation['severity'];
  message?: string;
}

export interface SnapshotHealth {
  score: HealthScore['score'];
  status: HealthScore['status'];
  grade: HealthScore['grade'];
}

export interface SnapshotDeliveryImpactIndex {
  id: string;
  score: number;
  risk: 'low' | 'medium' | 'high';
}

export interface SnapshotDeliveryImpactDriver {
  id: string;
  label: string;
  value?: number | string;
  score?: number;
  unit?: 'ratio' | 'count' | 'score';
  trend?: 'improving' | 'stable' | 'worsening';
}

export interface SnapshotDeliveryImpactSummary {
  indices: SnapshotDeliveryImpactIndex[];
  topDrivers: SnapshotDeliveryImpactDriver[];
}

export interface MetricSnapshot {
  timestamp: string;
  repo: string;
  branch: string;
  commitSha: string;
  pluginVersion: string;
  metricSchemaVersion: string;
  metrics: Record<string, number>;
  scores: Record<string, number>;
  violations: SnapshotViolation[];
  health?: SnapshotHealth;
  signalBreakdown?: SignalBreakdown;
  metricBreakdown?: MetricBreakdown;
  topIssues?: GovernanceTopIssue[];
  deliveryImpact?: SnapshotDeliveryImpactSummary;
}

export interface SnapshotMetricDelta {
  id: string;
  baseline: number;
  current: number;
  delta: number;
}

export interface SnapshotHealthDelta {
  baselineScore: number;
  currentScore: number;
  scoreDelta: number;
  baselineStatus: HealthStatus;
  currentStatus: HealthStatus;
  baselineGrade: HealthScore['grade'];
  currentGrade: HealthScore['grade'];
}

export interface SnapshotSignalSourceDelta {
  source: GovernanceSignalSource;
  baseline: number;
  current: number;
  delta: number;
}

export interface SnapshotSignalTypeDelta {
  type: GovernanceSignalType;
  baseline: number;
  current: number;
  delta: number;
}

export interface SnapshotSignalSeverityDelta {
  severity: GovernanceSignalSeverity;
  baseline: number;
  current: number;
  delta: number;
}

export interface SnapshotSignalDeltas {
  bySource: SnapshotSignalSourceDelta[];
  byType: SnapshotSignalTypeDelta[];
  bySeverity: SnapshotSignalSeverityDelta[];
}

export interface SnapshotMetricFamilyDelta {
  family: GovernanceMetricFamily;
  baseline: number;
  current: number;
  delta: number;
}

export interface SnapshotTopIssueDelta {
  type: GovernanceSignalType;
  source: GovernanceSignalSource;
  severity: GovernanceSignalSeverity;
  ruleId?: string;
  message: string;
  baselineCount: number;
  currentCount: number;
  delta: number;
  projects: string[];
}

export interface SnapshotDeliveryImpactIndexDelta {
  id: string;
  baselineScore: number;
  currentScore: number;
  scoreDelta: number;
  baselineRisk: SnapshotDeliveryImpactIndex['risk'];
  currentRisk: SnapshotDeliveryImpactIndex['risk'];
}

export interface SnapshotComparison {
  baseline: MetricSnapshot;
  current: MetricSnapshot;
  metricDeltas: SnapshotMetricDelta[];
  scoreDeltas: SnapshotMetricDelta[];
  newViolations: SnapshotViolation[];
  resolvedViolations: SnapshotViolation[];
  healthDelta?: SnapshotHealthDelta;
  signalDeltas?: SnapshotSignalDeltas;
  metricFamilyDeltas?: SnapshotMetricFamilyDelta[];
  topIssueDeltas?: SnapshotTopIssueDelta[];
  deliveryImpactIndexDeltas?: SnapshotDeliveryImpactIndexDelta[];
}

export type DriftSignalKind =
  | 'workspace-health'
  | 'metric-score'
  | 'metric-family'
  | 'signal-source'
  | 'signal-type'
  | 'signal-severity'
  | 'top-issue'
  | 'violation-footprint';

export interface DriftSignal {
  id: string;
  kind: DriftSignalKind;
  label: string;
  status: 'worsening' | 'stable' | 'improving';
  magnitude: number;
  baseline: number;
  current: number;
  delta: number;
  details?: Record<string, unknown>;
}

export interface DriftSummary {
  overallTrend: DriftSignal['status'];
  worseningCount: number;
  improvingCount: number;
  stableCount: number;
  topWorsening: DriftSignal[];
  topImproving: DriftSignal[];
}

export interface CognitiveLoadSignal {
  id: string;
  name: string;
  value: number;
  score: number;
  weight: number;
  unit: 'ratio' | 'count' | 'score';
  details?: Record<string, unknown>;
}

export interface CognitiveLoadAssessment {
  overallScore: number;
  risk: 'low' | 'medium' | 'high';
  signals: CognitiveLoadSignal[];
  hotspots: string[];
}

export interface AiAnalysisRequest {
  kind:
    | 'root-cause'
    | 'drift'
    | 'pr-impact'
    | 'scorecard'
    | 'management-insights'
    | 'cognitive-load'
    | 'onboarding'
    | 'recommendations'
    | 'smell-clusters'
    | 'refactoring-suggestions';
  generatedAt: string;
  profile: string;
  inputs: {
    snapshot?: MetricSnapshot;
    comparison?: SnapshotComparison;
    topViolations?: SnapshotViolation[];
    dependencies?: GovernanceDependency[];
    affectedProjects?: string[];
    metadata?: Record<string, unknown>;
  };
}

export interface AiAnalysisFinding {
  id: string;
  title: string;
  detail: string;
  signals: string[];
  confidence?: number;
}

export interface AiAnalysisResult {
  kind: AiAnalysisRequest['kind'];
  summary: string;
  findings: AiAnalysisFinding[];
  recommendations: Recommendation[];
  metadata?: Record<string, unknown>;
}
