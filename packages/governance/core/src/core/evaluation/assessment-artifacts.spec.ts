import {
  buildGovernanceAssessmentArtifacts,
  type GovernanceProfile,
  type GovernanceNode,
  type GovernanceRelation,
  type GovernanceWorkspace,
} from '../index.js';
import { coreTestAdapterResult } from '../../../tests/workspace.fixtures.js';

const testProfile: GovernanceProfile = {
  name: 'frontend-layered',
  layers: ['app', 'domain', 'ui'],
  allowedDomainDependencies: {
    platform: ['platform'],
    booking: ['booking'],
  },
  ownership: {
    required: true,
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

  it('keeps violations, signals, and assessment aligned for allowed cross-domain dependencies', async () => {
    const artifacts = await buildGovernanceAssessmentArtifacts({
      workspace: createWorkspace(
        [
          createNode('booking-domain', 'booking'),
          createNode('shared-kernel', 'shared'),
        ],
        [
          createDependencyRelation(
            'relation:booking-domain->shared-kernel',
            'booking-domain',
            'shared-kernel',
          ),
        ],
      ),
      profile: {
        ...testProfile,
        allowedDomainDependencies: {
          booking: ['shared'],
          shared: [],
        },
        ownership: {
          required: false,
        },
      },
      exceptions: [],
      asOf: new Date('2026-05-23'),
    });

    expect(artifacts.violations).toEqual([]);
    expect(artifacts.signals.some((signal) => signal.severity === 'info')).toBe(
      true,
    );
    expect(
      artifacts.signals.some(
        (signal) =>
          signal.type === 'cross-domain-dependency' &&
          signal.severity === 'warning',
      ),
    ).toBe(false);
    expect(artifacts.assessment.topIssues).toEqual([]);
  });

  it('includes top signals only when explicitly requested', async () => {
    const artifacts = await buildGovernanceAssessmentArtifacts({
      workspace: createWorkspace(
        [
          createNode('booking-domain', 'booking'),
          createNode('shared-kernel', 'shared'),
        ],
        [
          createDependencyRelation(
            'relation:booking-domain->shared-kernel',
            'booking-domain',
            'shared-kernel',
          ),
        ],
      ),
      profile: {
        ...testProfile,
        allowedDomainDependencies: {
          booking: ['shared'],
          shared: [],
        },
        ownership: {
          required: false,
        },
      },
      includeTopSignals: true,
      exceptions: [],
      asOf: new Date('2026-05-23'),
    });

    expect(artifacts.assessment.topIssues).toEqual([]);
    expect(
      artifacts.assessment.topSignals?.map((signal) => signal.type),
    ).toEqual(['structural-dependency']);
  });

  it('keeps violations, signals, and assessment aligned for disallowed cross-domain dependencies', async () => {
    const artifacts = await buildGovernanceAssessmentArtifacts({
      workspace: createWorkspace(
        [
          createNode('booking-domain', 'booking'),
          createNode('shared-kernel', 'shared'),
        ],
        [
          createDependencyRelation(
            'relation:booking-domain->shared-kernel',
            'booking-domain',
            'shared-kernel',
          ),
        ],
      ),
      profile: {
        ...testProfile,
        allowedDomainDependencies: {
          booking: [],
          shared: [],
        },
        ownership: {
          required: false,
        },
      },
      exceptions: [],
      asOf: new Date('2026-05-23'),
    });

    expect(artifacts.violations.map((violation) => violation.ruleId)).toContain(
      'domain-boundary',
    );
    expect(
      artifacts.signals.some(
        (signal) =>
          signal.type === 'cross-domain-dependency' &&
          signal.severity === 'warning',
      ),
    ).toBe(true);
    expect(
      artifacts.assessment.topIssues.some(
        (issue) => issue.type === 'cross-domain-dependency',
      ),
    ).toBe(true);
    expect(
      artifacts.assessment.topIssues.some(
        (issue) => issue.type === 'domain-boundary-violation',
      ),
    ).toBe(true);
  });

  it('surfaces built-in metadata and convention violations through policy signals and assessment top issues', async () => {
    const artifacts = await buildGovernanceAssessmentArtifacts({
      workspace: createWorkspace(
        [
          {
            ...createNode('BookingUi', 'booking'),
            name: 'BookingUi',
            tags: ['scope:booking'],
            classification: {
              layer: 'ui',
            },
          },
        ],
        [],
      ),
      profile: {
        ...testProfile,
        ownership: {
          required: false,
        },
        rules: {
          'project-name-convention': {
            enabled: true,
            options: {
              pattern: '^[a-z-]+$',
            },
          },
          'tag-convention': {
            enabled: true,
            options: {
              requiredPrefixes: ['domain'],
              allowedPrefixes: ['domain', 'layer', 'scope'],
            },
          },
          'missing-domain': {
            enabled: true,
            options: {
              required: true,
            },
          },
          'missing-layer': {
            enabled: true,
            options: {
              required: true,
            },
          },
        },
      },
      exceptions: [],
      asOf: new Date('2026-05-23'),
    });

    expect(
      artifacts.violations.map((violation) => violation.ruleId).sort(),
    ).toEqual(['missing-domain', 'project-name-convention', 'tag-convention']);
    expect(
      artifacts.signals
        .filter((signal) => signal.source === 'policy')
        .map((signal) => signal.type)
        .sort(),
    ).toEqual([
      'missing-domain-violation',
      'node-name-convention-violation',
      'tag-convention-violation',
    ]);
    expect(
      artifacts.assessment.topIssues.map((issue) => issue.type).sort(),
    ).toEqual([
      'missing-domain-violation',
      'node-name-convention-violation',
      'tag-convention-violation',
    ]);
  });

  it('surfaces documentation-gap in assessment top issues when documentation completeness is weak', async () => {
    const artifacts = await buildGovernanceAssessmentArtifacts({
      workspace: createWorkspace(
        [
          {
            ...createNode('undocumented-node', 'booking'),
            metadata: {},
          },
        ],
        [],
      ),
      profile: {
        ...testProfile,
        ownership: {
          required: false,
        },
      },
      exceptions: [],
      asOf: new Date('2026-05-23'),
    });

    expect(
      artifacts.measurements.find(
        (measurement) => measurement.id === 'documentation-completeness',
      ),
    ).toMatchObject({
      score: 0,
    });
    expect(
      artifacts.violations.find(
        (violation) => violation.ruleId === 'documentation-gap',
      ),
    ).toMatchObject({
      subjectId: 'undocumented-node',
      reference: {
        nodeId: 'undocumented-node',
      },
    });
    expect(
      artifacts.assessment.topIssues.some(
        (issue) => issue.type === 'documentation-gap',
      ),
    ).toBe(true);
  });
});

function createWorkspace(
  nodes: GovernanceNode[],
  relations: GovernanceRelation[],
): GovernanceWorkspace {
  return {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    nodes,
    relations,
  };
}

function createNode(id: string, domain: string): GovernanceNode {
  return {
    id,
    name: id,
    kind: 'library',
    root: `libs/${id}`,
    classification: {
      domain,
      layer: 'domain',
    },
    tags: [`domain:${domain}`, 'layer:domain'],
    ownership: {
      team: `${domain}-team`,
      source: 'project-metadata',
    },
    metadata: {
      documentation: true,
    },
  };
}

function createDependencyRelation(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
): GovernanceRelation {
  return {
    id,
    sourceNodeId,
    targetNodeId,
    kind: 'dependency',
    metadata: {
      dependencyType: 'static',
    },
  };
}
