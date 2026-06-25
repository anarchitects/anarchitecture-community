import { readFile } from 'node:fs/promises';
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
  buildGovernanceAssessment,
  buildGovernanceAssessmentArtifacts,
  buildTopIssues,
  buildGovernanceWorkspace,
  calculateGovernanceHealth,
  DefaultGovernanceCapabilityRegistry,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceDiagnostic,
  type GovernanceExtensionDiagnostic,
  type GovernanceExtensionHost,
  type GovernanceExtensionHostContext,
  type GovernanceLoadedExtension,
  type GovernanceProfile,
  type Recommendation,
  type GovernanceSignal,
  type GovernanceWorkspace,
  type Measurement,
  type Violation,
} from '@anarchitects/governance-core';
import {
  collectDbtGovernanceDiagnostics,
  collectDbtGovernanceRecommendations,
  dbtGovernanceExtension,
  getDbtGovernanceDiagnosticProviders,
  getDbtGovernanceRecommendationProviders,
} from '@anarchitects/governance-extension-dbt';

import {
  DBT_GOVERNANCE_ADAPTER_PACKAGE_NAME,
  DBT_GOVERNANCE_EXTENSION_PACKAGE_NAME,
  DBT_GOVERNANCE_RUNTIME_ID,
  DBT_GOVERNANCE_RUNTIME_PACKAGE_NAME,
  DBT_GOVERNANCE_RUNTIME_VERSION,
  dbtGovernanceRuntimeMetadata,
} from './constants.js';
import type {
  DbtGovernanceRuntimeError,
  DbtGovernanceRuntimeInput,
  DbtGovernanceRuntimeProfileFormat,
  DbtGovernanceRuntimeResult,
  DbtGovernanceRuntimeResultMetadata,
} from './contracts.js';
import { parse as parseYaml } from 'yaml';

