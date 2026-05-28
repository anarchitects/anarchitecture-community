import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterProbeConfidence,
  GovernanceWorkspaceAdapterProbeResult,
  Violation,
} from '@anarchitects/governance-core';

import type {
  AgovDependenciesFilters,
  AgovDependenciesOptions,
  AgovDependenciesResult,
  AgovDependencyType,
} from './dependencies.js';
import type { AgovInspectFilters } from './inspect.js';
import type { AgovInspectOptions, AgovInspectResult } from './inspect.js';
import type {
  AgovMetricsFilters,
  AgovMetricsOptions,
  AgovMetricsResult,
} from './metrics.js';
import type {
  AgovRecommendationPriority,
  AgovRecommendationsFilters,
  AgovRecommendationsOptions,
  AgovRecommendationsResult,
} from './recommendations.js';
import type {
  AgovProfileValidateOptions,
  AgovProfileValidateResult,
} from './profile-validate.js';
import type {
  AgovWorkspaceValidateOptions,
  AgovWorkspaceValidateResult,
} from './workspace-validate.js';
import type {
  AgovSignalSeverity,
  AgovSignalsFilters,
  AgovSignalsOptions,
  AgovSignalsResult,
} from './signals.js';
import type {
  AgovViolationSeverity,
  AgovViolationsFilters,
  AgovViolationsOptions,
  AgovViolationsResult,
} from './violations.js';
import type {
  AgovAssessOptions,
  AgovAssessResult,
  AgovCheckOptions,
  AgovCheckResult,
} from './check.js';
import * as checkModule from './check.js';
import * as dependenciesModule from './dependencies.js';
import * as inspectModule from './inspect.js';
import * as metricsModule from './metrics.js';
import * as profileValidateModule from './profile-validate.js';
import * as recommendationsModule from './recommendations.js';
import * as signalsModule from './signals.js';
import * as violationsModule from './violations.js';
import * as workspaceValidateModule from './workspace-validate.js';
import {
  type AgovOutputFormat,
  renderAgovCheckReport,
  renderAgovDependenciesReport,
  renderAgovInspectReport,
  renderAgovMetricsReport,
  renderAgovProfileValidateReport,
  renderAgovRecommendationsReport,
  renderAgovSignalsReport,
  renderAgovViolationsReport,
  renderAgovWorkspaceValidateReport,
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
  runAgovAssess<TInput = unknown>(
    options: AgovAssessOptions<TInput>,
  ): MaybePromise<AgovAssessResult>;
  runAgovProfileValidate(
    options: AgovProfileValidateOptions,
  ): MaybePromise<AgovProfileValidateResult>;
  runAgovWorkspaceValidate(
    options: AgovWorkspaceValidateOptions,
  ): MaybePromise<AgovWorkspaceValidateResult>;
  runAgovDependencies<TInput = unknown>(
    options: AgovDependenciesOptions<TInput>,
  ): MaybePromise<AgovDependenciesResult>;
  runAgovInspect<TInput = unknown>(
    options: AgovInspectOptions<TInput>,
  ): MaybePromise<AgovInspectResult>;
  runAgovMetrics<TInput = unknown>(
    options: AgovMetricsOptions<TInput>,
  ): MaybePromise<AgovMetricsResult>;
  runAgovRecommendations<TInput = unknown>(
    options: AgovRecommendationsOptions<TInput>,
  ): MaybePromise<AgovRecommendationsResult>;
  runAgovSignals<TInput = unknown>(
    options: AgovSignalsOptions<TInput>,
  ): MaybePromise<AgovSignalsResult>;
  runAgovViolations<TInput = unknown>(
    options: AgovViolationsOptions<TInput>,
  ): MaybePromise<AgovViolationsResult>;
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

export type AgovAssessmentCommandName = 'check' | 'assess';
export type AgovProfiledCommandName =
  | AgovAssessmentCommandName
  | 'metrics'
  | 'recommendations'
  | 'signals'
  | 'violations';
export type AgovWorkspaceCommandName =
  | AgovProfiledCommandName
  | 'dependencies'
  | 'inspect'
  | 'workspace validate';

export interface ParsedAgovDependenciesOptions {
  command: 'dependencies';
  configPath?: string;
  workspacePath?: string;
  adapterPackage?: string;
  rootPath?: string;
  format?: AgovOutputFormat;
  outputPath?: string;
  filters?: AgovDependenciesFilters;
  showHelp: boolean;
}

export interface ParsedAgovAssessmentOptions {
  command: AgovProfiledCommandName;
  configPath?: string;
  profilePath?: string;
  workspacePath?: string;
  adapterPackage?: string;
  rootPath?: string;
  format?: AgovOutputFormat;
  outputPath?: string;
  showHelp: boolean;
}

export interface ParsedAgovInspectOptions {
  command: 'inspect';
  configPath?: string;
  workspacePath?: string;
  adapterPackage?: string;
  rootPath?: string;
  format?: AgovOutputFormat;
  outputPath?: string;
  filters?: AgovInspectFilters;
  showHelp: boolean;
}

export type ParsedAgovCheckOptions = ParsedAgovAssessmentOptions & {
  command: 'check';
};

export type ParsedAgovAssessOptions = ParsedAgovAssessmentOptions & {
  command: 'assess';
};

export type ParsedAgovMetricsOptions = ParsedAgovAssessmentOptions & {
  command: 'metrics';
  filters?: AgovMetricsFilters;
};

export type ParsedAgovRecommendationsOptions = ParsedAgovAssessmentOptions & {
  command: 'recommendations';
  filters?: AgovRecommendationsFilters;
};

export type ParsedAgovSignalsOptions = ParsedAgovAssessmentOptions & {
  command: 'signals';
  filters?: AgovSignalsFilters;
};

export type ParsedAgovViolationsOptions = ParsedAgovAssessmentOptions & {
  command: 'violations';
  filters?: AgovViolationsFilters;
};

export type ParsedAgovCliArgs =
  | {
      kind: 'help';
    }
  | {
      kind: 'version';
    }
  | {
      kind: 'profile-validate';
      options: ParsedAgovProfileValidateOptions;
    }
  | {
      kind: 'workspace-validate';
      options: ParsedAgovWorkspaceValidateOptions;
    }
  | {
      kind: 'check';
      options: ParsedAgovCheckOptions;
    }
  | {
      kind: 'assess';
      options: ParsedAgovAssessOptions;
    }
  | {
      kind: 'dependencies';
      options: ParsedAgovDependenciesOptions;
    }
  | {
      kind: 'metrics';
      options: ParsedAgovMetricsOptions;
    }
  | {
      kind: 'recommendations';
      options: ParsedAgovRecommendationsOptions;
    }
  | {
      kind: 'signals';
      options: ParsedAgovSignalsOptions;
    }
  | {
      kind: 'violations';
      options: ParsedAgovViolationsOptions;
    }
  | {
      kind: 'inspect';
      options: ParsedAgovInspectOptions;
    };

export interface AgovResolvedAssessmentCommand {
  command: AgovProfiledCommandName;
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

export interface AgovResolvedWorkspaceCommand {
  command: AgovWorkspaceCommandName;
  rootPath: string;
  format: AgovOutputFormat;
  outputPath?: string;
  configPath?: string;
  mode: 'workspace' | 'adapter' | 'adapter-discovery';
  workspacePath?: string;
  adapterPackage?: string;
  adapterCandidates?: string[];
}

export type AgovResolvedCheckCommand = AgovResolvedAssessmentCommand & {
  command: 'check';
};

export type AgovResolvedAssessCommand = AgovResolvedAssessmentCommand & {
  command: 'assess';
};

export type AgovResolvedMetricsCommand = AgovResolvedAssessmentCommand & {
  command: 'metrics';
  filters?: AgovMetricsFilters;
};

export type AgovResolvedRecommendationsCommand =
  AgovResolvedAssessmentCommand & {
    command: 'recommendations';
    filters?: AgovRecommendationsFilters;
  };

export type AgovResolvedSignalsCommand = AgovResolvedAssessmentCommand & {
  command: 'signals';
  filters?: AgovSignalsFilters;
};

export type AgovResolvedViolationsCommand = AgovResolvedAssessmentCommand & {
  command: 'violations';
  filters?: AgovViolationsFilters;
};

export interface AgovResolvedInspectCommand {
  command: 'inspect';
  rootPath: string;
  format: AgovOutputFormat;
  outputPath?: string;
  configPath?: string;
  mode: 'workspace' | 'adapter' | 'adapter-discovery';
  workspacePath?: string;
  adapterPackage?: string;
  adapterCandidates?: string[];
  filters?: AgovInspectFilters;
}

export interface AgovResolvedDependenciesCommand {
  command: 'dependencies';
  rootPath: string;
  format: AgovOutputFormat;
  outputPath?: string;
  configPath?: string;
  mode: 'workspace' | 'adapter' | 'adapter-discovery';
  workspacePath?: string;
  adapterPackage?: string;
  adapterCandidates?: string[];
  filters?: AgovDependenciesFilters;
}

export interface ParsedAgovProfileValidateOptions {
  command: 'profile validate';
  configPath?: string;
  profilePath?: string;
  format?: AgovOutputFormat;
  outputPath?: string;
  showHelp: boolean;
}

export interface ParsedAgovWorkspaceValidateOptions {
  command: 'workspace validate';
  configPath?: string;
  workspacePath?: string;
  adapterPackage?: string;
  rootPath?: string;
  format?: AgovOutputFormat;
  outputPath?: string;
  showHelp: boolean;
}

export interface AgovResolvedProfileValidateCommand {
  command: 'profile validate';
  profilePath: string;
  format: AgovOutputFormat;
  outputPath?: string;
  configPath?: string;
}

export interface AgovResolvedWorkspaceValidateCommand {
  command: 'workspace validate';
  rootPath: string;
  format: AgovOutputFormat;
  outputPath?: string;
  configPath?: string;
  mode: 'workspace' | 'adapter' | 'adapter-discovery';
  workspacePath?: string;
  adapterPackage?: string;
  adapterCandidates?: string[];
}

export type AgovAssessmentRuntimeOptions<TInput = unknown> =
  AgovCheckOptions<TInput>;

export const AGOV_EXIT_SUCCESS = 0;
export const AGOV_EXIT_GOVERNANCE_FAILURE = 1;
export const AGOV_EXIT_CONFIGURATION_FAILURE = 2;
export const AGOV_EXIT_RUNTIME_FAILURE = 3;

const DEFAULT_AGOV_CLI_RUNTIME: AgovCliRuntime = {
  runAgovCheck: checkModule.runAgovCheck,
  runAgovAssess: checkModule.runAgovAssess,
  runAgovProfileValidate: profileValidateModule.runAgovProfileValidate,
  runAgovWorkspaceValidate: workspaceValidateModule.runAgovWorkspaceValidate,
  runAgovDependencies: dependenciesModule.runAgovDependencies,
  runAgovInspect: inspectModule.runAgovInspect,
  runAgovMetrics: metricsModule.runAgovMetrics,
  runAgovRecommendations: recommendationsModule.runAgovRecommendations,
  runAgovSignals: signalsModule.runAgovSignals,
  runAgovViolations: violationsModule.runAgovViolations,
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
    const parsed = parseAgovCliArgs(argv);

    if (parsed.kind === 'help') {
      io.stdout(renderAgovHelp());
      return AGOV_EXIT_SUCCESS;
    }

    if (parsed.kind === 'version') {
      io.stdout(environment.packageVersion());
      return AGOV_EXIT_SUCCESS;
    }

    if (parsed.options.showHelp) {
      io.stdout(
        parsed.kind === 'profile-validate'
          ? renderAgovProfileValidateHelp()
          : parsed.kind === 'workspace-validate'
            ? renderAgovWorkspaceValidateHelp()
            : parsed.kind === 'check'
              ? renderAgovCheckHelp()
              : parsed.kind === 'assess'
                ? renderAgovAssessHelp()
                : parsed.kind === 'dependencies'
                  ? renderAgovDependenciesHelp()
                  : parsed.kind === 'metrics'
                    ? renderAgovMetricsHelp()
                    : parsed.kind === 'recommendations'
                      ? renderAgovRecommendationsHelp()
                      : parsed.kind === 'signals'
                        ? renderAgovSignalsHelp()
                        : parsed.kind === 'violations'
                          ? renderAgovViolationsHelp()
                          : renderAgovInspectHelp(),
      );
      return AGOV_EXIT_SUCCESS;
    }

    if (parsed.kind === 'profile-validate') {
      const resolved = resolveAgovProfileValidateCommand(
        parsed.options,
        environment,
      );

      let result: AgovProfileValidateResult;
      try {
        const runtimeOptions = await resolveAgovRuntimeOptions(
          resolved,
          environment,
        );
        result = await Promise.resolve(
          runtime.runAgovProfileValidate(runtimeOptions),
        );
      } catch (error) {
        if (error instanceof StandaloneGovernanceProfileLoadError) {
          throw new AgovCliUsageError(error.message, 'agov.cli.invalid_config');
        }

        throw error;
      }

      const rendered = renderAgovProfileValidateReport(result, resolved.format);

      if (resolved.outputPath) {
        writeAgovOutput(resolved.outputPath, rendered);
      } else {
        io.stdout(rendered);
      }

      return result.success
        ? AGOV_EXIT_SUCCESS
        : AGOV_EXIT_CONFIGURATION_FAILURE;
    }

    if (parsed.kind === 'workspace-validate') {
      const resolved = resolveAgovWorkspaceValidateCommand(
        parsed.options,
        environment,
      );
      const runtimeOptions = await resolveAgovRuntimeOptions(
        resolved,
        environment,
      );
      const result = await Promise.resolve(
        runtime.runAgovWorkspaceValidate(runtimeOptions),
      );
      const rendered = renderAgovWorkspaceValidateReport(
        result,
        resolved.format,
      );

      if (resolved.outputPath) {
        writeAgovOutput(resolved.outputPath, rendered);
      } else {
        io.stdout(rendered);
      }

      return result.success
        ? AGOV_EXIT_SUCCESS
        : AGOV_EXIT_CONFIGURATION_FAILURE;
    }

    if (parsed.kind === 'inspect') {
      const resolved = resolveAgovInspectCommand(parsed.options, environment);
      const runtimeOptions = await resolveAgovRuntimeOptions(
        resolved,
        environment,
      );
      const result = await Promise.resolve(
        runtime.runAgovInspect(runtimeOptions),
      );
      const rendered = renderAgovInspectReport(result, resolved.format);

      if (resolved.outputPath) {
        writeAgovOutput(resolved.outputPath, rendered);
      } else {
        io.stdout(rendered);
      }

      return AGOV_EXIT_SUCCESS;
    }

    if (parsed.kind === 'dependencies') {
      const resolved = resolveAgovDependenciesCommand(
        parsed.options,
        environment,
      );
      const runtimeOptions = await resolveAgovRuntimeOptions(
        resolved,
        environment,
      );
      const result = await Promise.resolve(
        runtime.runAgovDependencies(runtimeOptions),
      );
      const rendered = renderAgovDependenciesReport(result, resolved.format);

      if (resolved.outputPath) {
        writeAgovOutput(resolved.outputPath, rendered);
      } else {
        io.stdout(rendered);
      }

      return AGOV_EXIT_SUCCESS;
    }

    if (parsed.kind === 'metrics') {
      const resolved = resolveAgovMetricsCommand(parsed.options, environment);
      const runtimeOptions = await resolveAgovRuntimeOptions(
        resolved,
        environment,
      );
      const result = await Promise.resolve(
        runtime.runAgovMetrics(runtimeOptions),
      );
      const rendered = renderAgovMetricsReport(result, resolved.format);

      if (resolved.outputPath) {
        writeAgovOutput(resolved.outputPath, rendered);
      } else {
        io.stdout(rendered);
      }

      return AGOV_EXIT_SUCCESS;
    }

    if (parsed.kind === 'recommendations') {
      const resolved = resolveAgovRecommendationsCommand(
        parsed.options,
        environment,
      );
      const runtimeOptions = await resolveAgovRuntimeOptions(
        resolved,
        environment,
      );
      const result = await Promise.resolve(
        runtime.runAgovRecommendations(runtimeOptions),
      );
      const rendered = renderAgovRecommendationsReport(result, resolved.format);

      if (resolved.outputPath) {
        writeAgovOutput(resolved.outputPath, rendered);
      } else {
        io.stdout(rendered);
      }

      return AGOV_EXIT_SUCCESS;
    }

    if (parsed.kind === 'signals') {
      const resolved = resolveAgovSignalsCommand(parsed.options, environment);
      const runtimeOptions = await resolveAgovRuntimeOptions(
        resolved,
        environment,
      );
      const result = await Promise.resolve(
        runtime.runAgovSignals(runtimeOptions),
      );
      const rendered = renderAgovSignalsReport(result, resolved.format);

      if (resolved.outputPath) {
        writeAgovOutput(resolved.outputPath, rendered);
      } else {
        io.stdout(rendered);
      }

      return AGOV_EXIT_SUCCESS;
    }

    if (parsed.kind === 'violations') {
      const resolved = resolveAgovViolationsCommand(
        parsed.options,
        environment,
      );
      const runtimeOptions = await resolveAgovRuntimeOptions(
        resolved,
        environment,
      );
      const result = await Promise.resolve(
        runtime.runAgovViolations(runtimeOptions),
      );
      const rendered = renderAgovViolationsReport(result, resolved.format);

      if (resolved.outputPath) {
        writeAgovOutput(resolved.outputPath, rendered);
      } else {
        io.stdout(rendered);
      }

      return AGOV_EXIT_SUCCESS;
    }

    const resolved =
      parsed.kind === 'check'
        ? resolveAgovCheckCommand(parsed.options, environment)
        : resolveAgovAssessCommand(parsed.options, environment);
    const runtimeOptions = await resolveAgovRuntimeOptions(
      resolved,
      environment,
    );
    const result =
      parsed.kind === 'check'
        ? await Promise.resolve(runtime.runAgovCheck(runtimeOptions))
        : await Promise.resolve(runtime.runAgovAssess(runtimeOptions));
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

export function parseAgovCliArgs(argv: string[]): ParsedAgovCliArgs {
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

  if (command === 'profile') {
    const [subcommand, ...subcommandArgs] = rest;

    if (subcommand === 'validate') {
      return {
        kind: 'profile-validate',
        options: parseAgovProfileValidateArgs(subcommandArgs),
      };
    }

    throw new AgovCliUsageError(
      'Unsupported agov command "profile". Supported profile command is "profile validate".',
      'agov.cli.unknown_command',
    );
  }

  if (command === 'workspace') {
    const [subcommand, ...subcommandArgs] = rest;

    if (subcommand === 'validate') {
      return {
        kind: 'workspace-validate',
        options: parseAgovWorkspaceValidateArgs(subcommandArgs),
      };
    }

    throw new AgovCliUsageError(
      'Unsupported agov command "workspace". Supported workspace command is "workspace validate".',
      'agov.cli.unknown_command',
    );
  }

  if (
    command !== 'check' &&
    command !== 'assess' &&
    command !== 'dependencies' &&
    command !== 'inspect' &&
    command !== 'metrics' &&
    command !== 'recommendations' &&
    command !== 'signals' &&
    command !== 'violations'
  ) {
    throw new AgovCliUsageError(
      `Unsupported agov command "${command}". Supported commands are "profile validate", "workspace validate", "check", "assess", "dependencies", "inspect", "metrics", "recommendations", "signals", "violations", "--help", and "--version".`,
      'agov.cli.unknown_command',
    );
  }

  if (command === 'dependencies') {
    return {
      kind: 'dependencies',
      options: parseAgovDependenciesArgs(rest),
    };
  }

  if (command === 'check') {
    return {
      kind: 'check',
      options: parseAgovCheckArgs(rest),
    };
  }

  if (command === 'inspect') {
    return {
      kind: 'inspect',
      options: parseAgovInspectArgs(rest),
    };
  }

  if (command === 'metrics') {
    return {
      kind: 'metrics',
      options: parseAgovMetricsArgs(rest),
    };
  }

  if (command === 'recommendations') {
    return {
      kind: 'recommendations',
      options: parseAgovRecommendationsArgs(rest),
    };
  }

  if (command === 'signals') {
    return {
      kind: 'signals',
      options: parseAgovSignalsArgs(rest),
    };
  }

  if (command === 'violations') {
    return {
      kind: 'violations',
      options: parseAgovViolationsArgs(rest),
    };
  }

  return {
    kind: 'assess',
    options: parseAgovAssessArgs(rest),
  };
}

function parseAgovWorkspaceValidateArgs(
  args: string[],
): ParsedAgovWorkspaceValidateOptions {
  let configPath: string | undefined;
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
          'Unsupported agov workspace validate format. Supported formats are "table", "markdown", "text", and "json".',
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
    command: 'workspace validate',
    configPath,
    workspacePath,
    adapterPackage,
    rootPath,
    format,
    outputPath,
    showHelp,
  };
}

function parseAgovProfileValidateArgs(
  args: string[],
): ParsedAgovProfileValidateOptions {
  let configPath: string | undefined;
  let profilePath: string | undefined;
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
          'Unsupported agov profile validate format. Supported formats are "table", "markdown", "text", and "json".',
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
    command: 'profile validate',
    configPath,
    profilePath,
    format,
    outputPath,
    showHelp,
  };
}

function parseAgovDependenciesArgs(
  args: string[],
): ParsedAgovDependenciesOptions {
  let configPath: string | undefined;
  let workspacePath: string | undefined;
  let adapterPackage: string | undefined;
  let rootPath: string | undefined;
  let format: AgovOutputFormat | undefined;
  let outputPath: string | undefined;
  let showHelp = false;
  const filters: AgovDependenciesFilters = {};

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
          'Unsupported agov dependencies format. Supported formats are "table", "markdown", "text", and "json".',
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

    if (arg === '--source') {
      filters.source = readRequiredOptionValue(args, index, '--source');
      index += 1;
      continue;
    }

    if (arg === '--target') {
      filters.target = readRequiredOptionValue(args, index, '--target');
      index += 1;
      continue;
    }

    if (arg === '--project') {
      filters.project = readRequiredOptionValue(args, index, '--project');
      index += 1;
      continue;
    }

    if (arg === '--type') {
      const value = readRequiredOptionValue(args, index, '--type');
      if (!isAgovDependencyType(value)) {
        throw new AgovCliUsageError(
          `Invalid value for "--type": "${value}". Supported values are "static", "dynamic", "implicit", and "unknown".`,
          'agov.cli.invalid_config',
        );
      }

      filters.type = value;
      index += 1;
      continue;
    }

    throw new AgovCliUsageError(
      `Unknown agov option "${arg}".`,
      'agov.cli.unknown_option',
    );
  }

  return {
    command: 'dependencies',
    configPath,
    workspacePath,
    adapterPackage,
    rootPath,
    format,
    outputPath,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    showHelp,
  };
}

