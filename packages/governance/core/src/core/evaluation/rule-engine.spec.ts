import type {
  GovernanceConformanceResult,
  GovernanceDriftResult,
  GovernanceRule,
  GovernanceRuleApplicability,
  GovernanceRuleCategory,
  GovernanceRuleContext,
  GovernanceRuleFinding,
  GovernanceRulePack,
  GovernanceRuleResult,
  GovernanceRuleSeverity,
  GovernanceSignal,
  Measurement,
  Violation,
} from '../index.js';
import {
  CORE_BUILT_IN_RULE_PACK_ID,
  coreBuiltInRulePack,
  coreBuiltInRulePacks,
  evaluateRulePack,
  evaluateRules,
} from '../index.js';
import { coreTestWorkspace } from '../../../tests/workspace.fixtures.js';

describe('Core rule engine contracts', () => {
  it('returns empty arrays for an empty rule pack', async () => {
    const emptyRulePack: GovernanceRulePack = {
      id: 'empty',
      name: 'Empty',
      rules: [],
    };

    await expect(
      evaluateRulePack(emptyRulePack, {
        workspace: coreTestWorkspace,
      }),
    ).resolves.toEqual({
      violations: [],
      signals: [],
      measurements: [],
    });
  });

  it('executes rules in provided order', async () => {
    const callOrder: string[] = [];
    const rules: GovernanceRule[] = [
      testRule('rule-one', () => {
        callOrder.push('rule-one');
        return {};
      }),
      testRule('rule-two', () => {
        callOrder.push('rule-two');
        return {};
      }),
    ];

    await evaluateRules(rules, {
      workspace: coreTestWorkspace,
    });

    expect(callOrder).toEqual(['rule-one', 'rule-two']);
  });

  it('aggregates violations, signals, and measurements deterministically', async () => {
    const violation: Violation = {
      id: 'domain-violation',
      ruleId: 'domain-boundary',
      subjectId: 'platform-shell',
      severity: 'error',
      category: 'boundary',
      message: 'Platform shell should not depend on booking UI.',
      reference: {
        nodeId: 'platform-shell',
        relatedNodeIds: ['booking-ui', 'platform-shell'],
      },
    };
    const signal: GovernanceSignal = {
      id: 'signal-domain-violation',
      type: 'domain-boundary-violation',
      nodeId: 'platform-shell',
      relatedNodeIds: ['platform-shell', 'booking-ui'],
      severity: 'warning',
      category: 'boundary',
      message: 'Platform shell should not depend on booking UI.',
      source: 'policy',
      createdAt: '2026-05-13T00:00:00.000Z',
    };
    const measurement: Measurement = {
      id: 'boundary-integrity',
      name: 'Boundary Integrity',
      family: 'boundaries',
      value: 0.75,
      score: 75,
      maxScore: 100,
      unit: 'ratio',
    };

    const result = await evaluateRules(
      [
        testRule('aggregate-one', () => ({
          violations: [violation],
        })),
        testRule('aggregate-two', () => ({
          signals: [signal],
        })),
        testRule('aggregate-three', () => ({
          measurements: [measurement],
        })),
      ],
      {
        workspace: coreTestWorkspace,
      },
    );

    expect(result.violations).toEqual([violation]);
    expect(result.signals).toEqual([signal]);
    expect(result.measurements).toEqual([measurement]);
  });

  it('supports multi-perspective rule context and additive rule outputs', async () => {
    const perspective = {
      id: 'implemented-reality',
      name: 'Implemented Reality',
    };
    const source = {
      id: 'source:architecture-catalog',
      name: 'Architecture Catalog',
      type: 'catalog',
    };
    const evidence = [
      {
        id: 'evidence:customer-capability',
        type: 'catalog-record',
        source,
        reference: 'capabilities/customer',
        authority: 'authoritative',
        confidence: 0.9,
      },
    ];
    const applicability = {
      perspectiveIds: ['implemented-reality'],
      capabilityIds: ['capability:graph:nodes'],
      nodeKinds: ['asset'],
      relationKinds: ['traceability'],
      technologies: ['generic'],
      classification: {
        domain: 'customer',
      },
      ownership: {
        team: 'architecture',
      },
    } satisfies GovernanceRuleApplicability;
    const finding = {
      id: 'finding:customer-capability',
      ruleId: 'multi-perspective-rule',
      severity: 'warning',
      category: 'drift',
      message: 'Implemented asset is not aligned with intended capability.',
      nodeId: 'asset:customer-capability',
      relatedNodeIds: ['asset:customer-capability'],
      perspective,
      source,
      evidence,
      authority: 'inferred',
      confidence: 0.7,
    } satisfies GovernanceRuleFinding;
    const metric = {
      id: 'metric:perspective-coverage',
      name: 'Perspective Coverage',
      family: 'architecture',
      value: 1,
      score: 100,
      maxScore: 100,
      unit: 'ratio',
    } satisfies Measurement;
    const conformance = {
      id: 'conformance:customer-capability',
      ruleId: 'multi-perspective-rule',
      status: 'partial',
      expected: {
        nodeId: 'asset:customer-capability',
      },
      observed: {
        relationId: 'relation:customer-capability',
      },
      findingIds: [finding.id],
      perspective,
      source,
      evidence,
      authority: 'inferred',
      confidence: 0.7,
    } satisfies GovernanceConformanceResult;
    const drift = {
      id: 'drift:customer-capability',
      ruleId: 'multi-perspective-rule',
      status: 'drift-detected',
      classification: 'intent-vs-implemented',
      indicator: 'missing-realization',
      intent: {
        nodeId: 'capability:customer',
      },
      implementedReality: {
        nodeId: 'asset:customer-capability',
      },
      findingIds: [finding.id],
      perspective,
      source,
      evidence,
      authority: 'inferred',
      confidence: 0.7,
    } satisfies GovernanceDriftResult;

    const rule: GovernanceRule = {
      id: 'multi-perspective-rule',
      name: 'Multi-Perspective Rule',
      category: 'drift',
      defaultSeverity: 'warning',
      metadata: {
        family: 'architecture-conformance',
      },
      applicability,
      produces: [
        'finding',
        'measurement',
        'recommendation',
        'conformance',
        'drift',
      ],
      evaluate(context) {
        expect(context.nodes?.[0]?.id).toBe('asset:customer-capability');
        expect(context.relations?.[0]?.kind).toBe('traceability');
        expect(context.perspectives?.[0]?.id).toBe('implemented-reality');
        expect(context.evidence?.[0]?.id).toBe('evidence:customer-capability');

        return {
          findings: [finding],
          metrics: [metric],
          recommendations: [
            {
              id: 'recommendation:customer-capability',
              title: 'Review capability realization',
              priority: 'medium',
              reason:
                'The implemented reality does not fully match the intended capability.',
            },
          ],
          conformance: [conformance],
          drift: [drift],
        };
      },
    };

    const result = await evaluateRules([rule], {
      workspace: coreTestWorkspace,
      nodes: [
        {
          id: 'asset:customer-capability',
          kind: 'asset',
          technology: 'generic',
          classification: {
            domain: 'customer',
          },
          ownership: {
            team: 'architecture',
          },
          perspective,
          source,
          evidence,
        },
      ],
      relations: [
        {
          id: 'relation:customer-capability',
          sourceNodeId: 'asset:customer-capability',
          targetNodeId: 'capability:customer',
          kind: 'traceability',
          perspective,
          source,
          evidence,
        },
      ],
      classifications: [
        {
          domain: 'customer',
        },
      ],
      ownership: [
        {
          team: 'architecture',
        },
      ],
      perspectives: [perspective],
      sources: [source],
      evidence,
      capabilities: [
        {
          id: 'capability:graph:nodes',
        },
      ],
      diagnostics: [
        {
          code: 'test.context',
          message: 'Context diagnostic',
        },
      ],
      findings: [],
      signals: [],
      measurements: [],
      assessments: [],
      metadata: {
        executionMode: 'test',
      },
    });

    expect(rule.applicability).toEqual(applicability);
    expect(result.violations).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(result.measurements).toEqual([metric]);
    expect(result.findings).toEqual([finding]);
    expect(result.recommendations).toEqual([
      {
        id: 'recommendation:customer-capability',
        title: 'Review capability realization',
        priority: 'medium',
        reason:
          'The implemented reality does not fully match the intended capability.',
      },
    ]);
    expect(result.conformance).toEqual([conformance]);
    expect(result.drift).toEqual([drift]);
  });

  it('keeps additive rule result primitives serializable as plain data', () => {
    const result = {
      findings: [
        {
          id: 'finding:serializable',
          ruleId: 'serializable-rule',
          severity: 'info',
          category: 'metadata',
          message: 'Serializable finding.',
        },
      ],
      conformance: [
        {
          id: 'conformance:serializable',
          status: 'conformant',
          expected: {
            state: 'documented',
          },
          observed: {
            state: 'documented',
          },
        },
      ],
      drift: [
        {
          id: 'drift:serializable',
          status: 'no-drift',
          classification: 'documented-vs-implemented',
        },
      ],
    } satisfies GovernanceRuleResult;

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('exposes the built-in core rule pack through the core boundary', () => {
    expect(CORE_BUILT_IN_RULE_PACK_ID).toBe('core');
    expect(coreBuiltInRulePack.id).toBe('core');
    expect(coreBuiltInRulePack.rules.map((rule) => rule.id)).toEqual([
      'domain-boundary',
      'layer-boundary',
      'ownership-presence',
      'documentation-gap',
      'project-name-convention',
      'tag-convention',
      'missing-domain',
      'missing-layer',
    ]);
    expect(coreBuiltInRulePacks).toEqual([coreBuiltInRulePack]);
  });
});

function testRule(
  id: string,
  evaluate: (
    context: GovernanceRuleContext,
  ) => ReturnType<GovernanceRule['evaluate']>,
  category: GovernanceRuleCategory = 'structure',
  defaultSeverity: GovernanceRuleSeverity = 'warning',
): GovernanceRule {
  return {
    id,
    name: id,
    category,
    defaultSeverity,
    evaluate,
  };
}
