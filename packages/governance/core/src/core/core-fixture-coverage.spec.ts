import type {
  GovernanceAssessment,
  GovernanceAssessmentScope,
  GovernanceClassificationInput,
  GovernanceConformanceReport,
  GovernanceConformanceResult,
  GovernanceDiagnostic,
  GovernanceDriftReport,
  GovernanceDriftResult,
  GovernanceEvidence,
  GovernanceFinding,
  GovernanceNodeInput,
  GovernanceOwnershipInput,
  GovernancePerspective,
  GovernanceReport,
  GovernanceRelationInput,
  GovernanceScore,
  GovernanceSource,
  GovernanceWorkspaceAdapterResult,
  Measurement,
  Recommendation,
  GovernanceSignal,
  GovernanceSignalCategory,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
  Violation,
} from './index.js';
import {
  coreTestAdapterResult,
  coreTestWorkspace,
  coreTestWorkspaceWithDanglingDependency,
  findDanglingDependencies,
} from '../../tests/workspace.fixtures.js';

describe('Core fixtures', () => {
  it('provide a plain governance workspace with valid dependency references', () => {
    expect(coreTestWorkspace.projects).toHaveLength(3);
    expect(coreTestWorkspace.dependencies).toHaveLength(2);
    expect(findDanglingDependencies(coreTestWorkspace)).toEqual([]);
  });

  it('includes an edge-case workspace with a dangling dependency target', () => {
    const danglingDependencies = findDanglingDependencies(
      coreTestWorkspaceWithDanglingDependency,
    );

    expect(danglingDependencies).toHaveLength(1);
    expect(danglingDependencies[0]).toMatchObject({
      source: 'booking-ui',
      target: 'missing-project',
      type: 'static',
    });
  });
});

