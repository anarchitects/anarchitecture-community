import {
  buildGovernanceAssessmentArtifacts,
  type GovernanceProfile,
} from '../index.js';
import { coreTestAdapterResult } from '../../../tests/workspace.fixtures.js';

const testProfile: GovernanceProfile = {
  name: 'frontend-layered',
  boundaryPolicySource: 'profile',
  layers: ['app', 'domain', 'ui'],
  allowedDomainDependencies: {
    platform: ['platform'],
    booking: ['booking'],
  },
  ownership: {
    required: true,
    metadataField: 'ownership',
  },
  health: {
    statusThresholds: {
      goodMinScore: 85,
      warningMinScore: 70,
    },
  },
  metrics: {},
};

describe('assessment artifact assembly', () => {
  it('assembles assessment artifacts from adapter-normalized input', async () => {
    const artifacts = await buildGovernanceAssessmentArtifacts({
      workspaceAdapterResult: coreTestAdapterResult,
      profile: testProfile,
      warnings: ['fixture'],
      exceptions: [],
      conformanceFindings: [
        {
          ruleId: 'api-contract',
          nodeId: 'booking-ui',
          relatedNodeIds: ['booking-ui'],
          relatedRelationIds: [],
          category: 'compliance',
          severity: 'warning',
          message: 'Contract mismatch.',
        },
      ],
      asOf: new Date('2026-05-23'),
    });

    expect(artifacts.workspace.nodes).toHaveLength(3);
    expect(artifacts.assessment.profile).toBe('frontend-layered');
    expect(artifacts.signals.length).toBeGreaterThan(0);
    expect(artifacts.measurements.length).toBeGreaterThan(0);
    expect(artifacts.assessment.exceptions.summary.declaredCount).toBe(0);
  });
});
