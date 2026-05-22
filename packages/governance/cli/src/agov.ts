import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterProbeConfidence,
  GovernanceWorkspaceAdapterProbeResult,
  Violation,
} from '@anarchitects/governance-core';

import type { AgovCheckOptions, AgovCheckResult } from './check.js';
import * as checkModule from './check.js';
import {
  type AgovOutputFormat,
  renderAgovCheckReport,
} from './render-report.js';
import {
  GenericWorkspaceLoadError,
  GenericWorkspaceValidationError,
} from './internal/manual-workspace/load-workspace.js';
import {
  StandaloneGovernanceProfileLoadError,
  StandaloneGovernanceProfileValidationError,
} from './internal/profile/load-standalone-profile.js';

const AGOV_CONFIG_FILE_NAMES = ['agov.config.json', 'governance.config.json'];
const AGOV_PROFILE_FILE_NAMES = [
  'tools/governance/profiles/default.json',
  'tools/governance/profile.json',
  'governance.profile.json',
  'agov.profile.json',
];
const AGOV_WORKSPACE_FILE_NAMES = [
  'governance.workspace.json',
  'agov.workspace.json',
  'tools/governance/workspace.json',
];

export interface AgovCliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface AgovCliEnvironment {
  cwd(): string;
  moduleLoader(specifier: string): Promise<unknown>;
  packageVersion(): string;
}

type MaybePromise<T> = T | Promise<T>;

export interface AgovCliRuntime {
  runAgovCheck<TInput = unknown>(
    options: AgovCheckOptions<TInput>,
  ): MaybePromise<AgovCheckResult>;
}

export interface AgovCliConfig {
  profile?: string;
  adapter?: string;
  adapters?: string[];
  root?: string;
  workspace?: string;
  format?: string;
  output?: string;
}

export interface ParsedAgovCheckOptions {
  command: 'check';
  configPath?: string;
  profilePath?: string;
  workspacePath?: string;
  adapterPackage?: string;
  rootPath?: string;
  format?: AgovOutputFormat;
  outputPath?: string;
  showHelp: boolean;
}

export interface AgovResolvedCheckCommand {
  command: 'check';
  rootPath: string;
  profilePath: string;
  format: AgovOutputFormat;
  outputPath?: string;
  configPath?: string;
  mode: 'workspace' | 'adapter' | 'adapter-discovery';
  workspacePath?: string;
  adapterPackage?: string;
  adapterCandidates?: string[];
}

export const AGOV_EXIT_SUCCESS = 0;
export const AGOV_EXIT_GOVERNANCE_FAILURE = 1;
export const AGOV_EXIT_CONFIGURATION_FAILURE = 2;
export const AGOV_EXIT_RUNTIME_FAILURE = 3;

const DEFAULT_AGOV_CLI_RUNTIME: AgovCliRuntime = {
  runAgovCheck: checkModule.runAgovCheck,
};

export class AgovCliUsageError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'agov.cli.unknown_command'
      | 'agov.cli.unknown_option'
      | 'agov.cli.missing_option_value'
      | 'agov.cli.unsupported_format'
      | 'agov.cli.missing_profile'
      | 'agov.cli.missing_workspace_or_adapter'
      | 'agov.cli.ambiguous_workspace_and_adapter'
      | 'agov.cli.invalid_config'
      | 'agov.cli.invalid_json',
  ) {
    super(message);
    this.name = 'AgovCliUsageError';
  }
}

export class AgovCliOutputError extends Error {
  constructor(
    message: string,
    public readonly code: 'agov.cli.output_write_failed',
    public readonly filePath: string,
  ) {
    super(message);
    this.name = 'AgovCliOutputError';
  }
}

export class AgovCliRuntimeError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'agov.cli.adapter_not_found'
      | 'agov.cli.adapter_contract_mismatch'
      | 'agov.cli.no_supported_adapter'
      | 'agov.cli.unhandled_error',
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AgovCliRuntimeError';
  }
}

