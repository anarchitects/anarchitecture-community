import type {
  GovernanceWorkspace,
  Measurement,
  Violation,
} from '../core/index.js';
import type { GovernanceSignal } from '../core/signals.js';
import type {
  GovernanceExtensionDefinition,
  GovernanceExtensionHost as GovernanceExtensionHostContract,
  GovernanceExtensionHostContext,
  GovernanceMetricProvider,
  GovernanceMetricProviderInput,
  GovernanceExtensionRulePack,
  GovernanceRulePackInput,
  GovernanceSignalProvider,
  GovernanceSignalProviderInput,
  GovernanceWorkspaceEnricher,
  GovernanceWorkspaceEnricherInput,
} from './contracts.js';
import type { GovernanceExtensionDiagnostic } from './diagnostics.js';

interface RegisteredGovernanceContribution<T> {
  pluginId: string;
  contribution: T;
}

export interface GovernanceExtensionRegistry {
  metricProviders: RegisteredGovernanceContribution<GovernanceMetricProvider>[];
  signalProviders: RegisteredGovernanceContribution<GovernanceSignalProvider>[];
  rulePacks: RegisteredGovernanceContribution<GovernanceExtensionRulePack>[];
  enrichers: RegisteredGovernanceContribution<GovernanceWorkspaceEnricher>[];
}

export interface GovernanceLoadedExtension {
  sourceSpecifier: string;
  moduleSpecifier: string;
  legacy?: boolean;
  definition: GovernanceExtensionDefinition;
}

export interface RegisterLoadedGovernanceExtensionsOptions {
  diagnostics?: readonly GovernanceExtensionDiagnostic[];
}

export interface GovernanceExtensionRegistrationResult {
  registry: GovernanceExtensionRegistry;
  diagnostics: GovernanceExtensionDiagnostic[];
}

export class GovernanceExtensionRegistrationError extends Error {
  readonly diagnostics: GovernanceExtensionDiagnostic[];

  constructor(message: string, diagnostics: GovernanceExtensionDiagnostic[]) {
    super(message);
    this.name = 'GovernanceExtensionRegistrationError';
    this.diagnostics = diagnostics;
  }
}

export class GovernanceExtensionHost
  implements GovernanceExtensionHostContract
{
  readonly context: GovernanceExtensionHostContext;

  private readonly registry: GovernanceExtensionRegistry = {
    metricProviders: [],
    signalProviders: [],
    rulePacks: [],
    enrichers: [],
  };

  private readonly pluginId: string;

  constructor(context: GovernanceExtensionHostContext, pluginId: string) {
    this.context = Object.freeze({
      ...context,
      options: Object.freeze({ ...context.options }),
    });
    this.pluginId = pluginId;
  }

  registerMetricProvider(metricProvider: GovernanceMetricProvider): void {
    this.registry.metricProviders.push({
      pluginId: this.pluginId,
      contribution: metricProvider,
    });
  }

  registerSignalProvider(signalProvider: GovernanceSignalProvider): void {
    this.registry.signalProviders.push({
      pluginId: this.pluginId,
      contribution: signalProvider,
    });
  }

  registerRulePack(rulePack: GovernanceExtensionRulePack): void {
    this.registry.rulePacks.push({
      pluginId: this.pluginId,
      contribution: rulePack,
    });
  }

  registerEnricher(enricher: GovernanceWorkspaceEnricher): void {
    this.registry.enrichers.push({
      pluginId: this.pluginId,
      contribution: enricher,
    });
  }

  toRegistry(): GovernanceExtensionRegistry {
    return {
      metricProviders: [...this.registry.metricProviders],
      signalProviders: [...this.registry.signalProviders],
      rulePacks: [...this.registry.rulePacks],
      enrichers: [...this.registry.enrichers],
    };
  }
}

export async function registerLoadedGovernanceExtensions(
  context: GovernanceExtensionHostContext,
  extensions: readonly GovernanceLoadedExtension[],
): Promise<GovernanceExtensionRegistry> {
  const result = await registerLoadedGovernanceExtensionsWithDiagnostics(
    context,
    extensions,
  );
  return result.registry;
}

