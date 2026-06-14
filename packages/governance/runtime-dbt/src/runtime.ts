import path from 'node:path';

import {
  detectDbtProject,
  isDbtAdapterValidationMode,
  loadDbtArtifacts,
  normalizeDbtArtifacts,
  type DbtAdapterDiagnostic,
  type DbtAdapterInputField,
  type DbtAdapterOptions,
  type DbtGovernanceAdapterInput,
} from '@anarchitects/governance-adapter-dbt';
import {
  applyGovernanceEnrichers,
  buildGovernanceWorkspace,
  collectGovernanceMeasurements,
  collectGovernanceSignals,
  DefaultGovernanceCapabilityRegistry,
  evaluateGovernanceRulePacks,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceDiagnostic,
  type GovernanceExtensionDiagnostic,
  type GovernanceExtensionHost,
  type GovernanceExtensionHostContext,
  type GovernanceLoadedExtension,
  type GovernanceProfile,
  type GovernanceSignal,
  type GovernanceWorkspace,
  type Measurement,
  type Violation,
} from '@anarchitects/governance-core';
import {
  collectDbtGovernanceDiagnostics,
  dbtGovernanceExtension,
  getDbtGovernanceDiagnosticProviders,
} from '@anarchitects/governance-extension-dbt';

import { dbtGovernanceRuntimeMetadata } from './constants.js';
import type {
  DbtGovernanceRuntimeError,
  DbtGovernanceRuntimeInput,
  DbtGovernanceRuntimeResult,
  DbtGovernanceRuntimeResultMetadata,
} from './contracts.js';

