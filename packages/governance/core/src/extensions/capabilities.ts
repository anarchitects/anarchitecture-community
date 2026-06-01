import type { GovernanceCapability } from '../core/index.js';

export interface GovernanceCapabilityRequirement {
  id: string;
  version?: string;
  description?: string;
}

export interface GovernanceCapabilityRegistry {
  has(id: string): boolean;
  get<TData = unknown>(id: string): GovernanceCapability<TData> | undefined;
  list(): GovernanceCapability[];
  listByPrefix?(prefix: string): GovernanceCapability[];
  add?(capability: GovernanceCapability): void;
  register?(capability: GovernanceCapability): void;
}

export class DefaultGovernanceCapabilityRegistry
  implements GovernanceCapabilityRegistry
{
  private readonly capabilitiesById = new Map<string, GovernanceCapability>();
  private readonly capabilities: GovernanceCapability[] = [];

  constructor(capabilities: readonly GovernanceCapability[] = []) {
    for (const capability of capabilities) {
      this.register(capability);
    }
  }

  has(id: string): boolean {
    return this.capabilitiesById.has(id);
  }

  get<TData = unknown>(id: string): GovernanceCapability<TData> | undefined {
    return this.capabilitiesById.get(id) as
      | GovernanceCapability<TData>
      | undefined;
  }

  list(): GovernanceCapability[] {
    return [...this.capabilities];
  }

  listByPrefix(prefix: string): GovernanceCapability[] {
    return this.capabilities.filter((capability) =>
      capability.id.startsWith(prefix),
    );
  }

  add(capability: GovernanceCapability): void {
    this.register(capability);
  }

  register(capability: GovernanceCapability): void {
    if (this.capabilitiesById.has(capability.id)) {
      throw new Error(
        `Duplicate governance capability id "${capability.id}" is not allowed.`,
      );
    }

    const normalizedCapability = Object.freeze({ ...capability });
    this.capabilitiesById.set(normalizedCapability.id, normalizedCapability);
    this.capabilities.push(normalizedCapability);
  }
}