function parseAgovCheckArgs(args: string[]): ParsedAgovCheckOptions {
  return parseAgovAssessmentArgs('check', args);
}

function parseAgovAssessArgs(args: string[]): ParsedAgovAssessOptions {
  return parseAgovAssessmentArgs('assess', args);
}

function parseAgovMetricsArgs(args: string[]): ParsedAgovMetricsOptions {
  const parsed = parseAgovAssessmentArgs('metrics', args);
  const filters: AgovMetricsFilters = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--family') {
      filters.family = readRequiredOptionValue(args, index, '--family');
      index += 1;
      continue;
    }

    if (arg === '--metric') {
      filters.metric = readRequiredOptionValue(args, index, '--metric');
      index += 1;
      continue;
    }

    if (arg === '--weakest') {
      const value = readRequiredOptionValue(args, index, '--weakest');
      const parsedValue = Number.parseInt(value, 10);

      if (!Number.isInteger(parsedValue) || parsedValue < 0) {
        throw new AgovCliUsageError(
          'Invalid value for "--weakest". Expected a non-negative integer.',
          'agov.cli.missing_option_value',
        );
      }

      filters.weakest = parsedValue;
      index += 1;
      continue;
    }
  }

  return {
    ...parsed,
    command: 'metrics',
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  };
}

