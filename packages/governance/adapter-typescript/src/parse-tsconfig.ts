import { existsSync } from 'node:fs';
import path from 'node:path';

import { normalizePathAliasesFromConfigs } from './normalize-path-aliases.js';
import { resolveTsConfigExtendsChain } from './resolve-tsconfig-extends.js';
import type { TsConfigResolutionModel } from './types.js';

export function parseTsConfigResolution(
  workspacePath: string,
  configFilePath?: string,
): TsConfigResolutionModel {
  const workspaceRoot = path.resolve(workspacePath);
  const entryConfigPath = resolveEntryConfigPath(workspaceRoot, configFilePath);

  if (!entryConfigPath) {
    return {
      workspaceRoot,
      configFiles: [],
      pathAliases: {},
      diagnostics: [],
    };
  }

  const resolved = resolveTsConfigExtendsChain(workspaceRoot, entryConfigPath);

  return normalizePathAliasesFromConfigs(
    workspaceRoot,
    resolved.configs,
    resolved.diagnostics,
  );
}

function resolveEntryConfigPath(
  workspaceRoot: string,
  configFilePath?: string,
): string | undefined {
  if (configFilePath) {
    return path.isAbsolute(configFilePath)
      ? configFilePath
      : path.resolve(workspaceRoot, configFilePath);
  }

  const tsConfigPath = path.join(workspaceRoot, 'tsconfig.json');
  if (existsSync(tsConfigPath)) {
    return tsConfigPath;
  }

  const tsConfigBasePath = path.join(workspaceRoot, 'tsconfig.base.json');
  if (existsSync(tsConfigBasePath)) {
    return tsConfigBasePath;
  }

  return undefined;
}