export async function registerLoadedGovernanceExtensionsWithDiagnostics(
  context: GovernanceExtensionHostContext,
  extensions: readonly GovernanceLoadedExtension[],
  options: RegisterLoadedGovernanceExtensionsOptions = {},
): Promise<GovernanceExtensionRegistrationResult> {
  const registry: GovernanceExtensionRegistry = {
    metricProviders: [],
    signalProviders: [],
    rulePacks: [],
    enrichers: [],
  };
  const diagnostics = [...(options.diagnostics ?? [])];
  const seenExtensionIds = new Map<string, string>();

  for (const extension of extensions) {
    try {
      validateGovernanceExtensionId(extension);
    } catch (error) {
      diagnostics.push({
        code: 'governance.extension.invalid_definition',
        severity: 'error',
        message: toErrorMessage(error),
        packageName: extension.sourceSpecifier,
        moduleSpecifier: extension.moduleSpecifier,
        legacy: extension.legacy,
      });
      throw new GovernanceExtensionRegistrationError(
        toErrorMessage(error),
        diagnostics,
      );
    }

    const previousModule = seenExtensionIds.get(extension.definition.id);
    if (previousModule) {
      const message = `Duplicate governance extension id "${extension.definition.id}" was found in "${previousModule}" and "${extension.moduleSpecifier}".`;
      diagnostics.push({
        code: 'governance.extension.duplicate_id',
        severity: 'error',
        message,
        packageName: extension.sourceSpecifier,
        moduleSpecifier: extension.moduleSpecifier,
        extensionId: extension.definition.id,
        legacy: extension.legacy,
      });
      throw new GovernanceExtensionRegistrationError(message, diagnostics);
    }

    seenExtensionIds.set(extension.definition.id, extension.moduleSpecifier);

    try {
      const host = new GovernanceExtensionHost(
        context,
        extension.definition.id,
      );
      await extension.definition.register(host);
      mergeRegistry(registry, host.toRegistry());
    } catch (error) {
      const message = `Governance extension "${
        extension.definition.id
      }" from "${
        extension.moduleSpecifier
      }" failed during registration: ${toErrorMessage(error)}`;
      diagnostics.push({
        code: 'governance.extension.registration_failed',
        severity: 'error',
        message,
        packageName: extension.sourceSpecifier,
        moduleSpecifier: extension.moduleSpecifier,
        extensionId: extension.definition.id,
        legacy: extension.legacy,
      });
      throw new GovernanceExtensionRegistrationError(message, diagnostics);
    }
  }

  return {
    registry,
    diagnostics,
  };
}

export async function applyGovernanceEnrichers(
  registry: GovernanceExtensionRegistry,
  input: GovernanceWorkspaceEnricherInput,
): Promise<GovernanceWorkspace> {
  let workspace = input.workspace;

  for (const enricher of registry.enrichers) {
    const enrichedWorkspace = await enricher.contribution.enrichWorkspace({
      ...input,
      workspace,
    });
    workspace = enrichedWorkspace;
  }

  return workspace;
}

export async function evaluateGovernanceRulePacks(
  registry: GovernanceExtensionRegistry,
  input: GovernanceRulePackInput,
): Promise<Violation[]> {
  const violations = await Promise.all(
    registry.rulePacks.map(async (rulePack) => {
      const providedViolations = await rulePack.contribution.evaluate(input);
      return providedViolations.map((violation) => ({
        ...violation,
        sourcePluginId: violation.sourcePluginId ?? rulePack.pluginId,
      }));
    }),
  );

  return violations.flat();
}

export async function collectGovernanceSignals(
  registry: GovernanceExtensionRegistry,
  input: GovernanceSignalProviderInput,
): Promise<GovernanceSignal[]> {
  const signals = await Promise.all(
    registry.signalProviders.map(async (signalProvider) => {
      const providedSignals =
        await signalProvider.contribution.provideSignals(input);
      return providedSignals.map((signal) => ({
        ...signal,
        source: 'extension' as const,
        sourcePluginId: signal.sourcePluginId ?? signalProvider.pluginId,
      }));
    }),
  );

  return signals.flat();
}

export async function collectGovernanceMeasurements(
  registry: GovernanceExtensionRegistry,
  input: GovernanceMetricProviderInput,
): Promise<Measurement[]> {
  const measurements = await Promise.all(
    registry.metricProviders.map(async (metricProvider) => {
      const providedMeasurements =
        await metricProvider.contribution.provideMetrics(input);
      return providedMeasurements.map((measurement) => ({
        ...measurement,
        sourcePluginId: measurement.sourcePluginId ?? metricProvider.pluginId,
      }));
    }),
  );

  return measurements.flat();
}

function mergeRegistry(
  target: GovernanceExtensionRegistry,
  source: GovernanceExtensionRegistry,
): void {
  target.metricProviders.push(...source.metricProviders);
  target.signalProviders.push(...source.signalProviders);
  target.rulePacks.push(...source.rulePacks);
  target.enrichers.push(...source.enrichers);
}

function validateGovernanceExtensionId(
  extension: GovernanceLoadedExtension,
): void {
  if (
    typeof extension.definition.id !== 'string' ||
    extension.definition.id.trim().length === 0
  ) {
    throw new Error(
      `Governance extension module "${extension.moduleSpecifier}" must declare a non-empty "id".`,
    );
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