function parseAgovRecommendationsArgs(
  args: string[],
): ParsedAgovRecommendationsOptions {
  const parsed = parseAgovAssessmentArgs('recommendations', args);
  const filters: AgovRecommendationsFilters = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--priority') {
      const value = readRequiredOptionValue(args, index, '--priority');
      if (!isAgovRecommendationPriority(value)) {
        throw new AgovCliUsageError(
          `Invalid value for "--priority": "${value}". Supported values are "high", "medium", and "low".`,
          'agov.cli.invalid_config',
        );
      }

      filters.priority = value;
      index += 1;
      continue;
    }
  }

  return {
    ...parsed,
    command: 'recommendations',
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  };
}

function parseAgovSignalsArgs(args: string[]): ParsedAgovSignalsOptions {
  const parsed = parseAgovAssessmentArgs('signals', args);
  const filters: AgovSignalsFilters = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--source') {
      filters.source = readRequiredOptionValue(args, index, '--source');
      index += 1;
      continue;
    }

    if (arg === '--type') {
      filters.type = readRequiredOptionValue(args, index, '--type');
      index += 1;
      continue;
    }

    if (arg === '--severity') {
      const value = readRequiredOptionValue(args, index, '--severity');
      if (!isAgovSignalSeverity(value)) {
        throw new AgovCliUsageError(
          `Invalid value for "--severity": "${value}". Supported values are "error", "warning", and "info".`,
          'agov.cli.invalid_config',
        );
      }

      filters.severity = value;
      index += 1;
      continue;
    }
  }

  return {
    ...parsed,
    command: 'signals',
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  };
}

