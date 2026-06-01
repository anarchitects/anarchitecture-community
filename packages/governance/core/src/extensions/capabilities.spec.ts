import { DefaultGovernanceCapabilityRegistry } from './capabilities.js';
import type { GovernanceCapability } from '../core/index.js';

describe('DefaultGovernanceCapabilityRegistry', () => {
  const capabilities: GovernanceCapability[] = [
    {
      id: 'capability:nx',
    },
    {
      id: 'capability:ownership',
      version: '1',
      source: 'adapter',
      producer: 'manual-workspace',
      data: {
        source: 'codeowners',
      },
      metadata: {
        category: 'ownership',
      },
    },
  ];

  it('stores capabilities and returns them by id', () => {
    const registry = new DefaultGovernanceCapabilityRegistry(capabilities);

    expect(registry.get('capability:nx')).toEqual({
      id: 'capability:nx',
    });
    expect(registry.get<{ source: string }>('capability:ownership')).toEqual({
      id: 'capability:ownership',
      version: '1',
      source: 'adapter',
      producer: 'manual-workspace',
      data: {
        source: 'codeowners',
      },
      metadata: {
        category: 'ownership',
      },
    });
  });

  it('reports capability presence through has()', () => {
    const registry = new DefaultGovernanceCapabilityRegistry(capabilities);

    expect(registry.has('capability:nx')).toBe(true);
    expect(registry.has('capability:missing')).toBe(false);
  });

  it('lists capabilities in insertion order', () => {
    const registry = new DefaultGovernanceCapabilityRegistry(capabilities);

    expect(registry.list()).toEqual(capabilities);
  });

  it('returns a defensive copy from list()', () => {
    const registry = new DefaultGovernanceCapabilityRegistry(capabilities);
    const listed = registry.list();

    listed.pop();

    expect(registry.list()).toEqual(capabilities);
  });

  it('returns missing capabilities gracefully', () => {
    const registry = new DefaultGovernanceCapabilityRegistry(capabilities);

    expect(registry.get('capability:missing')).toBeUndefined();
  });

  it('registers capabilities after construction in insertion order', () => {
    const registry = new DefaultGovernanceCapabilityRegistry();

    registry.register({
      id: 'capability:first',
    });
    registry.add({
      id: 'capability:second',
    });

    expect(registry.list()).toEqual([
      {
        id: 'capability:first',
      },
      {
        id: 'capability:second',
      },
    ]);
  });

  it('queries capabilities by id prefix deterministically', () => {
    const registry = new DefaultGovernanceCapabilityRegistry([
      {
        id: 'capability:data:lineage',
      },
      {
        id: 'capability:ownership',
      },
      {
        id: 'capability:data:catalog',
      },
    ]);

    expect(registry.listByPrefix('capability:data:')).toEqual([
      {
        id: 'capability:data:lineage',
      },
      {
        id: 'capability:data:catalog',
      },
    ]);
    expect(registry.listByPrefix('capability:missing:')).toEqual([]);
  });

  it('returns frozen capability entries from list()', () => {
    const registry = new DefaultGovernanceCapabilityRegistry(capabilities);
    const [firstCapability] = registry.list();

    expect(Object.isFrozen(firstCapability)).toBe(true);
  });

  it('rejects duplicate capability ids', () => {
    expect(
      () =>
        new DefaultGovernanceCapabilityRegistry([
          {
            id: 'capability:nx',
          },
          {
            id: 'capability:nx',
            version: '2',
          },
        ]),
    ).toThrow('Duplicate governance capability id "capability:nx"');
  });
});
