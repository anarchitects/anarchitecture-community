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
      data: {
        source: 'codeowners',
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
      data: {
        source: 'codeowners',
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