function parseAgovViolationsArgs(args: string[]): ParsedAgovViolationsOptions {
  const parsed = parseAgovAssessmentArgs('violations', args);
  const filters: AgovViolationsFilters = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--severity') {
      const value = readRequiredOptionValue(args, index, '--severity');
      if (!isAgovViolationSeverity(value)) {
        throw new AgovCliUsageError(
          `Invalid value for "--severity": "${value}". Supported values are "error", "warning", and "info".`,
          'agov.cli.invalid_config',
        );
      }

      filters.severity = value;
      index += 1;
      continue;
    }

    if (arg === '--rule') {
      filters.rule = readRequiredOptionValue(args, index, '--rule');
      index += 1;
      continue;
    }

    if (arg === '--category') {
      filters.category = readRequiredOptionValue(args, index, '--category');
      index += 1;
      continue;
    }

    if (arg === '--project') {
      filters.project = readRequiredOptionValue(args, index, '--project');
      index += 1;
      continue;
    }

    if (arg === '--source-plugin') {
      filters.sourcePlugin = readRequiredOptionValue(
        args,
        index,
        '--source-plugin',
      );
      index += 1;
      continue;
    }
  }

  return {
    ...parsed,
    command: 'violations',
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  };
}

function parseAgovInspectArgs(args: string[]): ParsedAgovInspectOptions {
  let configPath: string | undefined;
  let workspacePath: string | undefined;
  let adapterPackage: string | undefined;
  let rootPath: string | undefined;
  let format: AgovOutputFormat | undefined;
  let outputPath: string | undefined;
  let showHelp = false;
  const filters: AgovInspectFilters = {};

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
          `Unsupported agov inspect format. Supported formats are "table", "markdown", "text", and "json".`,
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

    if (arg === '--project') {
      filters.project = readRequiredOptionValue(args, index, '--project');
      index += 1;
      continue;
    }

    if (arg === '--domain') {
      filters.domain = readRequiredOptionValue(args, index, '--domain');
      index += 1;
      continue;
    }

    if (arg === '--layer') {
      filters.layer = readRequiredOptionValue(args, index, '--layer');
      index += 1;
      continue;
    }

    if (arg === '--type') {
      filters.type = readRequiredOptionValue(args, index, '--type');
      index += 1;
      continue;
    }

    throw new AgovCliUsageError(
      `Unknown agov option "${arg}".`,
      'agov.cli.unknown_option',
    );
  }

  return {
    command: 'inspect',
    configPath,
    workspacePath,
    adapterPackage,
    rootPath,
    format,
    outputPath,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    showHelp,
  };
}