export async function runAgovCli(
  argv: string[],
  io: AgovCliIo = defaultIo(),
  runtime: AgovCliRuntime = DEFAULT_AGOV_CLI_RUNTIME,
  environment: AgovCliEnvironment = defaultEnvironment(),
): Promise<number> {
  try {
    const parsed = parseAgovCliInvocation(argv);

    if (parsed.kind === 'help') {
      io.stdout(renderAgovHelp());
      return AGOV_EXIT_SUCCESS;
    }

    if (parsed.kind === 'version') {
      io.stdout(environment.packageVersion());
      return AGOV_EXIT_SUCCESS;
    }

    if (parsed.options.showHelp) {
      io.stdout(renderAgovCheckHelp());
      return AGOV_EXIT_SUCCESS;
    }

    const resolved = resolveAgovCheckCommand(parsed.options, environment);
    const checkOptions = await resolveAgovCheckRuntimeOptions(
      resolved,
      environment,
    );
    const result = await Promise.resolve(runtime.runAgovCheck(checkOptions));
    const rendered = renderAgovCheckReport(result, resolved.format);

    if (resolved.outputPath) {
      writeAgovOutput(resolved.outputPath, rendered);
    } else {
      io.stdout(rendered);
    }

    return result.success ? AGOV_EXIT_SUCCESS : AGOV_EXIT_GOVERNANCE_FAILURE;
  } catch (error) {
    if (error instanceof AgovCliUsageError) {
      io.stderr(
        renderErrorPayload({
          code: error.code,
          message: error.message,
        }),
      );
      return AGOV_EXIT_CONFIGURATION_FAILURE;
    }

    if (error instanceof AgovCliOutputError) {
      io.stderr(
        renderErrorPayload({
          code: error.code,
          message: error.message,
          details: {
            filePath: error.filePath,
          },
        }),
      );
      return AGOV_EXIT_CONFIGURATION_FAILURE;
    }

    if (error instanceof AgovCliRuntimeError) {
      io.stderr(
        renderErrorPayload({
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        }),
      );
      return AGOV_EXIT_RUNTIME_FAILURE;
    }

    if (
      error instanceof GenericWorkspaceLoadError ||
      error instanceof GenericWorkspaceValidationError ||
      error instanceof StandaloneGovernanceProfileLoadError ||
      error instanceof StandaloneGovernanceProfileValidationError
    ) {
      io.stderr(renderStructuredError(error));
      return AGOV_EXIT_RUNTIME_FAILURE;
    }

    io.stderr(
      renderErrorPayload({
        code: 'agov.cli.unhandled_error',
        message:
          error instanceof Error ? error.message : 'Unknown agov CLI error.',
      }),
    );
    return AGOV_EXIT_RUNTIME_FAILURE;
  }
}

function parseAgovCliInvocation(argv: string[]):
  | {
      kind: 'help';
    }
  | {
      kind: 'version';
    }
  | {
      kind: 'check';
      options: ParsedAgovCheckOptions;
    } {
  if (argv.length === 0) {
    return { kind: 'help' };
  }

  const [command, ...rest] = argv;

  if (command === '--help' || command === '-h' || command === 'help') {
    return { kind: 'help' };
  }

  if (command === '--version' || command === '-v' || command === 'version') {
    return { kind: 'version' };
  }

  if (command !== 'check') {
    throw new AgovCliUsageError(
      `Unsupported agov command "${command}". Supported commands are "check", "--help", and "--version".`,
      'agov.cli.unknown_command',
    );
  }

  return {
    kind: 'check',
    options: parseAgovCheckArgs(rest),
  };
}

