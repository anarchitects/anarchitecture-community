export { detectTypeScriptWorkspace } from './detect-typescript-workspace.js';
export { buildTypeScriptImportGraph } from './import-graph.js';
export {
  DEFAULT_TYPESCRIPT_PROJECT_DISCOVERY_CONFIG,
  createGovernanceWorkspaceAdapter,
  createTypeScriptWorkspaceAdapter,
  governanceWorkspaceAdapter,
  type CreateGovernanceWorkspaceAdapterOptions,
  type CreateTypeScriptWorkspaceAdapterOptions,
} from './workspace-adapter.js';
export { mapTypeScriptImportsToGovernanceDependencies } from './map-imports-to-projects.js';
export {
  normalizePathAliasesFromConfigs,
  normalizePathAliasesFromConfigs as normalizeTypeScriptPathAliases,
} from './normalize-path-aliases.js';
export { parsePackageManagerWorkspace } from './parse-package-manager-workspace.js';
export {
  parseTsConfigResolution,
  parseTsConfigResolution as parseTsconfig,
} from './parse-tsconfig.js';
export { discoverTypeScriptProjects } from './project-discovery.js';
export {
  resolveTsConfigExtendsChain,
  resolveTsConfigExtendsChain as resolveTsconfigExtends,
} from './resolve-tsconfig-extends.js';
export { resolveWorkspacePackages } from './resolve-workspace-packages.js';
export { deriveProjectTags, type DerivedProjectTags } from './tag-mapping.js';
export type {
  TsConfigResolutionModel,
  TypeScriptImportEdge,
  TypeScriptImportGraph,
  TypeScriptImportKind,
  TypeScriptProjectDependencyMappingResult,
  TypeScriptProjectDiscoveryConfig,
  TypeScriptProjectDiscoveryResult,
  TypeScriptProjectDiscoveryRule,
  TypeScriptSourceFileNode,
  TypeScriptWorkspaceDetectionDiagnostic,
  TypeScriptWorkspaceDetectionResult,
  TypeScriptWorkspaceDetectionStatus,
  TypeScriptWorkspaceIndicators,
  TypeScriptWorkspacePackageManager,
  WorkspacePackageResolution,
} from './types.js';
