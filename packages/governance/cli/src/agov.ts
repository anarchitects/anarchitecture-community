import { writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Violation } from '@anarchitects/governance-core';
import {
  GenericWorkspaceLoadError,
  GenericWorkspaceValidationError,
} from './internal/manual-workspace/load-workspace.js';
import {
  StandaloneGovernanceProfileLoadError,
  StandaloneGovernanceProfileValidationError,
} from './internal/profile/load-standalone-profile.js';

import type { AgovCheckResult } from './check.js';
import * as checkModule from './check.js';
import {
  type AgovOutputFormat,
  renderAgovCheckReport,
} from './render-report.js';

export interface AgovCliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface ParsedAgovCheckOptions {
  command: 'check';
  workspacePath: string;
  profilePath: string;
  format: AgovOutputFormat;
  failOn: AgovFailOn;
  outputPath?: string;
}

export type AgovFailOn = 'none' | 'warning' | 'error';

export interface AgovCliRuntime {
  runAgovCheck(options: {
    workspacePath: string;
    profilePath: string;
  }): AgovCheckResult;
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
      | 'agov.cli.missing_workspace'
      | 'agov.cli.missing_profile'
      | 'agov.cli.missing_output'
      | 'agov.cli.unsupported_format'
      | 'agov.cli.unsupported_fail_on'
      | 'agov.cli.unknown_option',
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

export function runAgovCli(
  argv: string[],
  io: AgovCliIo = defaultIo(),
  runtime: AgovCliRuntime = DEFAULT_AGOV_CLI_RUNTIME,
): number {
  try {
    const parsed = parseAgovCliArgs(argv);
    const result = applyAgovFailOn(
      runtime.runAgovCheck({
        workspacePath: parsed.workspacePath,
        profilePath: parsed.profilePath,
      }),
      parsed.failOn,
    );
    const rendered = renderAgovCheckReport(result, parsed.format);

    if (parsed.outputPath) {
      writeAgovOutput(parsed.outputPath, rendered);
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

    if (
      error instanceof GenericWorkspaceLoadError ||
      error instanceof GenericWorkspaceValidationError ||
      error instanceof StandaloneGovernanceProfileLoadError ||
      error instanceof StandaloneGovernanceProfileValidationError
    ) {
      io.stderr(renderStructuredError(error));
      return AGOV_EXIT_CONFIGURATION_FAILURE;
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

export function parseAgovCliArgs(argv: string[]): ParsedAgovCheckOptions {
  const [command, ...args] = argv;

  if (command !== 'check') {
    throw new AgovCliUsageError(
      `Unsupported agov command "${
        command ?? ''
      }". Only "check" is implemented in this MVP.`,
      'agov.cli.unknown_command',
    );
  }

  let workspacePath: string | undefined;
  let profilePath: string | undefined;
  let outputPath: string | undefined;
  let format: AgovOutputFormat = 'json';
  let failOn: AgovFailOn = 'error';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--workspace') {
      workspacePath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--profile') {
      profilePath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--format') {
      const value = args[index + 1];
      index += 1;

      if (value !== 'json' && value !== 'markdown' && value !== 'table') {
        throw new AgovCliUsageError(
          'Unsupported agov check format. Supported formats are "json", "markdown", and "table".',
          'agov.cli.unsupported_format',
        );
      }

      format = value;
      continue;
    }

    if (arg === '--fail-on') {
      const value = args[index + 1];
      index += 1;

      if (value !== 'none' && value !== 'warning' && value !== 'error') {
        throw new AgovCliUsageError(
          'Unsupported agov check fail-on threshold. Supported values are "none", "warning", and "error".',
          'agov.cli.unsupported_fail_on',
        );
      }

      failOn = value;
      continue;
    }

    if (arg === '--output') {
      const value = args[index + 1];
      index += 1;

      if (!value) {
        throw new AgovCliUsageError(
          'Missing required agov check option value for "--output".',
          'agov.cli.missing_output',
        );
      }

      outputPath = value;
      continue;
    }

    throw new AgovCliUsageError(
      `Unknown agov option "${arg}".`,
      'agov.cli.unknown_option',
    );
  }

  if (!workspacePath) {
    throw new AgovCliUsageError(
      'Missing required agov check option "--workspace".',
      'agov.cli.missing_workspace',
    );
  }

  if (!profilePath) {
    throw new AgovCliUsageError(
      'Missing required agov check option "--profile".',
      'agov.cli.missing_profile',
    );
  }

  return {
    command: 'check',
    workspacePath,
    profilePath,
    format,
    failOn,
    ...(outputPath ? { outputPath } : {}),
  };
}

function applyAgovFailOn(
  result: AgovCheckResult,
  failOn: AgovFailOn,
): AgovCheckResult {
  return {
    ...result,
    success: !hasViolationsAtOrAboveThreshold(
      result.assessment.violations,
      failOn,
    ),
  };
}

function hasViolationsAtOrAboveThreshold(
  violations: readonly Violation[],
  failOn: AgovFailOn,
): boolean {
  if (failOn === 'none') {
    return false;
  }

  const thresholdRank = severityRank(failOn);

  return violations.some(
    (violation) => severityRank(violation.severity) >= thresholdRank,
  );
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
