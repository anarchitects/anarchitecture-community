export type GovernanceConformanceCategory =
  | 'boundary'
  | 'ownership'
  | 'dependency'
  | 'compliance'
  | 'unknown';

export type GovernanceSignalType = KnownGovernanceSignalType | (string & {});

export type KnownGovernanceSignalType =
  | 'structural-dependency'
  | 'cross-domain-dependency'
  | 'missing-domain-context'
  | 'circular-dependency'
  | 'conformance-violation'
  | 'domain-boundary-violation'
  | 'layer-boundary-violation'
  | 'ownership-gap';

export type GovernanceSignalSeverity = 'info' | 'warning' | 'error';

export type GovernanceSignalCategory =
  | GovernanceConformanceCategory
  | 'structure';

export type GovernanceSignalSource =
  | 'graph'
  | 'conformance'
  | 'policy'
  | 'extension';

export interface GovernanceSignal {
  id: string;
  type: GovernanceSignalType;
  sourceProjectId?: string;
  targetProjectId?: string;
  relatedProjectIds: string[];
  severity: GovernanceSignalSeverity;
  category: GovernanceSignalCategory;
  message: string;
  metadata?: Record<string, unknown>;
  source: GovernanceSignalSource;
  sourcePluginId?: string;
  createdAt: string;
}