const DEFAULT_RUNTIME_PROFILE: GovernanceProfile = {
  name: 'dbt',
  layers: ['staging', 'intermediate', 'marts'],
  allowedDomainDependencies: {},
  rules: {
    'layer-boundary': {
      enabled: false,
    },
    'ownership-presence': {
      enabled: false,
    },
    'documentation-gap': {
      enabled: false,
    },
  },
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
  const generatedAt = new Date().toISOString();
  const runtimeMetadata = buildRuntimeMetadata(input.runtime, generatedAt);
  const profileResult = await resolveRuntimeProfile(
    input.profile,
    input.runtime?.workingDirectory,
  );

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
          ...(adapterResult.metadata
            ? { adapter: adapterResult.metadata }
            : {}),
        },
      },
    );
  }

  const discoveryHost = createDiscoveryHost(extensionContext);
  const extensionDiagnosticProviders =
    getDbtGovernanceDiagnosticProviders(discoveryHost);
  const extensionRecommendationProviders =
    getDbtGovernanceRecommendationProviders(discoveryHost);
  const assessmentArtifacts = await buildGovernanceAssessmentArtifacts({
    profile: profileResult.profile,
    workspace,
    diagnostics: adapterResult.diagnostics ?? [],
    capabilities: capabilities.list(),
    extensionRegistry: registration.registry,
    extensionContext,
    assessmentExtensions: workspace.extensions,
    asOf: new Date(generatedAt),
  });
  const enrichedWorkspace = assessmentArtifacts.workspace;
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
  const warnings = buildWarnings(
    adapterResult.diagnostics ?? [],
    extensionDiagnostics,
  );
  const extensionRecommendations = await collectDbtGovernanceRecommendations(
    extensionRecommendationProviders,
    {
      workspace: enrichedWorkspace,
      profile: profileResult.profile,
      context: extensionContext,
      diagnostics: extensionDiagnostics,
      signals: assessmentArtifacts.signals,
      violations: assessmentArtifacts.violations,
      measurements: assessmentArtifacts.measurements,
      recommendations: [],
    },
  );
  const recommendations = mergeRecommendations(
    assessmentArtifacts.recommendations,
    extensionRecommendations,
  );
  const health = calculateGovernanceHealth(
    assessmentArtifacts.measurements,
    profileResult.profile.metrics,
    profileResult.profile.health.statusThresholds,
    {
      topIssues: buildTopIssues(assessmentArtifacts.signals),
    },
  );
  const assessment = buildGovernanceAssessment({
    workspace: enrichedWorkspace,
    profile: profileResult.profile.name,
    warnings,
    includeTopSignals: assessmentArtifacts.assessment.topSignals !== undefined,
    exceptions: assessmentArtifacts.assessment.exceptions,
    violations: assessmentArtifacts.violations,
    ...(assessmentArtifacts.assessment.findings
      ? { findings: assessmentArtifacts.assessment.findings }
      : {}),
    signals: assessmentArtifacts.signals,
    measurements: assessmentArtifacts.measurements,
    ...(assessmentArtifacts.assessment.scores
      ? { scores: assessmentArtifacts.assessment.scores }
      : {}),
    health,
    recommendations,
    ...(assessmentArtifacts.assessment.scope
      ? { scope: assessmentArtifacts.assessment.scope }
      : {}),
    ...(assessmentArtifacts.assessment.perspectives
      ? { perspectives: assessmentArtifacts.assessment.perspectives }
      : {}),
    ...(assessmentArtifacts.assessment.extensions
      ? { extensions: assessmentArtifacts.assessment.extensions }
      : enrichedWorkspace.extensions
        ? { extensions: enrichedWorkspace.extensions }
        : {}),
    metadata: {
      runtime: runtimeMetadata.runtime,
      adapterDiagnostics: adapterResult.diagnostics ?? [],
      extensionDiagnostics,
    },
  });

  return {
    ok: true,
    runtime: dbtGovernanceRuntimeMetadata,
    diagnostics: adapterResult.diagnostics ?? [],
    capabilities: capabilities.list(),
    extensionDiagnostics,
    extensionRegistrationDiagnostics: registration.diagnostics,
    violations: assessmentArtifacts.violations,
    signals: assessmentArtifacts.signals,
    measurements: assessmentArtifacts.measurements,
    workspace: enrichedWorkspace,
    assessment,
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
          assessmentArtifacts.signals,
          assessmentArtifacts.violations,
          assessmentArtifacts.measurements,
        ),
        sourcePluginIds: collectSourcePluginIds(
          assessmentArtifacts.signals,
          assessmentArtifacts.violations,
          assessmentArtifacts.measurements,
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

async function resolveRuntimeProfile(
  profileInput: DbtGovernanceRuntimeInput['profile'],
  workingDirectory?: string,
): Promise<
  | {
      profile: GovernanceProfile;
      diagnostics: GovernanceDiagnostic[];
    }
  | {
      diagnostics: GovernanceDiagnostic[];
      error: DbtGovernanceRuntimeError;
    }
> {
  const documentResult = await resolveRuntimeProfileDocument(
    profileInput,
    workingDirectory,
  );

  if ('error' in documentResult) {
    return documentResult;
  }

  if (!documentResult.document) {
    return {
      profile: cloneDefaultRuntimeProfile(),
      diagnostics: [],
    };
  }
  const document = documentResult.document;
  const layers =
    readStringArray(document.layers) ?? DEFAULT_RUNTIME_PROFILE.layers;
  const allowedDomainDependencies =
    readStringArrayMap(document.allowedDomainDependencies) ??
    DEFAULT_RUNTIME_PROFILE.allowedDomainDependencies;
  const metrics =
    readNumberRecord(document.metrics) ?? DEFAULT_RUNTIME_PROFILE.metrics;
  const rules = resolveRuntimeRules(document.rules);
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
      rules,
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
              : DEFAULT_RUNTIME_PROFILE.health.statusThresholds.warningMinScore,
        },
      },
      metrics,
    },
    diagnostics: [],
  };
}

async function resolveRuntimeProfileDocument(
  profileInput: DbtGovernanceRuntimeInput['profile'],
  workingDirectory?: string,
): Promise<
  | {
      document?: Record<string, unknown>;
    }
  | {
      diagnostics: GovernanceDiagnostic[];
      error: DbtGovernanceRuntimeError;
    }
> {
  const inlineDocumentResult = normalizeInlineProfileDocument(profileInput);
  if ('error' in inlineDocumentResult) {
    return inlineDocumentResult;
  }

  const pathDocumentResult = await loadRuntimeProfilePathDocument(
    profileInput,
    workingDirectory,
  );
  if ('error' in pathDocumentResult) {
    return pathDocumentResult;
  }

  const mergedDocument = mergeProfileDocuments(
    pathDocumentResult.document,
    inlineDocumentResult.document,
  );

  if (!mergedDocument || Object.keys(mergedDocument).length === 0) {
    return {};
  }

  return {
    document: mergedDocument,
  };
}