function parseAgovCheckArgs(args: string[]): ParsedAgovCheckOptions {
  let configPath: string | undefined;
  let profilePath: string | undefined;
  let workspacePath: string | undefined;
  let adapterPackage: string | undefined;
  let rootPath: string | undefined;
  let format: AgovOutputFormat | undefined;
  let outputPath: string | undefined;
  let showHelp = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      showHelp = true;
      continue;
    }

    if (arg === '--config') {
      configPath = readRequiredOptionValue(args, index, '--config');
      index += 1;
      continue;
    }

    if (arg === '--profile') {
      profilePath = readRequiredOptionValue(args, index, '--profile');
      index += 1;
      continue;
    }

    if (arg === '--workspace') {
      workspacePath = readRequiredOptionValue(args, index, '--workspace');
      index += 1;
      continue;
    }

    if (arg === '--adapter') {
      adapterPackage = readRequiredOptionValue(args, index, '--adapter');
      index += 1;
      continue;
    }

    if (arg === '--root') {
      rootPath = readRequiredOptionValue(args, index, '--root');
      index += 1;
      continue;
    }

    if (arg === '--format') {
      const value = readRequiredOptionValue(args, index, '--format');
      index += 1;

      if (
        value !== 'text' &&
        value !== 'json' &&
        value !== 'markdown' &&
        value !== 'table'
      ) {
        throw new AgovCliUsageError(
          'Unsupported agov check format. Supported formats are "table", "markdown", "text", and "json".',
          'agov.cli.unsupported_format',
        );
      }

      format = value;
      continue;
    }

    if (arg === '--output') {
      outputPath = readRequiredOptionValue(args, index, '--output');
      index += 1;
      continue;
    }

    throw new AgovCliUsageError(
      `Unknown agov option "${arg}".`,
      'agov.cli.unknown_option',
    );
  }

  return {
    command: 'check',
    configPath,
    profilePath,
    workspacePath,
    adapterPackage,
    rootPath,
    format,
    outputPath,
    showHelp,
  };
}

function readRequiredOptionValue(
  args: string[],
  index: number,
  optionName: string,
): string {
  const value = args[index + 1];

  if (!value || value.startsWith('--')) {
    throw new AgovCliUsageError(
      `Missing required value for "${optionName}".`,
      'agov.cli.missing_option_value',
    );
  }

  return value;
}

