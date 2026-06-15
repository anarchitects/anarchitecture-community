#!/usr/bin/env node

import type { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';

import {
  DBT_GOVERNANCE_ADAPTER_PACKAGE_NAME,
  DBT_GOVERNANCE_EXTENSION_PACKAGE_NAME,
  DBT_GOVERNANCE_RUNTIME_ID,
  DBT_GOVERNANCE_RUNTIME_PACKAGE_NAME,
  DBT_GOVERNANCE_RUNTIME_VERSION,
  dbtGovernanceRuntimeMetadata,
} from '../constants.js';
import type { DbtGovernanceRuntimeResult } from '../contracts.js';
import * as jsonBoundaryModule from '../json-boundary.js';

export interface DbtGovernanceRuntimeProcessIo {
  stdin: NodeJS.ReadableStream;
  stdout: Writable;
  stderr: Writable;
}

export async function runDbtGovernanceRuntimeExecutable(
  io: DbtGovernanceRuntimeProcessIo = {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
  },
): Promise<number> {
  try {
    const inputJson = await readUtf8Stdin(io.stdin);
    const outputJson =
      await jsonBoundaryModule.runDbtGovernanceRuntimeFromJson(inputJson);

    io.stdout.write(outputJson);

    return 0;
  } catch (error) {
    const outputJson = JSON.stringify(buildProcessFailureResult(error));

    try {
      io.stdout.write(outputJson);
    } catch (stdoutError) {
      io.stderr.write(
        `dbt-governance-runtime process failure: ${toErrorMessage(stdoutError)}\n`,
      );
    }

    return 1;
  }
}

export function readUtf8Stdin(stdin: NodeJS.ReadableStream): Promise<string> {
  if ('setEncoding' in stdin && typeof stdin.setEncoding === 'function') {
    stdin.setEncoding('utf8');
  }

  return new Promise((resolve, reject) => {
    const chunks: string[] = [];

    stdin.on('data', (chunk: string | Uint8Array) => {
      chunks.push(
        typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'),
      );
    });
    stdin.on('end', () => {
      resolve(chunks.join(''));
    });
    stdin.on('error', reject);
  });
}

function buildProcessFailureResult(error: unknown): DbtGovernanceRuntimeResult {
  return {
    ok: false,
    runtime: dbtGovernanceRuntimeMetadata,
    diagnostics: [],
    capabilities: [],
    metadata: {
      runtime: {
        packageName: DBT_GOVERNANCE_RUNTIME_PACKAGE_NAME,
        id: DBT_GOVERNANCE_RUNTIME_ID,
        version: DBT_GOVERNANCE_RUNTIME_VERSION,
        adapterPackageName: DBT_GOVERNANCE_ADAPTER_PACKAGE_NAME,
        extensionPackageName: DBT_GOVERNANCE_EXTENSION_PACKAGE_NAME,
        generatedAt: new Date().toISOString(),
      },
    },
    error: {
      code: 'governance.runtime.internal_error',
      stage: 'runtime',
      message: 'Unexpected process failure.',
      details: {
        operation: 'dbt-governance-runtime',
        reason: toErrorMessage(error),
      },
    },
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (isExecutedAsScript()) {
  process.exitCode = await runDbtGovernanceRuntimeExecutable();
}

function isExecutedAsScript(): boolean {
  return (
    typeof process.argv[1] === 'string' &&
    import.meta.url === pathToFileURL(process.argv[1]).href
  );
}
