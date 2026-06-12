export interface GovernanceExtensionContractIssue {
  code: string;
  message: string;
  severity?: 'info' | 'warning' | 'error';
  path?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceExtensionModelExpansion<TData = unknown> {
  extensionId: string;
  contractVersion: string;
  data: TData;
  diagnostics?: readonly GovernanceExtensionContractIssue[];
  metadata?: Record<string, unknown>;
}

export type GovernanceExtensionModelExpansionMap = Record<
  string,
  GovernanceExtensionModelExpansion
>;

export interface GovernanceExtensionModelExpansionCarrier {
  extensions?: GovernanceExtensionModelExpansionMap;
}

export function getGovernanceExtensionModelExpansion<TData = unknown>(
  carrier: GovernanceExtensionModelExpansionCarrier | undefined,
  extensionId: string,
): GovernanceExtensionModelExpansion<TData> | undefined {
  const expansion = carrier?.extensions?.[extensionId];
  return expansion as GovernanceExtensionModelExpansion<TData> | undefined;
}

export function hasGovernanceExtensionModelExpansion(
  carrier: GovernanceExtensionModelExpansionCarrier | undefined,
  extensionId: string,
): boolean {
  return (
    getGovernanceExtensionModelExpansion(carrier, extensionId) !== undefined
  );
}

export function listGovernanceExtensionModelExpansions(
  carrier: GovernanceExtensionModelExpansionCarrier | undefined,
): GovernanceExtensionModelExpansion[] {
  return Object.values(carrier?.extensions ?? {});
}

export function withGovernanceExtensionModelExpansion<
  TCarrier extends GovernanceExtensionModelExpansionCarrier,
>(carrier: TCarrier, expansion: GovernanceExtensionModelExpansion): TCarrier {
  return {
    ...carrier,
    extensions: {
      ...(carrier.extensions ?? {}),
      [expansion.extensionId]: expansion,
    },
  };
}
