import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  GovernanceWorkspaceAdapter,
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
  mode: 'workspace' | 'adapter';
  workspacePath?: string;
  adapterPackage?: string;
  adapterInference?: {
    packageName: string;
    reasons: string[];
  };
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
    config.adapter &&
    config.workspace &&
    !options.adapterPackage &&
    !options.workspacePath
  ) {
    throw new AgovCliUsageError(
      'Config file cannot define both "adapter" and "workspace" for agov check. Pass one mode only, or override explicitly with CLI flags.',
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
  const workspacePath =
    resolveExplicitPath(options.workspacePath, cwd) ??
    resolveConfigRelativePath(config.workspace, configBasePath) ??
    resolveConventionalFile(rootPath, AGOV_WORKSPACE_FILE_NAMES);
  const profilePath =
    resolveExplicitPath(options.profilePath, cwd) ??
    resolveConfigRelativePath(config.profile, configBasePath) ??
    resolveConventionalFile(rootPath, AGOV_PROFILE_FILE_NAMES);
  const adapterPackage =
    options.adapterPackage ?? readNonEmptyString(config.adapter);
  const format = resolveOutputFormat(options.format, config.format);
  const outputPath = resolveExplicitPath(options.outputPath, cwd);

  if (!profilePath) {
    throw new AgovCliUsageError(
      'Could not resolve a governance profile. Pass "--profile <path>", set "profile" in agov.config.json or governance.config.json, or add a conventional profile file such as "governance.profile.json".',
      'agov.cli.missing_profile',
    );
  }

  if (workspacePath && !options.adapterPackage && !config.adapter) {
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

  const adapterInference = inferAdapterPackage(rootPath);

  if (adapterInference) {
    return {
      command: 'check',
      rootPath,
      profilePath,
      adapterPackage: adapterInference.packageName,
      adapterInference,
      format,
      ...(outputPath ? { outputPath } : {}),
      ...(configPath ? { configPath } : {}),
      mode: 'adapter',
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
    'Could not resolve Governance workspace input. Pass "--workspace <path>" for canonical workspace mode, or "--adapter <package> --root <path>" for adapter mode.',
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
    throw new AgovCliRuntimeError(
      'Resolved adapter mode without an adapter package.',
      'agov.cli.unhandled_error',
    );
  }

  const workspaceAdapter = await loadGovernanceWorkspaceAdapter(
    command.adapterPackage,
    command.rootPath,
    environment,
    command.adapterInference,
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
  inference?: {
    packageName: string;
    reasons: string[];
  },
): Promise<GovernanceWorkspaceAdapter<string>> {
  let loadedModule: unknown;

  try {
    loadedModule = await environment.moduleLoader(packageName);
  } catch {
    throw new AgovCliRuntimeError(
      renderMissingAdapterMessage(packageName, rootPath, inference),
      'agov.cli.adapter_not_found',
      {
        adapter: packageName,
        rootPath,
        ...(inference ? { inferredBecause: inference.reasons } : {}),
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

function renderMissingAdapterMessage(
  packageName: string,
  rootPath: string,
  inference:
    | {
        packageName: string;
        reasons: string[];
      }
    | undefined,
): string {
  const lines = [`Could not load Governance adapter package "${packageName}".`];

  if (inference) {
    lines.push(
      `The adapter was inferred for "${rootPath}" because ${inference.reasons.join(
        ', ',
      )}.`,
    );
  }

  lines.push(
    `Install "${packageName}" in the consuming workspace to use adapter mode.`,
  );
  lines.push(
    `You can also pass "--adapter ${packageName}" explicitly, or use "--workspace <path>" with a canonical Governance workspace document.`,
  );

  return lines.join(' ');
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

function inferAdapterPackage(rootPath: string):
  | {
      packageName: string;
      reasons: string[];
    }
  | undefined {
  const reasons: string[] = [];

  if (existsSync(path.join(rootPath, 'tsconfig.json'))) {
    reasons.push('tsconfig.json is present');
  }

  if (existsSync(path.join(rootPath, 'tsconfig.base.json'))) {
    reasons.push('tsconfig.base.json is present');
  }

  const packageJsonPath = path.join(rootPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        workspaces?: unknown;
      };

      const dependencyNames = [
        ...Object.keys(parsed.dependencies ?? {}),
        ...Object.keys(parsed.devDependencies ?? {}),
        ...Object.keys(parsed.peerDependencies ?? {}),
      ];

      if (dependencyNames.includes('typescript')) {
        reasons.push('package.json declares a TypeScript dependency');
      }

      if (
        Array.isArray(parsed.workspaces) ||
        (parsed.workspaces &&
          typeof parsed.workspaces === 'object' &&
          !Array.isArray(parsed.workspaces))
      ) {
        reasons.push('package.json declares package-manager workspaces');
      }
    } catch {
      // Ignore invalid package.json here. The adapter load path will surface real errors later.
    }
  }

  if (containsConventionalTypeScriptSources(rootPath)) {
    reasons.push('conventional source folders contain .ts files');
  }

  if (reasons.length === 0) {
    return undefined;
  }

  return {
    packageName: '@anarchitects/governance-adapter-typescript',
    reasons,
  };
}

function containsConventionalTypeScriptSources(rootPath: string): boolean {
  for (const directoryName of ['src', 'apps', 'packages', 'libs', 'services']) {
    const directoryPath = path.join(rootPath, directoryName);

    if (containsTypeScriptFile(directoryPath, 2)) {
      return true;
    }
  }

  return false;
}

function containsTypeScriptFile(directoryPath: string, depth: number): boolean {
  if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) {
    return false;
  }

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    if (entry.isFile() && /\.(ts|tsx|mts|cts)$/.test(entry.name)) {
      return true;
    }

    if (entry.isDirectory() && depth > 0) {
      if (
        containsTypeScriptFile(path.join(directoryPath, entry.name), depth - 1)
      ) {
        return true;
      }
    }
  }

  return false;
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
    '  explicit CLI flag -> config file -> conventions/inference -> error',
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
