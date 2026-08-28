import { stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { AngularSsrEngine } from './angular-ssr-engine.js';

const DEFAULT_SERVER_BUNDLE_CANDIDATES = [
  'server/server.mjs',
  'server/main.server.mjs',
  'server/main.mjs',
] as const;

export interface AngularSsrBuildOutputConfiguration {
  root: string;
  browserAssetsDir?: string;
  serverBundleCandidates?: readonly string[];
  engineExport?: string;
  importStrategy?: 'runtime' | 'native';
}

export interface AngularSsrBuildOutputOptions {
  buildOutput: Readonly<AngularSsrBuildOutputConfiguration>;
  allowedHosts?: readonly string[];
}

export interface ResolvedAngularSsrBuildOutput {
  root: string;
  browserAssetsDir: string;
  serverBundlePath: string;
  engineExport: string;
  engine: AngularSsrEngine;
}

export async function resolveAngularSsrBuildOutput(
  options: Readonly<AngularSsrBuildOutputOptions>,
): Promise<ResolvedAngularSsrBuildOutput> {
  const root = resolve(options.buildOutput.root);
  const browserAssetsDir = resolveFromRoot(
    root,
    options.buildOutput.browserAssetsDir ?? 'browser',
  );

  await assertDirectory(browserAssetsDir, 'browser assets directory');

  const serverBundlePath = await resolveExistingFile(
    root,
    options.buildOutput.serverBundleCandidates ??
      DEFAULT_SERVER_BUNDLE_CANDIDATES,
    'Angular server bundle',
  );
  const engineExport = options.buildOutput.engineExport ?? 'angularSsrEngine';
  const serverModule = await importServerBundle(
    pathToFileURL(serverBundlePath).href,
    options.buildOutput.importStrategy ?? 'runtime',
  );
  const engine = serverModule[engineExport];

  if (!isAngularSsrEngine(engine)) {
    throw new Error(
      `Angular server bundle "${serverBundlePath}" does not export an engine named "${engineExport}" with a handle(request, context?) method. Available exports: ${Object.keys(serverModule).sort().join(', ') || '(none)'}.`,
    );
  }

  return {
    root,
    browserAssetsDir,
    serverBundlePath,
    engineExport,
    engine,
  };
}

async function importServerBundle(
  specifier: string,
  strategy: 'runtime' | 'native',
): Promise<Record<string, unknown>> {
  try {
    if (strategy === 'native') {
      return (await import(specifier)) as Record<string, unknown>;
    }

    const runtimeImport = new Function(
      'specifier',
      'return import(specifier)',
    ) as (specifier: string) => Promise<Record<string, unknown>>;

    return await runtimeImport(specifier);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Failed to import Angular server bundle "${specifier}": ${message}`,
    );
  }
}

async function resolveExistingFile(
  root: string,
  candidates: readonly string[],
  description: string,
): Promise<string> {
  for (const candidate of candidates) {
    const path = resolveFromRoot(root, candidate);
    const candidateStat = await getStat(path);

    if (candidateStat?.isFile()) {
      return path;
    }
  }

  const formattedCandidates = candidates
    .map((candidate) => `"${resolveFromRoot(root, candidate)}"`)
    .join(', ');

  throw new Error(
    `${description} was not found. Checked: ${formattedCandidates}. Build the Angular application with outputMode "server" before starting Nest.`,
  );
}

async function assertDirectory(
  path: string,
  description: string,
): Promise<void> {
  const pathStat = await getStat(path);

  if (!pathStat?.isDirectory()) {
    throw new Error(
      `Angular ${description} was not found at "${path}". Build the Angular application with outputMode "server" before starting Nest.`,
    );
  }
}

function resolveFromRoot(root: string, path: string): string {
  return isAbsolute(path) ? resolve(path) : join(root, path);
}

async function getStat(path: string) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

function isAngularSsrEngine(value: unknown): value is AngularSsrEngine {
  return (
    typeof value === 'object' &&
    value !== null &&
    'handle' in value &&
    typeof value.handle === 'function'
  );
}