function parseAgovAssessmentArgs(
  command: 'check',
  args: string[],
): ParsedAgovCheckOptions;
function parseAgovAssessmentArgs(
  command: 'assess',
  args: string[],
): ParsedAgovAssessOptions;
function parseAgovAssessmentArgs(
  command: 'metrics',
  args: string[],
): ParsedAgovMetricsOptions;
function parseAgovAssessmentArgs(
  command: 'recommendations',
  args: string[],
): ParsedAgovRecommendationsOptions;
function parseAgovAssessmentArgs(
  command: 'signals',
  args: string[],
): ParsedAgovSignalsOptions;
function parseAgovAssessmentArgs(
  command: 'violations',
  args: string[],
): ParsedAgovViolationsOptions;

function parseAgovAssessmentArgs(
  command: AgovProfiledCommandName,
  args: string[],
):
  | ParsedAgovCheckOptions
  | ParsedAgovAssessOptions
  | ParsedAgovMetricsOptions
  | ParsedAgovRecommendationsOptions
  | ParsedAgovSignalsOptions
  | ParsedAgovViolationsOptions {
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
          `Unsupported agov ${command} format. Supported formats are "table", "markdown", "text", and "json".`,
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

    if (
      command === 'metrics' &&
      (arg === '--family' || arg === '--metric' || arg === '--weakest')
    ) {
      index += 1;
      continue;
    }

    if (command === 'recommendations' && arg === '--priority') {
      index += 1;
      continue;
    }

    if (
      command === 'signals' &&
      (arg === '--source' || arg === '--type' || arg === '--severity')
    ) {
      index += 1;
      continue;
    }

    if (
      command === 'violations' &&
      (arg === '--severity' ||
        arg === '--rule' ||
        arg === '--category' ||
        arg === '--project' ||
        arg === '--source-plugin')
    ) {
      index += 1;
      continue;
    }

    throw new AgovCliUsageError(
      `Unknown agov option "${arg}".`,
      'agov.cli.unknown_option',
    );
  }

  return {
    command,
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
  return resolveAgovAssessmentCommand(options, environment);
}

