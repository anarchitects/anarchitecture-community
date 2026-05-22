import type { GovernanceCapability } from '../core/index.js';

export interface GovernanceCapabilityRegistry {
  has(id: string): boolean;
  get<TData = unknown>(id: string): GovernanceCapability<TData> | undefined;
  list(): GovernanceCapability[];
}

export class DefaultGovernanceCapabilityRegistry
  implements GovernanceCapabilityRegistry
{
  private readonly capabilitiesById = new Map<string, GovernanceCapability>();
  private readonly capabilities: readonly GovernanceCapability[];

  constructor(capabilities: readonly GovernanceCapability[]) {
    const normalizedCapabilities = capabilities.map((capability) =>
      Object.freeze({ ...capability }),
    );

    for (const capability of normalizedCapabilities) {
      if (this.capabilitiesById.has(capability.id)) {
        throw new Error(
          `Duplicate governance capability id "${capability.id}" is not allowed.`,
        );
      }

      this.capabilitiesById.set(capability.id, capability);
    }

    this.capabilities = Object.freeze([...normalizedCapabilities]);
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
}