export function resolveAgovCheckCommand(
  options: ParsedAgovCheckOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedCheckCommand {
  const cwd = path.resolve(environment.cwd());
  const explicitRootPath = options.rootPath
    ? path.resolve(cwd, options.rootPath)
    : undefined;
  const configPath = resolveConfigPath(
    cwd,
    explicitRootPath,
    options.configPath,
  );
  const config = configPath ? loadAgovConfig(configPath) : {};
  const configBasePath = configPath ? path.dirname(configPath) : cwd;

  if (
    (config.adapter || readNonEmptyStringArray(config.adapters).length > 0) &&
    config.workspace &&
    !options.adapterPackage &&
    !options.workspacePath
  ) {
    throw new AgovCliUsageError(
      'Config file cannot define both adapter-mode and workspace-mode inputs for agov check. Pass one mode only, or override explicitly with CLI flags.',
      'agov.cli.invalid_config',
    );
  }

  if (options.workspacePath && options.adapterPackage) {
    throw new AgovCliUsageError(
      'agov check does not allow explicit "--workspace" and "--adapter" together. Use canonical workspace mode or adapter mode, not both.',
      'agov.cli.ambiguous_workspace_and_adapter',
    );
  }

  const rootPath =
    explicitRootPath ??
    resolveConfigRelativePath(config.root, configBasePath) ??
    cwd;
  const explicitWorkspacePath = resolveExplicitPath(options.workspacePath, cwd);
  const configuredWorkspacePath = resolveConfigRelativePath(
    config.workspace,
    configBasePath,
  );
  const conventionalWorkspacePath = resolveConventionalFile(
    rootPath,
    AGOV_WORKSPACE_FILE_NAMES,
  );
  const workspacePath =
    explicitWorkspacePath ??
    configuredWorkspacePath ??
    conventionalWorkspacePath;
  const profilePath =
    resolveExplicitPath(options.profilePath, cwd) ??
    resolveConfigRelativePath(config.profile, configBasePath) ??
    resolveConventionalFile(rootPath, AGOV_PROFILE_FILE_NAMES);
  const adapterPackage =
    options.adapterPackage ?? readNonEmptyString(config.adapter);
  const adapterCandidates = resolveAdapterCandidatePackages(rootPath, config);
  const format = resolveOutputFormat(options.format, config.format);
  const outputPath = resolveExplicitPath(options.outputPath, cwd);

  if (!profilePath) {
    throw new AgovCliUsageError(
      'Could not resolve a governance profile. Pass "--profile <path>", set "profile" in agov.config.json or governance.config.json, or add a conventional profile file such as "governance.profile.json".',
      'agov.cli.missing_profile',
    );
  }

  if (explicitWorkspacePath || configuredWorkspacePath) {
    return {
      command: 'check',
      rootPath,
      profilePath,
      workspacePath,
      format,
      ...(outputPath ? { outputPath } : {}),
      ...(configPath ? { configPath } : {}),
      mode: 'workspace',
    };
  }

  if (adapterPackage) {
    return {
      command: 'check',
      rootPath,
      profilePath,
      adapterPackage,
      format,
      ...(outputPath ? { outputPath } : {}),
      ...(configPath ? { configPath } : {}),
      mode: 'adapter',
    };
  }

  if (adapterCandidates.length > 0) {
    return {
      command: 'check',
      rootPath,
      profilePath,
      adapterCandidates,
      format,
      ...(outputPath ? { outputPath } : {}),
      ...(configPath ? { configPath } : {}),
      mode: 'adapter-discovery',
    };
  }

  if (workspacePath) {
    return {
      command: 'check',
      rootPath,
      profilePath,
      workspacePath,
      format,
      ...(outputPath ? { outputPath } : {}),
      ...(configPath ? { configPath } : {}),
      mode: 'workspace',
    };
  }

  throw new AgovCliUsageError(
    'Could not resolve Governance workspace input. Pass "--workspace <path>" for canonical workspace mode, pass "--adapter <package> --root <path>" for explicit adapter mode, or configure generic adapter candidates.',
    'agov.cli.missing_workspace_or_adapter',
  );
}

async function resolveAgovCheckRuntimeOptions(
  command: AgovResolvedCheckCommand,
  environment: AgovCliEnvironment,
): Promise<AgovCheckOptions<unknown>> {
  if (command.mode === 'workspace') {
    if (!command.workspacePath) {
      throw new AgovCliRuntimeError(
        'Resolved workspace mode without a workspace path.',
        'agov.cli.unhandled_error',
      );
    }

    return {
      profilePath: command.profilePath,
      workspacePath: command.workspacePath,
    };
  }

  if (!command.adapterPackage) {
    if (command.mode !== 'adapter-discovery' || !command.adapterCandidates) {
      throw new AgovCliRuntimeError(
        'Resolved adapter mode without an adapter package.',
        'agov.cli.unhandled_error',
      );
    }

    const resolvedAdapter = await discoverGovernanceWorkspaceAdapter(
      command.adapterCandidates,
      command.rootPath,
      environment,
    );

    return {
      profilePath: command.profilePath,
      workspaceAdapter: resolvedAdapter.adapter,
      workspaceAdapterInput: command.rootPath,
    };
  }

  const workspaceAdapter = await loadGovernanceWorkspaceAdapter(
    command.adapterPackage,
    command.rootPath,
    environment,
  );

  return {
    profilePath: command.profilePath,
    workspaceAdapter,
    workspaceAdapterInput: command.rootPath,
  };
}

async function loadGovernanceWorkspaceAdapter(
  packageName: string,
  rootPath: string,
  environment: Pick<AgovCliEnvironment, 'moduleLoader'>,
): Promise<GovernanceWorkspaceAdapter<string>> {
  let loadedModule: unknown;

  try {
    loadedModule = await environment.moduleLoader(packageName);
  } catch {
    throw new AgovCliRuntimeError(
      renderMissingAdapterMessage(packageName),
      'agov.cli.adapter_not_found',
      {
        adapter: packageName,
        rootPath,
      },
    );
  }

  const resolvedAdapter = resolveAdapterExport(loadedModule);

  if (!resolvedAdapter) {
    throw new AgovCliRuntimeError(
      `Package "${packageName}" was loaded, but it does not expose a compatible Governance workspace adapter.`,
      'agov.cli.adapter_contract_mismatch',
      {
        adapter: packageName,
        rootPath,
      },
    );
  }

  return resolvedAdapter;
}

async function discoverGovernanceWorkspaceAdapter(
  packageNames: string[],
  rootPath: string,
  environment: Pick<AgovCliEnvironment, 'moduleLoader'>,
): Promise<{
  adapter: GovernanceWorkspaceAdapter<string>;
  packageName: string;
  probe: GovernanceWorkspaceAdapterProbeResult;
}> {
  const attempts: Array<Record<string, unknown>> = [];
  let bestMatch:
    | {
        adapter: GovernanceWorkspaceAdapter<string>;
        packageName: string;
        probe: GovernanceWorkspaceAdapterProbeResult;
        rank: number;
      }
    | undefined;

  for (const packageName of packageNames) {
    let loadedModule: unknown;

    try {
      loadedModule = await environment.moduleLoader(packageName);
    } catch {
      attempts.push({ packageName, status: 'load-failed' });
      continue;
    }

    const adapter = resolveAdapterExport(loadedModule);

    if (!adapter) {
      attempts.push({ packageName, status: 'contract-mismatch' });
      continue;
    }

    if (typeof adapter.probe !== 'function') {
      attempts.push({ packageName, status: 'missing-probe' });
      continue;
    }

    const probe = adapter.probe(rootPath);
    attempts.push({
      packageName,
      status: probe.supported ? 'supported' : 'unsupported',
      confidence: probe.confidence ?? 'none',
      reasons: probe.reasons ?? [],
    });

    if (!probe.supported) {
      continue;
    }

    const rank = rankProbeConfidence(probe.confidence);
    if (!bestMatch || rank > bestMatch.rank) {
      bestMatch = {
        adapter,
        packageName,
        probe,
        rank,
      };
    }
  }

  if (!bestMatch) {
    throw new AgovCliRuntimeError(
      'Could not find a supported Governance adapter from the discovered candidate packages.',
      'agov.cli.no_supported_adapter',
      {
        rootPath,
        attemptedPackages: packageNames,
        attempts,
      },
    );
  }

  return bestMatch;
}

function resolveAdapterExport(
  loadedModule: unknown,
): GovernanceWorkspaceAdapter<string> | undefined {
  const moduleRecord =
    typeof loadedModule === 'object' && loadedModule !== null
      ? (loadedModule as Record<string, unknown>)
      : {};

  for (const candidate of [
    moduleRecord.default,
    moduleRecord.governanceWorkspaceAdapter,
    moduleRecord.adapter,
  ]) {
    if (isGovernanceWorkspaceAdapter(candidate)) {
      return candidate;
    }
  }

  const createGovernanceWorkspaceAdapter =
    moduleRecord.createGovernanceWorkspaceAdapter;

  if (typeof createGovernanceWorkspaceAdapter === 'function') {
    const created = createGovernanceWorkspaceAdapter();
    if (isGovernanceWorkspaceAdapter(created)) {
      return created;
    }
  }

  return undefined;
}

function isGovernanceWorkspaceAdapter(
  value: unknown,
): value is GovernanceWorkspaceAdapter<string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).loadWorkspace === 'function'
  );
}