export function resolveAgovAssessCommand(
  options: ParsedAgovAssessOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedAssessCommand {
  return resolveAgovAssessmentCommand(options, environment);
}

export function resolveAgovMetricsCommand(
  options: ParsedAgovMetricsOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedMetricsCommand {
  const resolved = resolveAgovAssessmentCommand(options, environment);

  return {
    ...resolved,
    command: 'metrics',
    filters: options.filters,
  };
}

export function resolveAgovRecommendationsCommand(
  options: ParsedAgovRecommendationsOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedRecommendationsCommand {
  const resolved = resolveAgovAssessmentCommand(options, environment);

  return {
    ...resolved,
    command: 'recommendations',
    filters: options.filters,
  };
}

export function resolveAgovSignalsCommand(
  options: ParsedAgovSignalsOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedSignalsCommand {
  const resolved = resolveAgovAssessmentCommand(options, environment);

  return {
    ...resolved,
    command: 'signals',
    filters: options.filters,
  };
}

export function resolveAgovViolationsCommand(
  options: ParsedAgovViolationsOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedViolationsCommand {
  const resolved = resolveAgovAssessmentCommand(options, environment);

  return {
    ...resolved,
    command: 'violations',
    filters: options.filters,
  };
}

export function resolveAgovInspectCommand(
  options: ParsedAgovInspectOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedInspectCommand {
  const resolved = resolveAgovWorkspaceCommand(options, environment);

  return {
    ...resolved,
    command: 'inspect',
    filters: options.filters,
  };
}

export function resolveAgovDependenciesCommand(
  options: ParsedAgovDependenciesOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedDependenciesCommand {
  const resolved = resolveAgovWorkspaceCommand(options, environment);

  return {
    ...resolved,
    command: 'dependencies',
    filters: options.filters,
  };
}

export function resolveAgovProfileValidateCommand(
  options: ParsedAgovProfileValidateOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedProfileValidateCommand {
  const cwd = path.resolve(environment.cwd());
  const configPath = resolveConfigPath(cwd, undefined, options.configPath);
  const config = configPath ? loadAgovConfig(configPath) : {};
  const configBasePath = configPath ? path.dirname(configPath) : cwd;
  const rootPath =
    resolveConfigRelativePath(config.root, configBasePath) ?? cwd;
  const profilePath =
    resolveExplicitPath(options.profilePath, cwd) ??
    resolveConfigRelativePath(config.profile, configBasePath) ??
    resolveConventionalFile(rootPath, AGOV_PROFILE_FILE_NAMES);

  if (!profilePath) {
    throw new AgovCliUsageError(
      'Could not resolve a governance profile. Pass "--profile <path>", set "profile" in agov.config.json or governance.config.json, or add a conventional profile file such as "governance.profile.json".',
      'agov.cli.missing_profile',
    );
  }

  return {
    command: 'profile validate',
    profilePath,
    format: resolveOutputFormat(
      'profile validate',
      options.format,
      config.format,
    ),
    ...(options.outputPath
      ? { outputPath: resolveExplicitPath(options.outputPath, cwd) }
      : {}),
    ...(configPath ? { configPath } : {}),
  };
}

export function resolveAgovWorkspaceValidateCommand(
  options: ParsedAgovWorkspaceValidateOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedWorkspaceValidateCommand {
  const resolved = resolveAgovWorkspaceCommand(options, environment);

  return {
    ...resolved,
    command: 'workspace validate',
  };
}

export function resolveAgovAssessmentCommand(
  options: ParsedAgovCheckOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedCheckCommand;
export function resolveAgovAssessmentCommand(
  options: ParsedAgovAssessOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedAssessCommand;
export function resolveAgovAssessmentCommand(
  options: ParsedAgovMetricsOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedAssessmentCommand;
export function resolveAgovAssessmentCommand(
  options: ParsedAgovRecommendationsOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedAssessmentCommand;
export function resolveAgovAssessmentCommand(
  options: ParsedAgovSignalsOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedAssessmentCommand;
export function resolveAgovAssessmentCommand(
  options: ParsedAgovViolationsOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedAssessmentCommand;

export function resolveAgovAssessmentCommand(
  options: ParsedAgovAssessmentOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedAssessmentCommand {
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
  const rootPath =
    explicitRootPath ??
    resolveConfigRelativePath(config.root, configBasePath) ??
    cwd;
  const profilePath =
    resolveExplicitPath(options.profilePath, cwd) ??
    resolveConfigRelativePath(config.profile, configBasePath) ??
    resolveConventionalFile(rootPath, AGOV_PROFILE_FILE_NAMES);

  if (!profilePath) {
    throw new AgovCliUsageError(
      'Could not resolve a governance profile. Pass "--profile <path>", set "profile" in agov.config.json or governance.config.json, or add a conventional profile file such as "governance.profile.json".',
      'agov.cli.missing_profile',
    );
  }

  const resolved = resolveAgovWorkspaceCommand(options, environment);

  return {
    ...resolved,
    command: options.command,
    profilePath,
  };
}

function resolveAgovWorkspaceCommand(
  options:
    | ParsedAgovAssessmentOptions
    | ParsedAgovDependenciesOptions
    | ParsedAgovInspectOptions
    | ParsedAgovWorkspaceValidateOptions,
  environment: Pick<AgovCliEnvironment, 'cwd'>,
): AgovResolvedWorkspaceCommand {
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
      `Config file cannot define both adapter-mode and workspace-mode inputs for agov ${options.command}. Pass one mode only, or override explicitly with CLI flags.`,
      'agov.cli.invalid_config',
    );
  }

  if (options.workspacePath && options.adapterPackage) {
    throw new AgovCliUsageError(
      `agov ${options.command} does not allow explicit "--workspace" and "--adapter" together. Use canonical workspace mode or adapter mode, not both.`,
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
  const adapterPackage =
    options.adapterPackage ?? readNonEmptyString(config.adapter);
  const adapterCandidates = resolveAdapterCandidatePackages(rootPath, config);
  const format = resolveOutputFormat(
    options.command,
    options.format,
    config.format,
  );
  const outputPath = resolveExplicitPath(options.outputPath, cwd);

  if (explicitWorkspacePath || configuredWorkspacePath) {
    return {
      command: options.command,
      rootPath,
      workspacePath,
      format,
      ...(outputPath ? { outputPath } : {}),
      ...(configPath ? { configPath } : {}),
      mode: 'workspace',
    };
  }

  if (adapterPackage) {
    return {
      command: options.command,
      rootPath,
      adapterPackage,
      format,
      ...(outputPath ? { outputPath } : {}),
      ...(configPath ? { configPath } : {}),
      mode: 'adapter',
    };
  }

  if (adapterCandidates.length > 0) {
    return {
      command: options.command,
      rootPath,
      adapterCandidates,
      format,
      ...(outputPath ? { outputPath } : {}),
      ...(configPath ? { configPath } : {}),
      mode: 'adapter-discovery',
    };
  }

  if (workspacePath) {
    return {
      command: options.command,
      rootPath,
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

export async function resolveAgovRuntimeOptions(
  command: AgovResolvedCheckCommand | AgovResolvedAssessCommand,
  environment: AgovCliEnvironment,
): Promise<AgovAssessmentRuntimeOptions<unknown>>;
export async function resolveAgovRuntimeOptions(
  command: AgovResolvedProfileValidateCommand,
  environment: AgovCliEnvironment,
): Promise<AgovProfileValidateOptions>;
export async function resolveAgovRuntimeOptions(
  command: AgovResolvedWorkspaceValidateCommand,
  environment: AgovCliEnvironment,
): Promise<AgovWorkspaceValidateOptions>;
export async function resolveAgovRuntimeOptions(
  command: AgovResolvedMetricsCommand,
  environment: AgovCliEnvironment,
): Promise<AgovMetricsOptions<unknown>>;
export async function resolveAgovRuntimeOptions(
  command: AgovResolvedRecommendationsCommand,
  environment: AgovCliEnvironment,
): Promise<AgovRecommendationsOptions<unknown>>;
export async function resolveAgovRuntimeOptions(
  command: AgovResolvedSignalsCommand,
  environment: AgovCliEnvironment,
): Promise<AgovSignalsOptions<unknown>>;
export async function resolveAgovRuntimeOptions(
  command: AgovResolvedViolationsCommand,
  environment: AgovCliEnvironment,
): Promise<AgovViolationsOptions<unknown>>;
export async function resolveAgovRuntimeOptions(
  command: AgovResolvedInspectCommand,
  environment: AgovCliEnvironment,
): Promise<AgovInspectOptions<unknown>>;
export async function resolveAgovRuntimeOptions(
  command: AgovResolvedDependenciesCommand,
  environment: AgovCliEnvironment,
): Promise<AgovDependenciesOptions<unknown>>;
export async function resolveAgovRuntimeOptions(
  command:
    | AgovResolvedCheckCommand
    | AgovResolvedAssessCommand
    | AgovResolvedProfileValidateCommand
    | AgovResolvedWorkspaceValidateCommand
    | AgovResolvedDependenciesCommand
    | AgovResolvedInspectCommand
    | AgovResolvedMetricsCommand
    | AgovResolvedRecommendationsCommand
    | AgovResolvedSignalsCommand
    | AgovResolvedViolationsCommand,
  environment: AgovCliEnvironment,
): Promise<
  | AgovAssessmentRuntimeOptions<unknown>
  | AgovProfileValidateOptions
  | AgovWorkspaceValidateOptions
  | AgovDependenciesOptions<unknown>
  | AgovInspectOptions<unknown>
  | AgovMetricsOptions<unknown>
  | AgovRecommendationsOptions<unknown>
  | AgovSignalsOptions<unknown>
  | AgovViolationsOptions<unknown>
> {
  if (command.command === 'profile validate') {
    return {
      profilePath: command.profilePath,
    };
  }

  if (command.command === 'workspace validate') {
    if (command.mode === 'workspace') {
      if (!command.workspacePath) {
        throw new AgovCliRuntimeError(
          'Resolved workspace mode without a workspace path.',
          'agov.cli.unhandled_error',
        );
      }

      return {
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
        workspaceAdapter: resolvedAdapter.adapter,
        workspaceAdapterInput: command.rootPath,
        adapterPackage: resolvedAdapter.packageName,
      };
    }

    const workspaceAdapter = await loadGovernanceWorkspaceAdapter(
      command.adapterPackage,
      command.rootPath,
      environment,
    );

    return {
      workspaceAdapter,
      workspaceAdapterInput: command.rootPath,
      adapterPackage: command.adapterPackage,
    };
  }

  if ('profilePath' in command) {
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
        ...('filters' in command && command.filters
          ? { filters: command.filters }
          : {}),
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
        ...('filters' in command && command.filters
          ? { filters: command.filters }
          : {}),
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
      ...('filters' in command && command.filters
        ? { filters: command.filters }
        : {}),
    };
  }

  if (command.mode === 'workspace') {
    if (!command.workspacePath) {
      throw new AgovCliRuntimeError(
        'Resolved workspace mode without a workspace path.',
        'agov.cli.unhandled_error',
      );
    }

    return {
      workspacePath: command.workspacePath,
      ...(command.filters ? { filters: command.filters } : {}),
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
      workspaceAdapter: resolvedAdapter.adapter,
      workspaceAdapterInput: command.rootPath,
      ...(command.filters ? { filters: command.filters } : {}),
    };
  }

  const workspaceAdapter = await loadGovernanceWorkspaceAdapter(
    command.adapterPackage,
    command.rootPath,
    environment,
  );

  return {
    workspaceAdapter,
    workspaceAdapterInput: command.rootPath,
    ...(command.filters ? { filters: command.filters } : {}),
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
  commandName: AgovWorkspaceCommandName | 'profile validate',
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
      `Unsupported agov ${commandName} format. Supported formats are "table", "markdown", "text", and "json".`,
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

function isAgovViolationSeverity(
  value: string,
): value is AgovViolationSeverity {
  return value === 'error' || value === 'warning' || value === 'info';
}

function isAgovRecommendationPriority(
  value: string,
): value is AgovRecommendationPriority {
  return value === 'high' || value === 'medium' || value === 'low';
}

function isAgovSignalSeverity(value: string): value is AgovSignalSeverity {
  return value === 'error' || value === 'warning' || value === 'info';
}

function isAgovDependencyType(value: string): value is AgovDependencyType {
  return (
    value === 'static' ||
    value === 'dynamic' ||
    value === 'implicit' ||
    value === 'unknown'
  );
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
    '  agov profile validate [options]',
    '  agov workspace validate [options]',
    '  agov check [options]',
    '  agov assess [options]',
    '  agov dependencies [options]',
    '  agov metrics [options]',
    '  agov recommendations [options]',
    '  agov signals [options]',
    '  agov violations [options]',
    '  agov inspect [options]',
    '',
    'Commands:',
    '  check   Run a Governance check using canonical workspace mode or adapter mode.',
    '  assess  Run a Governance assessment using canonical workspace mode or adapter mode.',
    '  profile validate Validate standalone Governance profile documents.',
    '  workspace validate Validate canonical or adapter-produced Governance workspace inputs.',
    '  dependencies Inspect Governance dependency graph data.',
    '  metrics Inspect Governance measurements and health-oriented metrics.',
    '  recommendations Inspect Governance recommendations from assessment artifacts.',
    '  signals Inspect Governance signals from assessment artifacts.',
    '  violations Inspect Governance policy and extension violations.',
    '  inspect Inspect normalized Governance workspace inventory.',
    '',
    'Run "agov profile validate --help", "agov workspace validate --help", "agov check --help", "agov assess --help", "agov dependencies --help", "agov metrics --help", "agov recommendations --help", "agov signals --help", "agov violations --help", or "agov inspect --help" for command-specific options.',
  ].join('\n');
}

function renderAgovWorkspaceValidateHelp(): string {
  return [
    'agov workspace validate',
    '',
    'Usage:',
    '  agov workspace validate --workspace <path> [--format table|markdown|text|json]',
    '  agov workspace validate --adapter <package> --root <path> [--format table|markdown|text|json]',
    '  agov workspace validate [--config <path>]',
    '',
    'Resolution order:',
    '  explicit CLI flag -> config file -> conventional files -> generic adapter discovery and probe -> error',
    '',
    'Options:',
    '  --help              Show workspace validate command help.',
    '  --config <path>     Load agov.config.json or governance.config.json explicitly.',
    '  --workspace <path>  Canonical Governance workspace document.',
    '  --adapter <package> Dynamically load a concrete adapter package.',
    '  --root <path>       Adapter input root. Defaults to the current working directory.',
    '  --format <value>    Output format: table, markdown, text, or json. Defaults to text.',
    '  --output <path>     Write command output to a file instead of stdout.',
    '',
    'Conventions:',
    '  Config:   agov.config.json, governance.config.json',
    '  Workspace: governance.workspace.json, agov.workspace.json, tools/governance/workspace.json',
  ].join('\n');
}

function renderAgovProfileValidateHelp(): string {
  return [
    'agov profile validate',
    '',
    'Usage:',
    '  agov profile validate --profile <path> [--format table|markdown|text|json]',
    '  agov profile validate [--config <path>]',
    '',
    'Resolution order:',
    '  explicit CLI flag -> config file -> conventional files -> error',
    '',
    'Options:',
    '  --help              Show profile validate command help.',
    '  --config <path>     Load agov.config.json or governance.config.json explicitly.',
    '  --profile <path>    Standalone Governance profile document.',
    '  --format <value>    Output format: table, markdown, text, or json. Defaults to text.',
    '  --output <path>     Write command output to a file instead of stdout.',
    '',
    'Conventions:',
    '  Config:   agov.config.json, governance.config.json',
    '  Profile:  tools/governance/profiles/default.json, tools/governance/profile.json, governance.profile.json, agov.profile.json',
  ].join('\n');
}

function renderAgovDependenciesHelp(): string {
  return [
    'agov dependencies',
    '',
    'Usage:',
    '  agov dependencies --workspace <path> [--format table|markdown|text|json] [filters]',
    '  agov dependencies --adapter <package> --root <path> [--format table|markdown|text|json] [filters]',
    '  agov dependencies [--config <path>]',
    '',
    'Resolution order:',
    '  explicit CLI flag -> config file -> conventional files -> generic adapter discovery and probe -> error',
    '',
    'Options:',
    '  --help              Show dependencies command help.',
    '  --config <path>     Load agov.config.json or governance.config.json explicitly.',
    '  --workspace <path>  Canonical Governance workspace document.',
    '  --adapter <package> Dynamically load a concrete adapter package.',
    '  --root <path>       Adapter input root. Defaults to the current working directory.',
    '  --format <value>    Output format: table, markdown, text, or json. Defaults to text.',
    '  --output <path>     Write command output to a file instead of stdout.',
    '  --source <value>    Filter by source project id or name.',
    '  --target <value>    Filter by target project id or name.',
    '  --project <value>   Filter by source or target project id or name.',
    '  --type <value>      Filter by dependency type: static, dynamic, implicit, unknown.',
    '',
    'Conventions:',
    '  Config:   agov.config.json, governance.config.json',
    '  Workspace: governance.workspace.json, agov.workspace.json, tools/governance/workspace.json',
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

function renderAgovAssessHelp(): string {
  return [
    'agov assess',
    '',
    'Usage:',
    '  agov assess --profile <path> --workspace <path> [--format table|markdown|text|json]',
    '  agov assess --profile <path> --adapter <package> --root <path> [--format table|markdown|text|json]',
    '  agov assess [--config <path>]',
    '',
    'Resolution order:',
    '  explicit CLI flag -> config file -> conventional files -> generic adapter discovery and probe -> error',
    '',
    'Options:',
    '  --help              Show assess command help.',
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

function renderAgovMetricsHelp(): string {
  return [
    'agov metrics',
    '',
    'Usage:',
    '  agov metrics --profile <path> --workspace <path> [--format table|markdown|text|json] [filters]',
    '  agov metrics --profile <path> --adapter <package> --root <path> [--format table|markdown|text|json] [filters]',
    '  agov metrics [--config <path>]',
    '',
    'Resolution order:',
    '  explicit CLI flag -> config file -> conventional files -> generic adapter discovery and probe -> error',
    '',
    'Options:',
    '  --help              Show metrics command help.',
    '  --config <path>     Load agov.config.json or governance.config.json explicitly.',
    '  --profile <path>    Governance profile document.',
    '  --workspace <path>  Canonical Governance workspace document.',
    '  --adapter <package> Dynamically load a concrete adapter package.',
    '  --root <path>       Adapter input root. Defaults to the current working directory.',
    '  --format <value>    Output format: table, markdown, text, or json. Defaults to text.',
    '  --output <path>     Write command output to a file instead of stdout.',
    '  --family <value>    Filter rendered measurements by metric family.',
    '  --metric <value>    Filter rendered measurements by metric id or name.',
    '  --weakest <value>   Limit weakest-metrics summary to a non-negative count.',
    '',
    'Conventions:',
    '  Config:   agov.config.json, governance.config.json',
    '  Profile:  tools/governance/profiles/default.json, tools/governance/profile.json, governance.profile.json, agov.profile.json',
    '  Workspace: governance.workspace.json, agov.workspace.json, tools/governance/workspace.json',
  ].join('\n');
}

function renderAgovRecommendationsHelp(): string {
  return [
    'agov recommendations',
    '',
    'Usage:',
    '  agov recommendations --profile <path> --workspace <path> [--format table|markdown|text|json] [filters]',
    '  agov recommendations --profile <path> --adapter <package> --root <path> [--format table|markdown|text|json] [filters]',
    '  agov recommendations [--config <path>]',
    '',
    'Resolution order:',
    '  explicit CLI flag -> config file -> conventional files -> generic adapter discovery and probe -> error',
    '',
    'Options:',
    '  --help                Show recommendations command help.',
    '  --config <path>       Load agov.config.json or governance.config.json explicitly.',
    '  --profile <path>      Governance profile document.',
    '  --workspace <path>    Canonical Governance workspace document.',
    '  --adapter <package>   Dynamically load a concrete adapter package.',
    '  --root <path>         Adapter input root. Defaults to the current working directory.',
    '  --format <value>      Output format: table, markdown, text, or json. Defaults to text.',
    '  --output <path>       Write command output to a file instead of stdout.',
    '  --priority <value>    Filter recommendations by priority: high, medium, low.',
    '',
    'Conventions:',
    '  Config:   agov.config.json, governance.config.json',
    '  Profile:  tools/governance/profiles/default.json, tools/governance/profile.json, governance.profile.json, agov.profile.json',
    '  Workspace: governance.workspace.json, agov.workspace.json, tools/governance/workspace.json',
  ].join('\n');
}

function renderAgovSignalsHelp(): string {
  return [
    'agov signals',
    '',
    'Usage:',
    '  agov signals --profile <path> --workspace <path> [--format table|markdown|text|json] [filters]',
    '  agov signals --profile <path> --adapter <package> --root <path> [--format table|markdown|text|json] [filters]',
    '  agov signals [--config <path>]',
    '',
    'Resolution order:',
    '  explicit CLI flag -> config file -> conventional files -> generic adapter discovery and probe -> error',
    '',
    'Options:',
    '  --help              Show signals command help.',
    '  --config <path>     Load agov.config.json or governance.config.json explicitly.',
    '  --profile <path>    Governance profile document.',
    '  --workspace <path>  Canonical Governance workspace document.',
    '  --adapter <package> Dynamically load a concrete adapter package.',
    '  --root <path>       Adapter input root. Defaults to the current working directory.',
    '  --format <value>    Output format: table, markdown, text, or json. Defaults to text.',
    '  --output <path>     Write command output to a file instead of stdout.',
    '  --source <value>    Filter signals by source.',
    '  --type <value>      Filter signals by type.',
    '  --severity <value>  Filter signals by severity: error, warning, info.',
    '',
    'Conventions:',
    '  Config:   agov.config.json, governance.config.json',
    '  Profile:  tools/governance/profiles/default.json, tools/governance/profile.json, governance.profile.json, agov.profile.json',
    '  Workspace: governance.workspace.json, agov.workspace.json, tools/governance/workspace.json',
  ].join('\n');
}

function renderAgovViolationsHelp(): string {
  return [
    'agov violations',
    '',
    'Usage:',
    '  agov violations --profile <path> --workspace <path> [--format table|markdown|text|json] [filters]',
    '  agov violations --profile <path> --adapter <package> --root <path> [--format table|markdown|text|json] [filters]',
    '  agov violations [--config <path>]',
    '',
    'Resolution order:',
    '  explicit CLI flag -> config file -> conventional files -> generic adapter discovery and probe -> error',
    '',
    'Options:',
    '  --help                   Show violations command help.',
    '  --config <path>          Load agov.config.json or governance.config.json explicitly.',
    '  --profile <path>         Governance profile document.',
    '  --workspace <path>       Canonical Governance workspace document.',
    '  --adapter <package>      Dynamically load a concrete adapter package.',
    '  --root <path>            Adapter input root. Defaults to the current working directory.',
    '  --format <value>         Output format: table, markdown, text, or json. Defaults to text.',
    '  --output <path>          Write command output to a file instead of stdout.',
    '  --severity <value>       Filter by severity: error, warning, info.',
    '  --rule <value>           Filter by rule id.',
    '  --category <value>       Filter by category.',
    '  --project <value>        Filter by project id.',
    '  --source-plugin <value>  Filter by source plugin id.',
    '',
    'Conventions:',
    '  Config:   agov.config.json, governance.config.json',
    '  Profile:  tools/governance/profiles/default.json, tools/governance/profile.json, governance.profile.json, agov.profile.json',
    '  Workspace: governance.workspace.json, agov.workspace.json, tools/governance/workspace.json',
  ].join('\n');
}

function renderAgovInspectHelp(): string {
  return [
    'agov inspect',
    '',
    'Usage:',
    '  agov inspect --workspace <path> [--format table|markdown|text|json] [filters]',
    '  agov inspect --adapter <package> --root <path> [--format table|markdown|text|json] [filters]',
    '  agov inspect [--config <path>]',
    '',
    'Resolution order:',
    '  explicit CLI flag -> config file -> conventional files -> generic adapter discovery and probe -> error',
    '',
    'Options:',
    '  --help              Show inspect command help.',
    '  --config <path>     Load agov.config.json or governance.config.json explicitly.',
    '  --workspace <path>  Canonical Governance workspace document.',
    '  --adapter <package> Dynamically load a concrete adapter package.',
    '  --root <path>       Adapter input root. Defaults to the current working directory.',
    '  --format <value>    Output format: table, markdown, text, or json. Defaults to text.',
    '  --output <path>     Write command output to a file instead of stdout.',
    '  --project <value>   Filter to a single project by id or name.',
    '  --domain <value>    Filter to projects in a single domain.',
    '  --layer <value>     Filter to projects in a single layer.',
    '  --type <value>      Filter to projects of a single type.',
    '',
    'Conventions:',
    '  Config:   agov.config.json, governance.config.json',
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
