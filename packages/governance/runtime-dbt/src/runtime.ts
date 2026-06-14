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
  buildGovernanceWorkspace,
  type GovernanceDiagnostic,
} from '@anarchitects/governance-core';

import { dbtGovernanceRuntimeMetadata } from './constants.js';
import type {
  DbtGovernanceRuntimeError,
  DbtGovernanceRuntimeInput,
  DbtGovernanceRuntimeResult,
  DbtGovernanceRuntimeResultMetadata,
} from './contracts.js';

export async function runDbtGovernanceRuntime(
  input: DbtGovernanceRuntimeInput,
): Promise<DbtGovernanceRuntimeResult> {
  const adapterInputResult = toDbtGovernanceAdapterInput(input);
  const runtimeMetadata = buildRuntimeResultMetadata(input.runtime);

  if ('error' in adapterInputResult) {
    return buildErrorResult(adapterInputResult.error, {
      diagnostics: adapterInputResult.diagnostics,
      metadata: runtimeMetadata,
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
        metadata: runtimeMetadata,
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
        metadata: runtimeMetadata,
      },
    );
  }

  const adapterResult = normalizeDbtArtifacts(
    detected.context,
    loaded.artifacts,
  );
  const workspace = buildGovernanceWorkspace(adapterResult);

  return {
    ok: true,
    runtime: dbtGovernanceRuntimeMetadata,
    diagnostics: adapterResult.diagnostics ?? loaded.diagnostics,
    capabilities: adapterResult.capabilities ?? [],
    metadata: {
      ...runtimeMetadata,
      ...(adapterResult.metadata ? { adapter: adapterResult.metadata } : {}),
    },
    workspace,
  };
}

function toDbtGovernanceAdapterInput(input: DbtGovernanceRuntimeInput):
  | {
      adapterInput: DbtGovernanceAdapterInput;
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
      buildInvalidRuntimeInputDiagnostic(
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

function buildRuntimeResultMetadata(
  runtimeInput: DbtGovernanceRuntimeInput['runtime'] | undefined,
): DbtGovernanceRuntimeResultMetadata | undefined {
  if (!runtimeInput) {
    return undefined;
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
    metadata?: DbtGovernanceRuntimeResultMetadata;
  },
): DbtGovernanceRuntimeResult {
  return {
    ok: false,
    runtime: dbtGovernanceRuntimeMetadata,
    diagnostics: input.diagnostics,
    capabilities: [],
    ...(input.metadata ? { metadata: input.metadata } : {}),
    error,
  };
}

function buildInvalidRuntimeInputDiagnostic(
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