function normalizeInlineProfileDocument(
  profileInput: DbtGovernanceRuntimeInput['profile'],
):
  | {
      document?: Record<string, unknown>;
    }
  | {
      diagnostics: GovernanceDiagnostic[];
      error: DbtGovernanceRuntimeError;
    } {
  if (!profileInput || profileInput.document === undefined) {
    return {};
  }

  if (!isRecord(profileInput.document)) {
    return invalidRuntimeProfileResult(
      'profile.document must be a JSON object.',
      'profile.document',
    );
  }

  return {
    document: profileInput.document,
  };
}

async function loadRuntimeProfilePathDocument(
  profileInput: DbtGovernanceRuntimeInput['profile'],
  workingDirectory?: string,
): Promise<
  | {
      document?: Record<string, unknown>;
    }
  | {
      diagnostics: GovernanceDiagnostic[];
      error: DbtGovernanceRuntimeError;
    }
> {
  if (!profileInput?.path) {
    return {};
  }

  const resolvedPath = resolveRuntimeProfilePath(
    profileInput.path,
    workingDirectory,
  );
  const format = resolveRuntimeProfileFormat(profileInput, resolvedPath);

  if (!format) {
    return invalidRuntimeProfileResult(
      `profile.path "${resolvedPath}" must end in .json, .yaml, or .yml, or specify profile.format.`,
      'profile.path',
      {
        path: resolvedPath,
      },
    );
  }

  let sourceText: string;
  try {
    sourceText = await readFile(resolvedPath, 'utf8');
  } catch (error) {
    return invalidRuntimeProfileResult(
      `profile.path "${resolvedPath}" could not be read.`,
      'profile.path',
      {
        path: resolvedPath,
        reason: toErrorMessage(error),
      },
    );
  }

  let parsed: unknown;
  try {
    parsed =
      format === 'json'
        ? JSON.parse(sourceText)
        : (parseYaml(sourceText) ?? {});
  } catch (error) {
    return invalidRuntimeProfileResult(
      `profile.path "${resolvedPath}" contains invalid ${format.toUpperCase()}.`,
      'profile.path',
      {
        path: resolvedPath,
        format,
        reason: toErrorMessage(error),
      },
    );
  }

  if (parsed === null) {
    return {
      document: {},
    };
  }

  if (!isRecord(parsed)) {
    return invalidRuntimeProfileResult(
      `profile.path "${resolvedPath}" must contain a top-level object.`,
      'profile.path',
      {
        path: resolvedPath,
        format,
      },
    );
  }

  return {
    document: parsed,
  };
}

function resolveRuntimeProfilePath(
  profilePath: string,
  workingDirectory?: string,
): string {
  if (path.isAbsolute(profilePath)) {
    return profilePath;
  }

  return path.resolve(workingDirectory ?? process.cwd(), profilePath);
}

function resolveRuntimeProfileFormat(
  profileInput: DbtGovernanceRuntimeInput['profile'],
  resolvedPath: string,
): DbtGovernanceRuntimeProfileFormat | undefined {
  if (profileInput?.format === 'json' || profileInput?.format === 'yaml') {
    return profileInput.format;
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  if (extension === '.json') {
    return 'json';
  }
  if (extension === '.yaml' || extension === '.yml') {
    return 'yaml';
  }

  return undefined;
}

function mergeProfileDocuments(
  base: Record<string, unknown> | undefined,
  override: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!base) {
    return override ? { ...override } : undefined;
  }
  if (!override) {
    return { ...base };
  }

  const merged = new Map<string, unknown>();
  for (const [key, value] of Object.entries(base)) {
    merged.set(key, cloneProfileValue(value));
  }
  for (const [key, value] of Object.entries(override)) {
    const current = merged.get(key);
    if (isRecord(current) && isRecord(value)) {
      merged.set(key, mergeProfileDocuments(current, value));
      continue;
    }
    merged.set(key, cloneProfileValue(value));
  }

  return Object.fromEntries(merged);
}

function cloneProfileValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneProfileValue(entry));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        cloneProfileValue(entry),
      ]),
    );
  }

  return value;
}

