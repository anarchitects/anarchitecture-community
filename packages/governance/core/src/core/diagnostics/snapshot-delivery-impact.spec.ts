import {
  buildSnapshotDeliveryImpactSummary,
  type DeliveryImpactAssessment,
} from '../index.js';

describe('buildSnapshotDeliveryImpactSummary', () => {
  it('returns empty indices and drivers for an empty delivery-impact assessment', () => {
    const deliveryImpact: DeliveryImpactAssessment = {
      generatedAt: '2026-05-24T10:00:00.000Z',
      profile: 'default',
      indices: [],
      insights: [],
      drivers: [],
    };

    expect(buildSnapshotDeliveryImpactSummary(deliveryImpact)).toEqual({
      indices: [],
      topDrivers: [],
    });
  });

  it('sorts indices deterministically by id and does not mutate the input assessment', () => {
    const deliveryImpact: DeliveryImpactAssessment = {
      generatedAt: '2026-05-24T10:00:00.000Z',
      profile: 'default',
      indices: [
        {
          id: 'time-to-market',
          name: 'Time to Market Risk Index',
          score: 72,
          risk: 'high',
          drivers: [],
        },
        {
          id: 'cost-of-change',
          name: 'Cost of Change Index',
          score: 55,
          risk: 'medium',
          drivers: [],
        },
      ],
      insights: [],
      drivers: [],
    };
    const originalIndices = structuredClone(deliveryImpact.indices);

    const summary = buildSnapshotDeliveryImpactSummary(deliveryImpact);

    expect(summary.indices).toEqual([
      {
        id: 'cost-of-change',
        score: 55,
        risk: 'medium',
      },
      {
        id: 'time-to-market',
        score: 72,
        risk: 'high',
      },
    ]);
    expect(deliveryImpact.indices).toEqual(originalIndices);
  });

  it('limits top drivers to five and preserves driver fields', () => {
    const deliveryImpact: DeliveryImpactAssessment = {
      generatedAt: '2026-05-24T10:00:00.000Z',
      profile: 'default',
      indices: [],
      insights: [],
      drivers: [
        {
          id: 'a',
          label: 'A',
          value: 0.1,
          score: 90,
          unit: 'ratio',
          trend: 'worsening',
          explanation: 'ignored in snapshot summary',
        },
        {
          id: 'b',
          label: 'B',
          value: 4,
          score: 80,
          unit: 'count',
          trend: 'stable',
        },
        {
          id: 'c',
          label: 'C',
          value: 70,
          score: 70,
          unit: 'score',
          trend: 'improving',
        },
        {
          id: 'd',
          label: 'D',
        },
        {
          id: 'e',
          label: 'E',
          value: 'high',
        },
        {
          id: 'f',
          label: 'F',
          score: 10,
        },
      ],
    };
    const originalDrivers = structuredClone(deliveryImpact.drivers);

    const summary = buildSnapshotDeliveryImpactSummary(deliveryImpact);

    expect(summary.topDrivers).toEqual([
      {
        id: 'a',
        label: 'A',
        value: 0.1,
        score: 90,
        unit: 'ratio',
        trend: 'worsening',
      },
      {
        id: 'b',
        label: 'B',
        value: 4,
        score: 80,
        unit: 'count',
        trend: 'stable',
      },
      {
        id: 'c',
        label: 'C',
        value: 70,
        score: 70,
        unit: 'score',
        trend: 'improving',
      },
      {
        id: 'd',
        label: 'D',
        value: undefined,
        score: undefined,
        unit: undefined,
        trend: undefined,
      },
      {
        id: 'e',
        label: 'E',
        value: 'high',
        score: undefined,
        unit: undefined,
        trend: undefined,
      },
    ]);
    expect(deliveryImpact.drivers).toEqual(originalDrivers);
  });
});