describe('Core signal contracts', () => {
  it('support plain signal data through the core boundary', () => {
    const category: GovernanceSignalCategory = 'boundary';
    const severity: GovernanceSignalSeverity = 'warning';
    const source: GovernanceSignalSource = 'policy';
    const type: GovernanceSignalType = 'domain-boundary-violation';

    const signal: GovernanceSignal = {
      id: 'signal-domain-boundary',
      type,
      nodeId: 'platform-shell',
      relatedNodeIds: ['platform-shell', 'booking-ui'],
      severity,
      category,
      message: 'Platform shell should not depend on booking UI directly.',
      source,
      createdAt: '2026-05-13T00:00:00.000Z',
    };

    expect(signal).toMatchObject({
      type: 'domain-boundary-violation',
      category: 'boundary',
      severity: 'warning',
      source: 'policy',
    });
  });

  it('support technology-neutral runtime primitive references', () => {
    const perspective = {
      id: 'software-architecture',
      name: 'Software Architecture',
    } satisfies GovernancePerspective;
    const evidence = [
      {
        id: 'evidence:adr-1',
        type: 'adr',
        reference: 'docs/adr/0001.md',
        authority: 'documented',
        confidence: 0.9,
      },
    ] satisfies GovernanceEvidence[];
    const reference = {
      nodeId: 'node:booking-api',
      relationId: 'relation:booking-api->shared-domain',
      relatedNodeIds: ['node:shared-domain'],
    };

    const finding = {
      id: 'finding:traceability-gap',
      type: 'traceability-gap',
      severity: 'warning',
      category: 'architecture',
      message: 'Implementation asset is missing documented traceability.',
      reference,
      perspective,
      evidence,
      authority: 'inferred',
      confidence: 0.7,
      metadata: {
        source: 'fixture',
      },
    } satisfies GovernanceFinding;

    const signal = {
      id: 'signal:traceability-gap',
      type: 'traceability-gap',
      nodeId: 'node:booking-api',
      relationId: 'relation:booking-api->shared-domain',
      relatedNodeIds: ['node:shared-domain'],
      relatedRelationIds: [],
      findingIds: [finding.id],
      severity: 'warning',
      category: 'architecture',
      message: 'Traceability is incomplete.',
      source: 'extension',
      perspective,
      evidence,
      authority: 'inferred',
      confidence: 0.7,
      createdAt: '2026-05-13T00:00:00.000Z',
    } satisfies GovernanceSignal;

    const measurement = {
      id: 'traceability-coverage',
      name: 'Traceability Coverage',
      family: 'architecture',
      value: 0.8,
      score: 80,
      maxScore: 100,
      unit: 'ratio',
      dimensions: {
        perspective: perspective.id,
      },
      signalIds: [signal.id],
      findingIds: [finding.id],
      perspective,
      evidence,
    } satisfies Measurement;

    const score = {
      id: 'architecture-score',
      name: 'Architecture Score',
      value: 80,
      maxScore: 100,
      family: 'architecture',
      measurementIds: [measurement.id],
      findingIds: [finding.id],
      signalIds: [signal.id],
      perspective,
      evidence,
    } satisfies GovernanceScore;

    const scope = {
      workspaceId: coreTestWorkspace.id,
      nodeIds: ['node:booking-api'],
      relationIds: ['relation:booking-api->shared-domain'],
      perspectives: [perspective],
    } satisfies GovernanceAssessmentScope;

    const assessment = {
      workspace: coreTestWorkspace,
      profile: 'runtime-fixture',
      warnings: [],
      exceptions: {
        summary: {
          declaredCount: 0,
          matchedCount: 0,
          suppressedPolicyViolationCount: 0,
          suppressedConformanceFindingCount: 0,
          unusedExceptionCount: 0,
          activeExceptionCount: 0,
          staleExceptionCount: 0,
          expiredExceptionCount: 0,
          reactivatedPolicyViolationCount: 0,
          reactivatedConformanceFindingCount: 0,
        },
        used: [],
        unused: [],
        suppressedFindings: [],
        reactivatedFindings: [],
      },
      violations: [],
      findings: [finding],
      signals: [signal],
      measurements: [measurement],
      scores: [score],
      scope,
      perspectives: [perspective],
      signalBreakdown: {
        total: 1,
        bySource: [{ source: 'extension', count: 1 }],
        byType: [{ type: 'traceability-gap', count: 1 }],
        bySeverity: [{ severity: 'warning', count: 1 }],
      },
      metricBreakdown: {
        families: [
          {
            family: 'architecture',
            score: 80,
            measurements: [
              {
                id: measurement.id,
                name: measurement.name,
                score: measurement.score,
              },
            ],
          },
        ],
      },
      topIssues: [],
      health: {
        score: 80,
        status: 'good',
        grade: 'B',
        hotspots: [],
        metricHotspots: [],
        subjectHotspots: [],
        explainability: {
          summary: 'Architecture traceability is mostly complete.',
          statusReason: 'Score is above threshold.',
          weakestMetrics: [],
          dominantIssues: [],
        },
        dimensions: [score],
      },
      recommendations: [],
      metadata: {
        runtimePrimitiveFixture: true,
      },
    } satisfies GovernanceAssessment;

    const violation = {
      id: 'violation:traceability-gap',
      ruleId: 'traceability-presence',
      subjectId: 'booking-api',
      severity: 'warning',
      category: 'architecture',
      message: 'Traceability is missing.',
      reference,
      perspective,
      evidence,
      authority: 'inferred',
      confidence: 0.7,
    } satisfies Violation;

    expect(assessment.findings?.[0]?.reference?.nodeId).toBe(
      'node:booking-api',
    );
    expect(assessment.signals?.[0]?.findingIds).toEqual([
      'finding:traceability-gap',
    ]);
    expect(assessment.scores?.[0]?.measurementIds).toEqual([
      'traceability-coverage',
    ]);
    expect(violation.evidence?.[0]?.type).toBe('adr');
  });

  it('supports diagnostic, recommendation, and report primitives with evidence linkage', () => {
    const source = {
      id: 'source:catalog',
      name: 'Governance Catalog',
      type: 'catalog',
    } satisfies GovernanceSource;
    const intentPerspective = {
      id: 'domain-intent',
      name: 'Domain Intent',
    } satisfies GovernancePerspective;
    const implementationPerspective = {
      id: 'implemented-reality',
      name: 'Implemented Reality',
    } satisfies GovernancePerspective;
    const evidence = [
      {
        id: 'evidence:catalog-policy',
        type: 'catalog-policy',
        source,
        reference: 'policies/customer-ownership',
        authority: 'authoritative',
        confidence: 0.95,
      },
    ] satisfies GovernanceEvidence[];
    const reference = {
      nodeId: 'node:customer-model',
      relatedNodeIds: ['node:customer-capability'],
    };
    const diagnostic = {
      id: 'diagnostic:ownership-gap',
      code: 'governance.reporting.ownership_gap',
      severity: 'warning',
      kind: 'recommendation',
      category: 'conformance',
      message: 'Catalog ownership and implementation ownership differ.',
      source: 'governance-core',
      reference,
      perspective: implementationPerspective,
      evidence,
      authority: 'inferred',
      confidence: 0.8,
      recommendation: 'Review ownership assignment for the implementation.',
      metadata: {
        reportFixture: true,
      },
    } satisfies GovernanceDiagnostic;
    const recommendation = {
      id: 'recommendation:ownership-gap',
      title: 'Align implementation ownership',
      priority: 'medium',
      reason: 'Ownership differs between catalog intent and implementation.',
      category: 'ownership',
      reference,
      perspective: implementationPerspective,
      source,
      evidence,
      authority: 'inferred',
      confidence: 0.8,
      metadata: {
        remediationType: 'ownership-alignment',
      },
    } satisfies Recommendation;
    const conformance = {
      id: 'conformance:ownership-gap',
      status: 'partial',
      expected: {
        owner: 'customer-platform',
      },
      observed: {
        owner: 'data-platform',
      },
      rationale: 'Catalog owner differs from implementation owner.',
      perspective: implementationPerspective,
      source,
      evidence,
      authority: 'inferred',
      confidence: 0.8,
    } satisfies GovernanceConformanceResult;
    const drift = {
      id: 'drift:ownership-gap',
      status: 'drift-detected',
      classification: 'intent-vs-implemented',
      indicator: 'ownership-mismatch',
      intent: {
        perspectiveId: intentPerspective.id,
      },
      implementedReality: {
        perspectiveId: implementationPerspective.id,
      },
      rationale: 'Intent and implementation ownership do not match.',
      perspective: implementationPerspective,
      source,
      evidence,
      authority: 'inferred',
      confidence: 0.8,
    } satisfies GovernanceDriftResult;
    const conformanceReport = {
      id: 'report:conformance:ownership',
      title: 'Ownership Conformance',
      summary: 'Ownership differs across perspectives.',
      results: [conformance],
      diagnostics: [diagnostic],
      recommendations: [recommendation],
      perspectives: [intentPerspective, implementationPerspective],
      evidence,
      authority: 'inferred',
      confidence: 0.8,
    } satisfies GovernanceConformanceReport;
    const driftReport = {
      id: 'report:drift:ownership',
      title: 'Ownership Drift',
      summary: 'Implemented ownership has drifted from intent.',
      sourcePerspective: intentPerspective,
      targetPerspective: implementationPerspective,
      severity: 'warning',
      rationale: 'Catalog and implementation owners differ.',
      results: [drift],
      diagnostics: [diagnostic],
      recommendations: [recommendation],
      evidence,
      authority: 'inferred',
      confidence: 0.8,
    } satisfies GovernanceDriftReport;
    const report = {
      id: 'report:governance:ownership',
      title: 'Ownership Governance Report',
      kind: 'assessment',
      summary: 'Multi-perspective ownership reporting fixture.',
      generatedAt: '2026-05-13T00:00:00.000Z',
      diagnostics: [diagnostic],
      recommendations: [recommendation],
      conformance: [conformanceReport],
      drift: [driftReport],
      perspectives: [intentPerspective, implementationPerspective],
      sources: [source],
      evidence,
      sections: [
        {
          id: 'section:diagnostics',
          title: 'Diagnostics',
          kind: 'diagnostics',
          diagnostics: [diagnostic],
          recommendations: [recommendation],
          perspective: implementationPerspective,
          evidence,
        },
      ],
      authority: 'inferred',
      confidence: 0.8,
      metadata: {
        rendererAgnostic: true,
      },
    } satisfies GovernanceReport;

    expect(diagnostic.evidence?.[0]?.id).toBe('evidence:catalog-policy');
    expect(recommendation.reference?.nodeId).toBe('node:customer-model');
    expect(conformanceReport.results[0]?.status).toBe('partial');
    expect(driftReport.results[0]?.classification).toBe(
      'intent-vs-implemented',
    );
    expect(report.sections?.[0]?.kind).toBe('diagnostics');
  });
});

