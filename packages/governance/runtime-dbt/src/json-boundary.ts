import type { GovernanceDiagnostic } from '@anarchitects/governance-core';

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
  DbtGovernanceRuntimeInvocationContext,
  DbtGovernanceRuntimeResult,
} from './contracts.js';
import * as runtimeModule from './runtime.js';

export async function runDbtGovernanceRuntimeFromJson(
  inputJson: string,
): Promise<string> {
  const generatedAt = new Date().toISOString();

  let parsedInput: unknown;
  try {
    parsedInput = JSON.parse(inputJson);
  } catch (error) {
    return serializeRuntimeResult(
      buildJsonBoundaryErrorResult(
        {
          code: 'governance.runtime.invalid_input',
          stage: 'input',
          message: 'Runtime input JSON is invalid.',
          details: {
            format: 'json',
            reason: toErrorMessage(error),
          },
        },
        generatedAt,
      ),
    );
  }

  const runtimeContext = readRuntimeInvocationContext(parsedInput);
  const inputValidation = validateRuntimeInput(parsedInput);

  if ('error' in inputValidation) {
    return serializeRuntimeResult(
      buildJsonBoundaryErrorResult(
        inputValidation.error,
        generatedAt,
        inputValidation.diagnostics,
        runtimeContext,
      ),
    );
  }

  try {
    const result = await runtimeModule.runDbtGovernanceRuntime(
      inputValidation.input,
    );

    return serializeRuntimeResult(result);
  } catch (error) {
    return serializeRuntimeResult(
      buildJsonBoundaryErrorResult(
        {
          code: 'governance.runtime.internal_error',
          stage: 'runtime',
          message: 'Unexpected runtime failure.',
          details: {
            operation: 'runDbtGovernanceRuntime',
            reason: toErrorMessage(error),
          },
        },
        generatedAt,
        [],
        runtimeContext,
      ),
    );
  }
}

function validateRuntimeInput(input: unknown):
  | {
      input: DbtGovernanceRuntimeInput;
    }
  | {
      diagnostics: GovernanceDiagnostic[];
      error: DbtGovernanceRuntimeError;
    } {
  if (!isRecord(input)) {
    return buildInvalidInputResult('Runtime input must be a JSON object.', '$');
  }

  if (!isRecord(input.adapter)) {
    return buildInvalidInputResult(
      'Runtime input must include an adapter object.',
      'adapter',
    );
  }

  if (!isRecord(input.adapter.paths)) {
    return buildInvalidInputResult(
      'Runtime input must include adapter.paths as an object.',
      'adapter.paths',
    );
  }

  return {
    input: input as unknown as DbtGovernanceRuntimeInput,
  };
}

function buildInvalidInputResult(
  message: string,
  inputField: string,
): {
  diagnostics: GovernanceDiagnostic[];
  error: DbtGovernanceRuntimeError;
} {
  return {
    diagnostics: [buildJsonBoundaryDiagnostic(message, inputField)],
    error: {
      code: 'governance.runtime.invalid_input',
      stage: 'input',
      message: 'Runtime input is missing or invalid.',
      details: {
        inputField,
      },
    },
  };
}

function buildJsonBoundaryDiagnostic(
  message: string,
  inputField?: string,
): GovernanceDiagnostic {
  return {
    code: 'governance.runtime.invalid_input',
    message,
    severity: 'error',
    kind: 'error',
    category: 'configuration',
    source: dbtGovernanceRuntimeMetadata.id,
    ...(inputField ? { details: { inputField } } : {}),
  };
}

function buildJsonBoundaryErrorResult(
  error: DbtGovernanceRuntimeError,
  generatedAt: string,
  diagnostics: GovernanceDiagnostic[] = [],
  runtimeInput?: DbtGovernanceRuntimeInvocationContext,
): DbtGovernanceRuntimeResult {
  return {
    ok: false,
    runtime: dbtGovernanceRuntimeMetadata,
    diagnostics,
    capabilities: [],
    metadata: {
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
        ...(runtimeInput?.requestId
          ? { requestId: runtimeInput.requestId }
          : {}),
        ...(runtimeInput?.workingDirectory
          ? { workingDirectory: runtimeInput.workingDirectory }
          : {}),
        ...(runtimeInput?.dryRun !== undefined
          ? { dryRun: runtimeInput.dryRun }
          : {}),
        ...(runtimeInput?.metadata ? { metadata: runtimeInput.metadata } : {}),
      },
    },
    error,
  };
}

function readRuntimeInvocationContext(
  input: unknown,
): DbtGovernanceRuntimeInvocationContext | undefined {
  if (!isRecord(input) || !isRecord(input.runtime)) {
    return undefined;
  }

  const runtime = input.runtime;

  return {
    ...(typeof runtime.requestId === 'string'
      ? { requestId: runtime.requestId }
      : {}),
    ...(typeof runtime.workingDirectory === 'string'
      ? { workingDirectory: runtime.workingDirectory }
      : {}),
    ...(typeof runtime.dryRun === 'boolean' ? { dryRun: runtime.dryRun } : {}),
    ...(isRecord(runtime.metadata) ? { metadata: runtime.metadata } : {}),
  };
}

function serializeRuntimeResult(result: DbtGovernanceRuntimeResult): string {
  return JSON.stringify(result);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
