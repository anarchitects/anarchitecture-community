import type {
  GovernanceAuthority,
  GovernanceConfidence,
  GovernanceEvidence,
  GovernancePerspective,
  GovernanceSource,
} from '../adapter/adapter.js';

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
  | 'structure'
  | (string & {});

export type GovernanceSignalSource =
  | 'graph'
  | 'conformance'
  | 'policy'
  | 'extension';

export interface GovernanceSignal {
  id: string;
  type: GovernanceSignalType;
  nodeId?: string;
  relationId?: string;
  relatedNodeIds?: string[];
  relatedRelationIds?: string[];
  metricIds?: string[];
  findingIds?: string[];
  severity: GovernanceSignalSeverity;
  category: GovernanceSignalCategory;
  message: string;
  metadata?: Record<string, unknown>;
  source: GovernanceSignalSource;
  sourceRef?: GovernanceSource;
  perspective?: GovernancePerspective;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  sourcePluginId?: string;
  createdAt: string;
}