function renderMissingAdapterMessage(packageName: string): string {
  const lines = [`Could not load Governance adapter package "${packageName}".`];

  lines.push(
    `Install "${packageName}" in the consuming workspace to use adapter mode.`,
  );
  lines.push(
    `You can also pass "--adapter ${packageName}" explicitly, or use "--workspace <path>" with a canonical Governance workspace document.`,
  );

  return lines.join(' ');
}

function rankProbeConfidence(
  confidence: GovernanceWorkspaceAdapterProbeConfidence | undefined,
): number {
  switch (confidence) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function resolveConfigPath(
  cwd: string,
  explicitRootPath: string | undefined,
  explicitConfigPath: string | undefined,
): string | undefined {
  if (explicitConfigPath) {
    return path.resolve(cwd, explicitConfigPath);
  }

  const searchRoots = explicitRootPath ? [explicitRootPath, cwd] : [cwd];

  for (const searchRoot of searchRoots) {
    const resolved = resolveConventionalFile(
      searchRoot,
      AGOV_CONFIG_FILE_NAMES,
    );
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

function loadAgovConfig(filePath: string): AgovCliConfig {
  let source: string;

  try {
    source = readFileSync(filePath, 'utf8');
  } catch {
    throw new AgovCliUsageError(
      `Failed to read agov config file "${filePath}".`,
      'agov.cli.invalid_config',
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new AgovCliUsageError(
      `Failed to parse agov config file "${filePath}" as JSON.`,
      'agov.cli.invalid_json',
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new AgovCliUsageError(
      `agov config file "${filePath}" must contain a JSON object.`,
      'agov.cli.invalid_config',
    );
  }

  return parsed as AgovCliConfig;
}

function resolveOutputFormat(
  explicitFormat: AgovOutputFormat | undefined,
  configFormat: string | undefined,
): AgovOutputFormat {
  const resolved = explicitFormat ?? readNonEmptyString(configFormat) ?? 'text';

  if (
    resolved !== 'text' &&
    resolved !== 'json' &&
    resolved !== 'markdown' &&
    resolved !== 'table'
  ) {
    throw new AgovCliUsageError(
      'Unsupported agov check format. Supported formats are "table", "markdown", "text", and "json".',
      'agov.cli.unsupported_format',
    );
  }

  return resolved;
}

function resolveExplicitPath(
  value: string | undefined,
  basePath: string,
): string | undefined {
  if (!value) {
    return undefined;
  }

  return path.resolve(basePath, value);
}

function resolveConfigRelativePath(
  value: string | undefined,
  configBasePath: string,
): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return path.resolve(configBasePath, value);
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readNonEmptyStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];
}

function resolveConventionalFile(
  rootPath: string,
  fileNames: readonly string[],
): string | undefined {
  for (const fileName of fileNames) {
    const candidate = path.resolve(rootPath, fileName);

    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return undefined;
}

function resolveAdapterCandidatePackages(
  rootPath: string,
  config: AgovCliConfig,
): string[] {
  return [
    ...new Set([
      ...readNonEmptyStringArray(config.adapters),
      ...resolvePackageJsonAdapterCandidates(rootPath),
    ]),
  ];
}

function resolvePackageJsonAdapterCandidates(rootPath: string): string[] {
  const packageJsonPath = path.join(rootPath, 'package.json');

  if (!existsSync(packageJsonPath) || !statSync(packageJsonPath).isFile()) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return [];
    }

    const record = parsed as Record<string, unknown>;
    const agovConfig =
      typeof record.agov === 'object' &&
      record.agov !== null &&
      !Array.isArray(record.agov)
        ? (record.agov as Record<string, unknown>)
        : undefined;
    const governanceConfig =
      typeof record.governance === 'object' &&
      record.governance !== null &&
      !Array.isArray(record.governance)
        ? (record.governance as Record<string, unknown>)
        : undefined;

    return [
      ...readNonEmptyStringArray(agovConfig?.adapters),
      ...readNonEmptyStringArray(governanceConfig?.adapters),
    ];
  } catch {
    return [];
  }
}

function renderStructuredError(
  error:
    | GenericWorkspaceLoadError
    | GenericWorkspaceValidationError
    | StandaloneGovernanceProfileLoadError
    | StandaloneGovernanceProfileValidationError,
): string {
  if (
    error instanceof GenericWorkspaceValidationError ||
    error instanceof StandaloneGovernanceProfileValidationError
  ) {
    return renderErrorPayload({
      code:
        error instanceof GenericWorkspaceValidationError
          ? 'agov.cli.invalid_workspace'
          : 'agov.cli.invalid_profile',
      message: error.message,
      details: {
        filePath: error.filePath,
        issues: error.issues,
      },
    });
  }

  return renderErrorPayload({
    code:
      error instanceof GenericWorkspaceLoadError
        ? 'agov.cli.workspace_load_failed'
        : 'agov.cli.profile_load_failed',
    message: error.message,
    details: {
      filePath: error.filePath,
      loaderCode: error.code,
    },
  });
}

function renderErrorPayload(input: {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}): string {
  return JSON.stringify(
    {
      error: {
        code: input.code,
        message: input.message,
        ...(input.details ? { details: input.details } : {}),
      },
    },
    null,
    2,
  );
}

function renderAgovHelp(): string {
  return [
    'agov',
    '',
    'Usage:',
    '  agov --help',
    '  agov --version',
    '  agov check [options]',
    '',
    'Commands:',
    '  check   Run a Governance check using canonical workspace mode or adapter mode.',
    '',
    'Run "agov check --help" for command-specific options.',
  ].join('\n');
}

function renderAgovCheckHelp(): string {
  return [
    'agov check',
    '',
    'Usage:',
    '  agov check --profile <path> --workspace <path> [--format table|markdown|text|json]',
    '  agov check --profile <path> --adapter <package> --root <path> [--format table|markdown|text|json]',
    '  agov check [--config <path>]',
    '',
    'Resolution order:',
    '  explicit CLI flag -> config file -> conventional files -> generic adapter discovery and probe -> error',
    '',
    'Options:',
    '  --help              Show check command help.',
    '  --config <path>     Load agov.config.json or governance.config.json explicitly.',
    '  --profile <path>    Governance profile document.',
    '  --workspace <path>  Canonical Governance workspace document.',
    '  --adapter <package> Dynamically load a concrete adapter package.',
    '  --root <path>       Adapter input root. Defaults to the current working directory.',
    '  --format <value>    Output format: table, markdown, text, or json. Defaults to text.',
    '  --output <path>     Write command output to a file instead of stdout.',
    '',
    'Conventions:',
    '  Config:   agov.config.json, governance.config.json',
    '  Profile:  tools/governance/profiles/default.json, tools/governance/profile.json, governance.profile.json, agov.profile.json',
    '  Workspace: governance.workspace.json, agov.workspace.json, tools/governance/workspace.json',
  ].join('\n');
}

function defaultIo(): AgovCliIo {
  return {
    stdout(message: string) {
      process.stdout.write(`${message}\n`);
    },
    stderr(message: string) {
      process.stderr.write(`${message}\n`);
    },
  };
}

function defaultEnvironment(): AgovCliEnvironment {
  return {
    cwd() {
      return process.cwd();
    },
    async moduleLoader(specifier: string) {
      return import(specifier);
    },
    packageVersion() {
      const packageJsonPath = fileURLToPath(
        new URL('../package.json', import.meta.url),
      );
      const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        version?: string;
      };

      return parsed.version ?? '0.0.0';
    },
  };
}

function writeAgovOutput(outputPath: string, content: string): void {
  const filePath = path.resolve(outputPath);

  try {
    writeFileSync(filePath, content, 'utf8');
  } catch {
    throw new AgovCliOutputError(
      `Failed to write agov report output to "${filePath}".`,
      'agov.cli.output_write_failed',
      filePath,
    );
  }
}

function severityRank(severity: Violation['severity']): number {
  if (severity === 'info') {
    return 0;
  }

  if (severity === 'warning') {
    return 1;
  }

  return 2;
}

export function compareViolationsForBlocking(
  violations: readonly Violation[],
): boolean {
  return violations.some((violation) => severityRank(violation.severity) >= 2);
}