function cloneDefaultRuntimeProfile(): GovernanceProfile {
  return {
    ...DEFAULT_RUNTIME_PROFILE,
    layers: [...DEFAULT_RUNTIME_PROFILE.layers],
    allowedDomainDependencies: {
      ...DEFAULT_RUNTIME_PROFILE.allowedDomainDependencies,
    },
    rules: cloneRuntimeRules(DEFAULT_RUNTIME_PROFILE.rules),
    metrics: {
      ...DEFAULT_RUNTIME_PROFILE.metrics,
    },
  };
}

function resolveRuntimeRules(
  input: unknown,
): GovernanceProfile['rules'] | undefined {
  const defaultRules = cloneRuntimeRules(DEFAULT_RUNTIME_PROFILE.rules);
  if (!isRecord(input)) {
    return defaultRules;
  }

  return {
    ...defaultRules,
    ...(input as GovernanceProfile['rules']),
  };
}

function cloneRuntimeRules(
  rules: GovernanceProfile['rules'] | undefined,
): GovernanceProfile['rules'] | undefined {
  if (!rules) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(rules).map(([ruleId, ruleConfig]) => [
      ruleId,
      {
        ...ruleConfig,
        ...(isRecord(ruleConfig?.options)
          ? { options: { ...ruleConfig.options } }
          : ruleConfig?.options !== undefined
            ? { options: ruleConfig.options }
            : {}),
      },
    ]),
  );
}

function toDbtGovernanceAdapterInput(input: DbtGovernanceRuntimeInput):
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
          dbtProjectPath: resolvePath(pathsInput.dbtProjectPath, baseDirectory),
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
          runResultsPath: resolvePath(pathsInput.runResultsPath, baseDirectory),
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
  generatedAt: string,
): Pick<DbtGovernanceRuntimeResultMetadata, 'runtime'> {
  return {
    runtime: {
      packageName: DBT_GOVERNANCE_RUNTIME_PACKAGE_NAME,
      id: DBT_GOVERNANCE_RUNTIME_ID,
      version: DBT_GOVERNANCE_RUNTIME_VERSION,
      adapterPackageName: DBT_GOVERNANCE_ADAPTER_PACKAGE_NAME,
      extensionPackageName: DBT_GOVERNANCE_EXTENSION_PACKAGE_NAME,
      generatedAt,
      ...(runtimeInput?.requestId
        ? { invocationId: runtimeInput.requestId }
        : {}),
      ...(runtimeInput?.requestId ? { requestId: runtimeInput.requestId } : {}),
      ...(runtimeInput?.workingDirectory
        ? { workingDirectory: path.resolve(runtimeInput.workingDirectory) }
        : {}),
      ...(runtimeInput?.dryRun !== undefined
        ? { dryRun: runtimeInput.dryRun }
        : {}),
      ...(runtimeInput?.metadata ? { metadata: runtimeInput.metadata } : {}),
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

function invalidRuntimeProfileResult(
  message: string,
  inputField: string,
  details?: Record<string, unknown>,
): {
  diagnostics: GovernanceDiagnostic[];
  error: DbtGovernanceRuntimeError;
} {
  return {
    diagnostics: [
      buildRuntimeDiagnostic('governance.runtime.profile_invalid', message),
    ],
    error: {
      code: 'governance.runtime.profile_invalid',
      stage: 'profile',
      message: 'Governance profile input is invalid.',
      details: {
        inputField,
        ...(details ?? {}),
      },
    },
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

function mergeRecommendations(
  coreRecommendations: Recommendation[],
  extensionRecommendations: Recommendation[],
): Recommendation[] {
  return [...coreRecommendations, ...extensionRecommendations]
    .reduce<Recommendation[]>((deduped, recommendation) => {
      if (deduped.some((entry) => entry.id === recommendation.id)) {
        return deduped;
      }

      deduped.push(recommendation);
      return deduped;
    }, [])
    .sort(
      (left, right) =>
        left.id.localeCompare(right.id) ||
        left.title.localeCompare(right.title),
    );
}

function buildWarnings(
  adapterDiagnostics: GovernanceDiagnostic[],
  extensionDiagnostics: GovernanceDiagnostic[],
): string[] {
  return [...adapterDiagnostics, ...extensionDiagnostics]
    .filter((diagnostic) => diagnostic.severity !== 'info')
    .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
    .sort((left, right) => left.localeCompare(right));
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