describe('Core adapter contract coverage', () => {
  it('exports technology-neutral graph input contracts through the core boundary', () => {
    const classification = {
      domain: 'customer',
      boundedContext: 'account-management',
      capability: 'identity',
      layer: 'data',
      scope: 'internal',
      system: 'customer-platform',
      product: 'customer-portal',
      tags: ['critical'],
      metadata: {
        classificationKind: 'example',
      },
    } satisfies GovernanceClassificationInput;

    const ownership = {
      team: 'customer-platform',
      contacts: ['customer-platform@example.com'],
      stewards: ['data-steward@example.com'],
      productOwner: 'product-owner@example.com',
      technicalOwner: 'technical-owner@example.com',
      businessOwner: 'business-owner@example.com',
      source: 'catalog',
      metadata: {
        ownershipKind: 'example',
      },
    } satisfies GovernanceOwnershipInput;

    const perspective = {
      id: 'implemented-reality',
      name: 'Implemented Reality',
      description: 'Facts discovered from implementation artifacts.',
    } satisfies GovernancePerspective;

    const source = {
      id: 'source:catalog',
      name: 'Catalog',
      type: 'governance-catalog',
      metadata: {
        endpoint: 'catalog',
      },
    } satisfies GovernanceSource;

    const evidence = [
      {
        id: 'evidence:asset-a',
        type: 'catalog-entry',
        source,
        reference: 'assets/a',
        description: 'Catalog entry for Asset A.',
        authority: 'authoritative',
        confidence: 1,
        metadata: {
          sourceVersion: '1',
        },
      },
    ] satisfies GovernanceEvidence[];

    const node = {
      id: 'asset-a',
      name: 'Asset A',
      kind: 'asset',
      technology: 'data-platform',
      sourceSystem: 'catalog',
      path: 'assets/a',
      tags: ['critical'],
      classification,
      ownership,
      perspective,
      source,
      evidence,
      authority: 'discovered',
      confidence: 0.95,
      metadata: {
        sourceKind: 'example',
      },
    } satisfies GovernanceNodeInput;

    const relation = {
      sourceNodeId: 'asset-a',
      targetNodeId: 'asset-b',
      kind: 'lineage',
      perspective,
      source,
      evidence,
      authority: 'inferred',
      confidence: 0.75,
      metadata: {
        relationKind: 'example',
      },
    } satisfies GovernanceRelationInput;

    expect(node.kind).toBe('asset');
    expect(node.classification?.domain).toBe('customer');
    expect(node.ownership?.team).toBe('customer-platform');
    expect(node.perspective?.id).toBe('implemented-reality');
    expect(node.evidence?.[0]?.authority).toBe('authoritative');
    expect(relation.sourceNodeId).toBe('asset-a');
    expect(relation.confidence).toBe(0.75);
  });

  it('supports plain adapter result data through the core boundary', () => {
    const adapterResult: GovernanceWorkspaceAdapterResult = {
      ...coreTestAdapterResult,
      nodes: [
        {
          id: 'asset-a',
          kind: 'asset',
        },
      ],
      relations: [
        {
          sourceNodeId: 'asset-a',
          targetNodeId: 'booking-ui',
          kind: 'traceability',
        },
      ],
      capabilities: [
        {
          id: 'capability:test-fixture',
          version: '1',
          source: 'adapter',
          producer: 'core-fixture',
          data: {
            origin: 'core-fixture',
          },
          metadata: {
            category: 'fixture',
          },
        },
      ],
      diagnostics: [
        {
          code: 'fixture-warning',
          message: 'Fixture diagnostic',
          source: 'test',
        },
      ],
    };

    expect(adapterResult.nodes).toHaveLength(1);
    expect(adapterResult.relations).toHaveLength(1);
    expect(adapterResult.nodes?.[0]?.id).toBe('asset-a');
    expect(adapterResult.relations?.[0]?.kind).toBe('traceability');
    expect(adapterResult.capabilities?.[0]?.id).toBe('capability:test-fixture');
    expect(adapterResult.capabilities?.[0]?.source).toBe('adapter');
    expect(adapterResult.diagnostics?.[0]?.code).toBe('fixture-warning');
  });

  it('keeps adapter result capabilities optional', () => {
    const adapterResult: GovernanceWorkspaceAdapterResult = {
      nodes: [],
      relations: [],
    };

    expect(adapterResult.capabilities).toBeUndefined();
  });
});
