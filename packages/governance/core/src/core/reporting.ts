import type {
  GovernanceAuthority,
  GovernanceConfidence,
  GovernanceDiagnostic,
  GovernanceEvidence,
  GovernancePerspective,
  GovernanceSource,
} from './adapter.js';
import type {
  GovernanceAssessment,
  GovernanceAssessmentScope,
  GovernanceFinding,
  GovernanceRuntimeReference,
  GovernanceScore,
  Measurement,
  Recommendation,
  Violation,
} from './models.js';
import type {
  GovernanceConformanceResult,
  GovernanceDriftResult,
} from './rules.js';
import type { GovernanceSignal } from './signals.js';

export type GovernanceReportKind =
  | 'assessment'
  | 'diagnostics'
  | 'conformance'
  | 'drift'
  | 'summary'
  | (string & {});

export type GovernanceReportSectionKind =
  | 'diagnostics'
  | 'findings'
  | 'signals'
  | 'measurements'
  | 'recommendations'
  | 'conformance'
  | 'drift'
  | 'summary'
  | (string & {});

export type GovernanceReportSeverity =
  | 'info'
  | 'warning'
  | 'error'
  | 'critical'
  | (string & {});

export interface GovernanceReportSection {
  id: string;
  title: string;
  kind?: GovernanceReportSectionKind;
  summary?: string;
  diagnostics?: GovernanceDiagnostic[];
  violations?: Violation[];
  findings?: GovernanceFinding[];
  signals?: GovernanceSignal[];
  measurements?: Measurement[];
  scores?: GovernanceScore[];
  recommendations?: Recommendation[];
  conformance?: GovernanceConformanceResult[];
  drift?: GovernanceDriftResult[];
  reference?: GovernanceRuntimeReference;
  perspective?: GovernancePerspective;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

export interface GovernanceConformanceReport {
  id: string;
  title?: string;
  summary?: string;
  results: GovernanceConformanceResult[];
  diagnostics?: GovernanceDiagnostic[];
  recommendations?: Recommendation[];
  perspectives?: GovernancePerspective[];
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

export interface GovernanceDriftReport {
  id: string;
  title?: string;
  summary?: string;
  sourcePerspective?: GovernancePerspective;
  targetPerspective?: GovernancePerspective;
  severity?: GovernanceReportSeverity;
  rationale?: string;
  results: GovernanceDriftResult[];
  diagnostics?: GovernanceDiagnostic[];
  recommendations?: Recommendation[];
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

/**
 * Canonical reporting data shape. It is intentionally renderer-agnostic:
 * hosts and CLIs can render this later without Core depending on UI concerns.
 */
export interface GovernanceReport {
  id: string;
  title: string;
  kind: GovernanceReportKind;
  summary?: string;
  generatedAt?: string;
  scope?: GovernanceAssessmentScope;
  assessment?: GovernanceAssessment;
  sections?: GovernanceReportSection[];
  diagnostics?: GovernanceDiagnostic[];
  violations?: Violation[];
  findings?: GovernanceFinding[];
  signals?: GovernanceSignal[];
  measurements?: Measurement[];
  scores?: GovernanceScore[];
  recommendations?: Recommendation[];
  conformance?: GovernanceConformanceReport[];
  drift?: GovernanceDriftReport[];
  perspectives?: GovernancePerspective[];
  sources?: GovernanceSource[];
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}