const DEFAULT_RUNTIME_PROFILE: GovernanceProfile = {
  name: 'dbt',
  layers: ['staging', 'intermediate', 'marts'],
  allowedDomainDependencies: {},
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

export async function runDbtGovernanceRuntime(
  input: DbtGovernanceRuntimeInput,
): Promise<DbtGovernanceRuntimeResult> {
  const runtimeMetadata = buildRuntimeMetadata(input.runtime);
  const profileResult = resolveRuntimeProfile(input.profile);

  if ('error' in profileResult) {
    return buildErrorResult(profileResult.error, {
      diagnostics: profileResult.diagnostics,
      metadata: {
        ...runtimeMetadata,
      },
    });
  }

  const adapterInputResult = toDbtGovernanceAdapterInput(input);

  if ('error' in adapterInputResult) {
    return buildErrorResult(adapterInputResult.error, {
      diagnostics: adapterInputResult.diagnostics,
      metadata: {
        ...runtimeMetadata,
        profile: {
          name: profileResult.profile.name,
        },
      },
    });
  }

  const detected = detectDbtProject(adapterInputResult.adapterInput);

  if (!detected.supported || !detected.context) {
    return buildErrorResult(
      {
        code: 'governance.runtime.adapter_failed',
        stage: 'adapter',
        message: 'dbt project context could not be resolved.',
        details: {
          operation: 'detectDbtProject',
          supported: detected.supported,
        },
      },
      {
        diagnostics: detected.diagnostics,
        metadata: {
          ...runtimeMetadata,
          profile: {
            name: profileResult.profile.name,
          },
        },
      },
    );
  }

  const loaded = loadDbtArtifacts(detected.context);

  if (!loaded.supported || !loaded.artifacts) {
    return buildErrorResult(
      {
        code: 'governance.runtime.adapter_failed',
        stage: 'adapter',
        message: 'dbt artifacts could not be loaded.',
        details: {
          operation: 'loadDbtArtifacts',
          supported: loaded.supported,
        },
      },
      {
        diagnostics: loaded.diagnostics,
        metadata: {
          ...runtimeMetadata,
          profile: {
            name: profileResult.profile.name,
          },
        },
      },
    );
  }

  const adapterResult = normalizeDbtArtifacts(
    detected.context,
    loaded.artifacts,
  );
  const workspace = buildGovernanceWorkspace(adapterResult);
  const capabilities = new DefaultGovernanceCapabilityRegistry(
    adapterResult.capabilities ?? workspace.capabilities ?? [],
  );
  const extensionContext: GovernanceExtensionHostContext = {
    workspaceRoot: workspace.root,
    profileName: profileResult.profile.name,
    options: input.extension?.options ?? {},
    inventory: workspace,
    capabilities,
  };
  const loadedExtension: GovernanceLoadedExtension = {
    sourceSpecifier: '@anarchitects/governance-extension-dbt',
    moduleSpecifier: '@anarchitects/governance-extension-dbt',
    definition: dbtGovernanceExtension,
  };

  let registration;
  try {
    registration = await registerLoadedGovernanceExtensionsWithDiagnostics(
      extensionContext,
      [loadedExtension],
    );
  } catch (error) {
    const registrationDiagnostics =
      error instanceof Error && 'diagnostics' in error
        ? ((error as { diagnostics?: GovernanceExtensionDiagnostic[] })
            .diagnostics ?? [])
        : [];

    return buildErrorResult(
      {
        code: 'governance.runtime.extension_failed',
        stage: 'extension',
        message: toErrorMessage(error),
        details: {
          operation: 'registerLoadedGovernanceExtensionsWithDiagnostics',
        },
      },
      {
        diagnostics: adapterResult.diagnostics ?? [],
        capabilities: capabilities.list(),
        workspace,
        extensionRegistrationDiagnostics: registrationDiagnostics,
        metadata: {
          ...runtimeMetadata,
          profile: {
            name: profileResult.profile.name,
          },
          ...(adapterResult.metadata ? { adapter: adapterResult.metadata } : {}),
        },
      },
    );
  }

  const discoveryHost = createDiscoveryHost(extensionContext);
  const extensionDiagnosticProviders =
    getDbtGovernanceDiagnosticProviders(discoveryHost);
  const enrichedWorkspace = await applyGovernanceEnrichers(
    registration.registry,
    {
      workspace,
      profile: profileResult.profile,
      context: extensionContext,
    },
  );
  const extensionDiagnostics = await collectDbtGovernanceDiagnostics(
    extensionDiagnosticProviders,
    {
      workspace: enrichedWorkspace,
      profile: profileResult.profile,
      context: extensionContext,
      diagnostics: [],
      signals: [],
      measurements: [],
      violations: [],
    },
  );
  const signals = await collectGovernanceSignals(registration.registry, {
    workspace: enrichedWorkspace,
    profile: profileResult.profile,
    context: extensionContext,
    violations: [],
    signals: [],
  });
  const violations = await evaluateGovernanceRulePacks(registration.registry, {
    workspace: enrichedWorkspace,
    profile: profileResult.profile,
    context: extensionContext,
  });
  const measurements = await collectGovernanceMeasurements(
    registration.registry,
    {
      workspace: enrichedWorkspace,
      profile: profileResult.profile,
      context: extensionContext,
      signals,
      measurements: [],
      violations,
    },
  );

  return {
    ok: true,
    runtime: dbtGovernanceRuntimeMetadata,
    diagnostics: adapterResult.diagnostics ?? [],
    capabilities: capabilities.list(),
    extensionDiagnostics,
    extensionRegistrationDiagnostics: registration.diagnostics,
    violations,
    signals,
    measurements,
    workspace: enrichedWorkspace,
    metadata: {
      ...runtimeMetadata,
      profile: {
        name: profileResult.profile.name,
      },
      ...(adapterResult.metadata ? { adapter: adapterResult.metadata } : {}),
      extension: {
        registeredExtensionIds: collectRegisteredExtensionIds(
          registration.registry,
          registration.diagnostics,
          signals,
          violations,
          measurements,
        ),
        sourcePluginIds: collectSourcePluginIds(
          signals,
          violations,
          measurements,
        ),
        rulePackCount: registration.registry.rulePacks.length,
        signalProviderCount: registration.registry.signalProviders.length,
        metricProviderCount: registration.registry.metricProviders.length,
        enricherCount: registration.registry.enrichers.length,
        diagnosticProviderCount: extensionDiagnosticProviders.length,
        recommendationProviderCount:
          countRecommendationProviders(extensionContext),
      },
    },
  };
}

function resolveRuntimeProfile(
  profileInput: DbtGovernanceRuntimeInput['profile'],
):
  | {
      profile: GovernanceProfile;
      diagnostics: GovernanceDiagnostic[];
    }
  | {
      diagnostics: GovernanceDiagnostic[];
      error: DbtGovernanceRuntimeError;
    } {
  if (!profileInput?.document) {
    return {
      profile: {
        ...DEFAULT_RUNTIME_PROFILE,
        layers: [...DEFAULT_RUNTIME_PROFILE.layers],
        allowedDomainDependencies: {
          ...DEFAULT_RUNTIME_PROFILE.allowedDomainDependencies,
        },
        metrics: {
          ...DEFAULT_RUNTIME_PROFILE.metrics,
        },
      },
      diagnostics: [],
    };
  }

  if (!isRecord(profileInput.document)) {
    return {
      diagnostics: [
        buildRuntimeDiagnostic(
          'governance.runtime.profile_invalid',
          'profile.document must be a JSON object.',
        ),
      ],
      error: {
        code: 'governance.runtime.profile_invalid',
        stage: 'profile',
        message: 'Governance profile input is invalid.',
        details: {
          inputField: 'profile.document',
        },
      },
    };
  }

  const document = profileInput.document;
  const layers =
    readStringArray(document.layers) ?? DEFAULT_RUNTIME_PROFILE.layers;
  const allowedDomainDependencies =
    readStringArrayMap(document.allowedDomainDependencies) ??
    DEFAULT_RUNTIME_PROFILE.allowedDomainDependencies;
  const metrics =
    readNumberRecord(document.metrics) ?? DEFAULT_RUNTIME_PROFILE.metrics;
  const rules = isRecord(document.rules)
    ? (document.rules as GovernanceProfile['rules'])
    : undefined;
  const ownership = isRecord(document.ownership)
    ? document.ownership
    : undefined;
  const health = isRecord(document.health) ? document.health : undefined;
  const statusThresholds = isRecord(health?.statusThresholds)
    ? health.statusThresholds
    : undefined;

  return {
    profile: {
      name:
        typeof document.name === 'string' && document.name.trim().length > 0
          ? document.name
          : DEFAULT_RUNTIME_PROFILE.name,
      ...(typeof document.description === 'string'
        ? { description: document.description }
        : {}),
      layers: [...layers],
      allowedDomainDependencies,
      ...(rules ? { rules } : {}),
      ownership: {
        required:
          typeof ownership?.required === 'boolean'
            ? ownership.required
            : DEFAULT_RUNTIME_PROFILE.ownership.required,
      },
      health: {
        statusThresholds: {
          goodMinScore:
            typeof statusThresholds?.goodMinScore === 'number'
              ? statusThresholds.goodMinScore
              : DEFAULT_RUNTIME_PROFILE.health.statusThresholds.goodMinScore,
          warningMinScore:
            typeof statusThresholds?.warningMinScore === 'number'
              ? statusThresholds.warningMinScore
              : DEFAULT_RUNTIME_PROFILE.health.statusThresholds
                  .warningMinScore,
        },
      },
      metrics,
    },
    diagnostics: [],
  };
}

function toDbtGovernanceAdapterInput(
  input: DbtGovernanceRuntimeInput,
):
  | {
      adapterInput: DbtGovernanceAdapterInput;
      diagnostics: GovernanceDiagnostic[];
    }
  | {
      diagnostics: GovernanceDiagnostic[];
      error: DbtGovernanceRuntimeError;
    } {
  const diagnostics: GovernanceDiagnostic[] = [];
  const options = normalizeAdapterOptions(input.adapter.options, diagnostics);

  if (options === undefined && diagnostics.length > 0) {
    return {
      diagnostics,
      error: {
        code: 'governance.runtime.invalid_input',
        stage: 'input',
        message: 'Runtime adapter input is invalid.',
        details: {
          inputField: 'adapter.options.validationMode',
        },
      },
    };
  }

  return {
    adapterInput: {
      paths: normalizeAdapterPaths(
        input.adapter.paths,
        input.runtime?.workingDirectory,
      ),
      ...(options ? { options } : {}),
    },
    diagnostics,
  };
}

function normalizeAdapterPaths(
  pathsInput: DbtGovernanceRuntimeInput['adapter']['paths'],
  workingDirectory: string | undefined,
): DbtGovernanceAdapterInput['paths'] {
  const baseDirectory = workingDirectory
    ? path.resolve(workingDirectory)
    : undefined;

  return {
    ...(pathsInput.projectDir
      ? { projectDir: resolvePath(pathsInput.projectDir, baseDirectory) }
      : {}),
    ...(pathsInput.dbtProjectPath
      ? {
          dbtProjectPath: resolvePath(
            pathsInput.dbtProjectPath,
            baseDirectory,
          ),
        }
      : {}),
    ...(pathsInput.manifestPath
      ? { manifestPath: resolvePath(pathsInput.manifestPath, baseDirectory) }
      : {}),
    ...(pathsInput.catalogPath
      ? { catalogPath: resolvePath(pathsInput.catalogPath, baseDirectory) }
      : {}),
    ...(pathsInput.runResultsPath
      ? {
          runResultsPath: resolvePath(
            pathsInput.runResultsPath,
            baseDirectory,
          ),
        }
      : {}),
    ...(pathsInput.sourcesPath
      ? { sourcesPath: resolvePath(pathsInput.sourcesPath, baseDirectory) }
      : {}),
  };
}

function resolvePath(
  inputPath: string,
  baseDirectory: string | undefined,
): string {
  if (path.isAbsolute(inputPath) || !baseDirectory) {
    return path.normalize(inputPath);
  }

  return path.resolve(baseDirectory, inputPath);
}

function normalizeAdapterOptions(
  optionsInput: DbtGovernanceRuntimeInput['adapter']['options'] | undefined,
  diagnostics: GovernanceDiagnostic[],
): DbtAdapterOptions | undefined {
  if (!optionsInput) {
    return undefined;
  }

  const validationMode = optionsInput.validationMode;

  if (validationMode === undefined) {
    return undefined;
  }

  if (
    typeof validationMode !== 'string' ||
    !isDbtAdapterValidationMode(validationMode)
  ) {
    diagnostics.push(
      buildAdapterInputDiagnostic(
        'options.validationMode',
        'adapter.options.validationMode must be "strict" or "lenient".',
      ),
    );
    return undefined;
  }

  return {
    validationMode,
  };
}

function buildRuntimeMetadata(
  runtimeInput: DbtGovernanceRuntimeInput['runtime'] | undefined,
): Pick<DbtGovernanceRuntimeResultMetadata, 'runtime'> {
  if (!runtimeInput) {
    return {};
  }

  return {
    runtime: {
      ...(runtimeInput.requestId ? { requestId: runtimeInput.requestId } : {}),
      ...(runtimeInput.workingDirectory
        ? { workingDirectory: path.resolve(runtimeInput.workingDirectory) }
        : {}),
      ...(runtimeInput.dryRun !== undefined
        ? { dryRun: runtimeInput.dryRun }
        : {}),
      ...(runtimeInput.metadata ? { metadata: runtimeInput.metadata } : {}),
    },
  };
}

function buildErrorResult(
  error: DbtGovernanceRuntimeError,
  input: {
    diagnostics: GovernanceDiagnostic[];
    capabilities?: ReturnType<DefaultGovernanceCapabilityRegistry['list']>;
    workspace?: GovernanceWorkspace;
    extensionDiagnostics?: GovernanceDiagnostic[];
    extensionRegistrationDiagnostics?: GovernanceExtensionDiagnostic[];
    metadata?: DbtGovernanceRuntimeResultMetadata;
  },
): DbtGovernanceRuntimeResult {
  return {
    ok: false,
    runtime: dbtGovernanceRuntimeMetadata,
    diagnostics: input.diagnostics,
    capabilities: input.capabilities ?? [],
    ...(input.workspace ? { workspace: input.workspace } : {}),
    ...(input.extensionDiagnostics
      ? { extensionDiagnostics: input.extensionDiagnostics }
      : {}),
    ...(input.extensionRegistrationDiagnostics
      ? {
          extensionRegistrationDiagnostics:
            input.extensionRegistrationDiagnostics,
        }
      : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    error,
  };
}

function buildAdapterInputDiagnostic(
  inputField: DbtAdapterInputField,
  message: string,
): DbtAdapterDiagnostic {
  return {
    code: 'governance.runtime.invalid_input',
    message,
    severity: 'error',
    kind: 'error',
    category: 'configuration',
    source: dbtGovernanceRuntimeMetadata.id,
    inputField,
  };
}

function buildRuntimeDiagnostic(
  code: GovernanceDiagnostic['code'],
  message: string,
): GovernanceDiagnostic {
  return {
    code,
    message,
    severity: 'error',
    kind: 'error',
    category: 'configuration',
    source: dbtGovernanceRuntimeMetadata.id,
  };
}

function createDiscoveryHost(
  context: GovernanceExtensionHostContext,
): GovernanceExtensionHost {
  return {
    context,
    registerRulePack: () => undefined,
    registerSignalProvider: () => undefined,
    registerMetricProvider: () => undefined,
    registerEnricher: () => undefined,
  };
}

function collectRegisteredExtensionIds(
  registry: Awaited<
    ReturnType<typeof registerLoadedGovernanceExtensionsWithDiagnostics>
  >['registry'],
  registrationDiagnostics: GovernanceExtensionDiagnostic[],
  signals: GovernanceSignal[],
  violations: Violation[],
  measurements: Measurement[],
): string[] {
  const ids = new Set<string>();

  registry.rulePacks.forEach((entry) => ids.add(entry.pluginId));
  registry.signalProviders.forEach((entry) => ids.add(entry.pluginId));
  registry.metricProviders.forEach((entry) => ids.add(entry.pluginId));
  registry.enrichers.forEach((entry) => ids.add(entry.pluginId));
  registrationDiagnostics.forEach((diagnostic) => {
    if (diagnostic.extensionId) {
      ids.add(diagnostic.extensionId);
    }
  });
  collectSourcePluginIds(signals, violations, measurements).forEach((id) =>
    ids.add(id),
  );

  return [...ids].sort();
}

function collectSourcePluginIds(
  signals: GovernanceSignal[],
  violations: Violation[],
  measurements: Measurement[],
): string[] {
  const ids = new Set<string>();

  signals.forEach((signal) => {
    if (signal.sourcePluginId) {
      ids.add(signal.sourcePluginId);
    }
  });
  violations.forEach((violation) => {
    if (violation.sourcePluginId) {
      ids.add(violation.sourcePluginId);
    }
  });
  measurements.forEach((measurement) => {
    if (measurement.sourcePluginId) {
      ids.add(measurement.sourcePluginId);
    }
  });

  return [...ids].sort();
}

function countRecommendationProviders(
  context: GovernanceExtensionHostContext,
): number {
  return context.capabilities
    .list()
    .filter((capability) =>
      capability.id.startsWith(
        'capability:governance:extension:dbt:recommendation-provider:',
      ),
    ).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStringArray(value: unknown): string[] | undefined {
  if (
    !Array.isArray(value) ||
    !value.every((entry) => typeof entry === 'string')
  ) {
    return undefined;
  }

  return [...value];
}

function readStringArrayMap(
  value: unknown,
): GovernanceProfile['allowedDomainDependencies'] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).map(([key, dependencyValue]) => {
    const dependencies = readStringArray(dependencyValue);
    return dependencies ? [key, dependencies] : undefined;
  });

  if (entries.some((entry) => entry === undefined)) {
    return undefined;
  }

  return Object.fromEntries(
    entries as [string, string[]][],
  ) as GovernanceProfile['allowedDomainDependencies'];
}

function readNumberRecord(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value);
  if (!entries.every(([, entryValue]) => typeof entryValue === 'number')) {
    return undefined;
  }

  return Object.fromEntries(entries) as Record<string, number>;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
