import { readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  GovernanceCapability,
  GovernanceDiagnostic,
  GovernanceDiagnosticCategory,
  GovernanceDiagnosticKind,
  GovernanceDiagnosticSeverity,
  GovernanceNodeInput,
  GovernanceRelationInput,
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterProbeResult,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

import { detectTypeScriptWorkspace } from './detect-typescript-workspace.js';
import {
  buildTypeScriptPackageDependencyRelationExpansion,
  buildTypeScriptPathMappingRelationExpansion,
  buildTypeScriptProjectNodeExpansion,
  buildTypeScriptTsconfigNodeExpansion,
  buildTypeScriptWorkspaceExpansion,
  buildTypeScriptWorkspaceMemberRelationExpansion,
  buildTypeScriptWorkspacePackageNodeExpansion,
} from './extension-normalization.js';
import { buildTypeScriptImportGraph } from './import-graph.js';
import { loadPackageMetadata } from './load-package-metadata.js';
import { mapTypeScriptImportsToGovernanceDependencies } from './map-imports-to-projects.js';
import { parsePackageManagerWorkspace } from './parse-package-manager-workspace.js';
import { parseTsConfigResolution } from './parse-tsconfig.js';
import { discoverTypeScriptProjects } from './project-discovery.js';
import type {
  TsConfigResolutionModel,
  TypeScriptDiscoveredProject,
  TypeScriptPackageGovernanceMetadataConfig,
  TypeScriptProjectDiscoveryConfig,
  TypeScriptWorkspaceDetectionDiagnostic,
  WorkspacePackageResolution,
} from './types.js';

export interface CreateTypeScriptWorkspaceAdapterOptions {
  discoveryConfig: TypeScriptProjectDiscoveryConfig;
  packageGovernanceMetadataConfig: TypeScriptPackageGovernanceMetadataConfig;
  tsconfigPath?: string;
  adapterId?: string;
}

export interface CreateGovernanceWorkspaceAdapterOptions {
  discoveryConfig?: TypeScriptProjectDiscoveryConfig;
  packageGovernanceMetadataConfig?: TypeScriptPackageGovernanceMetadataConfig;
  tsconfigPath?: string;
  adapterId?: string;
}

export const DEFAULT_TYPESCRIPT_PROJECT_DISCOVERY_CONFIG = {
  projects: [
    { pattern: 'packages/*', configuredBy: 'default' },
    { pattern: 'packages/*/*', configuredBy: 'default' },
    { pattern: 'apps/*', configuredBy: 'default' },
    { pattern: 'apps/*/*', configuredBy: 'default' },
    { pattern: 'libs/*', configuredBy: 'default' },
    { pattern: 'libs/*/*', configuredBy: 'default' },
    { pattern: 'services/*', configuredBy: 'default' },
    { pattern: 'services/*/*', configuredBy: 'default' },
    { pattern: 'tools/*', configuredBy: 'default' },
    { pattern: 'tools/*/*', configuredBy: 'default' },
  ],
} satisfies TypeScriptProjectDiscoveryConfig;

export const DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG = {
  sourceFile: 'package.json',
  path: ['governance'],
  fields: {
    domain: 'domain',
    layer: 'layer',
    scope: 'scope',
    owner: 'owner',
  },
} satisfies TypeScriptPackageGovernanceMetadataConfig;

const TYPESCRIPT_ADAPTER_SOURCE = {
  id: 'governance-adapter:typescript',
  name: 'TypeScript adapter',
  type: 'adapter',
} as const;

interface LoadedPackageMetadata {
  packageJsonPath: string;
  packageJson?: Record<string, unknown>;
}

export function createTypeScriptWorkspaceAdapter(
  options: CreateTypeScriptWorkspaceAdapterOptions,
): GovernanceWorkspaceAdapter<string> {
  return {
    id: options.adapterId ?? 'governance-adapter:typescript',
    probe(workspacePath: string): GovernanceWorkspaceAdapterProbeResult {
      const detection = detectTypeScriptWorkspace(workspacePath);

      return {
        supported: detection.supported,
        confidence: detection.supported
          ? detection.status === 'supported'
            ? 'high'
            : 'low'
          : 'none',
        reasons: buildProbeReasons(detection),
        diagnostics: canonicalizeAdapterDiagnostics(detection.diagnostics),
        metadata: {
          status: detection.status,
          indicators: detection.indicators,
        },
      };
    },
    loadWorkspace(workspacePath: string): GovernanceWorkspaceAdapterResult {
      const workspaceRoot = path.resolve(workspacePath);
      const workspace = parsePackageManagerWorkspace(workspaceRoot);
      const discovered = discoverTypeScriptProjects(
        workspace,
        options.discoveryConfig,
        options.packageGovernanceMetadataConfig,
      );
      const tsconfig = parseTsConfigResolution(
        workspaceRoot,
        options.tsconfigPath,
      );
      const importGraph = buildTypeScriptImportGraph({
        workspaceRoot,
        projects: discovered.projects,
        tsconfig,
      });
      const mapping = mapTypeScriptImportsToGovernanceDependencies({
        workspaceRoot,
        projects: discovered.projects,
        importGraph,
      });

      const workspaceName = inferWorkspaceName(workspaceRoot);
      const workspacePackageMetadata = loadPackageMetadata(workspaceRoot);
      const workspaceNode = buildWorkspaceNode(
        workspaceRoot,
        workspaceName,
        workspace.packageManager,
        workspacePackageMetadata,
      );
      const projectPackageMetadata = readProjectPackageMetadata(
        workspaceRoot,
        discovered.projects,
      );
      const projectNodes = discovered.projects.map((project) =>
        buildProjectNode(
          project,
          workspace.packageManager,
          projectPackageMetadata,
        ),
      );
      const tsconfigNodes = buildTsconfigNodes(tsconfig);
      const externalPackageNodes = buildExternalPackageNodes(
        workspace.packageManager,
        projectPackageMetadata,
        discovered.projects,
      );
      const relations = sortRelations([
        ...buildWorkspaceMembershipRelations(
          workspaceNode.id,
          discovered.projects,
        ),
        ...mapping.relations,
        ...buildPackageDependencyRelations(
          workspace.packageManager,
          projectPackageMetadata,
          discovered.projects,
        ),
        ...buildTsconfigPathMappingRelations(tsconfig, discovered.projects),
      ]);

      return {
        workspaceId: inferWorkspaceId(workspaceRoot),
        workspaceName,
        workspaceRoot: '.',
        nodes: sortNodes([
          workspaceNode,
          ...projectNodes,
          ...tsconfigNodes,
          ...externalPackageNodes,
        ]),
        relations,
        capabilities: buildCapabilities(workspace, tsconfig),
        diagnostics: canonicalizeAdapterDiagnostics([
          ...workspace.diagnostics,
          ...discovered.diagnostics,
          ...tsconfig.diagnostics,
          ...importGraph.diagnostics,
          ...mapping.diagnostics,
        ]),
        extensions: {
          'governance-extension:typescript': buildTypeScriptWorkspaceExpansion(
            workspaceName,
            normalizeRelativePath(
              workspaceRoot,
              workspacePackageMetadata.packageJsonPath,
            ),
            workspacePackageMetadata.packageJson,
            workspace,
            tsconfig,
            discovered.projects,
          ),
        },
      };
    },
  };
}

export function createGovernanceWorkspaceAdapter(
  options: CreateGovernanceWorkspaceAdapterOptions = {},
): GovernanceWorkspaceAdapter<string> {
  return createTypeScriptWorkspaceAdapter({
    discoveryConfig:
      options.discoveryConfig ?? DEFAULT_TYPESCRIPT_PROJECT_DISCOVERY_CONFIG,
    packageGovernanceMetadataConfig:
      options.packageGovernanceMetadataConfig ??
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    ...(options.tsconfigPath ? { tsconfigPath: options.tsconfigPath } : {}),
    ...(options.adapterId ? { adapterId: options.adapterId } : {}),
  });
}

export const governanceWorkspaceAdapter = createGovernanceWorkspaceAdapter();

export default governanceWorkspaceAdapter;

function buildWorkspaceNode(
  workspaceRoot: string,
  workspaceName: string,
  packageManager?: WorkspacePackageResolution['packageManager'],
  metadata?: LoadedPackageMetadata,
): GovernanceNodeInput {
  const packageMetadata = metadata ?? loadPackageMetadata(workspaceRoot);
  const packageName =
    readOptionalString(packageMetadata.packageJson?.name) ?? workspaceName;

  return {
    id: buildWorkspaceNodeId(packageName),
    name: packageName,
    kind: 'resource',
    sourceSystem: packageManager ?? 'npm',
    root: '.',
    path: 'package.json',
    source: TYPESCRIPT_ADAPTER_SOURCE,
    authority: 'documented',
    confidence: 1,
    extensions: {
      'governance-extension:typescript':
        buildTypeScriptWorkspacePackageNodeExpansion(
          packageManager,
          normalizeRelativePath(workspaceRoot, packageMetadata.packageJsonPath),
          packageMetadata.packageJson,
          {
            packageName,
            workspace: true,
          },
        ),
    },
    metadata: {},
  };
}

function buildProjectNode(
  project: TypeScriptDiscoveredProject,
  packageManager: WorkspacePackageResolution['packageManager'],
  packageMetadataMap: ReadonlyMap<string, LoadedPackageMetadata>,
): GovernanceNodeInput {
  const root = project.root ?? '';
  const packageMetadata = packageMetadataMap.get(project.id);

  return {
    id: project.id,
    name: project.name ?? project.id,
    kind: project.kind ?? 'project',
    technology: 'typescript',
    sourceSystem: packageManager ?? 'typescript',
    ...(root ? { root } : {}),
    ...(root ? { path: root } : {}),
    tags: [...(project.tags ?? [])],
    ...(buildProjectClassification(project)
      ? { classification: buildProjectClassification(project) }
      : {}),
    ...(project.ownership ? { ownership: project.ownership } : {}),
    source: TYPESCRIPT_ADAPTER_SOURCE,
    authority: 'discovered',
    confidence: 1,
    extensions: {
      'governance-extension:typescript': buildTypeScriptProjectNodeExpansion(
        project,
        packageManager,
        packageMetadata?.packageJsonPath,
        packageMetadata?.packageJson,
      ),
    },
    metadata: {
      ...(project.metadata ? { discovery: project.metadata } : {}),
    },
  };
}

function buildProjectClassification(project: TypeScriptDiscoveredProject) {
  const tags = [...(project.tags ?? [])];

  if (
    !project.domain &&
    !project.layer &&
    !project.scope &&
    tags.length === 0
  ) {
    return undefined;
  }

  return {
    ...(project.domain ? { domain: project.domain } : {}),
    ...(project.layer ? { layer: project.layer } : {}),
    ...(project.scope ? { scope: project.scope } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };
}

function buildTsconfigNodes(
  tsconfig: TsConfigResolutionModel,
): GovernanceNodeInput[] {
  return [...tsconfig.configFiles]
    .sort((left, right) => left.localeCompare(right))
    .map((configFile) => ({
      id: buildTsconfigNodeId(configFile),
      name: path.basename(configFile),
      kind: 'resource',
      technology: 'typescript',
      sourceSystem: 'typescript',
      root: path.posix.dirname(configFile),
      path: configFile,
      source: TYPESCRIPT_ADAPTER_SOURCE,
      authority: 'documented',
      confidence: 1,
      extensions: {
        'governance-extension:typescript': buildTypeScriptTsconfigNodeExpansion(
          configFile,
          tsconfig,
        ),
      },
      metadata: {},
    }));
}

function buildExternalPackageNodes(
  packageManager: WorkspacePackageResolution['packageManager'],
  packageMetadataMap: ReadonlyMap<string, LoadedPackageMetadata>,
  projects: readonly TypeScriptDiscoveredProject[],
): GovernanceNodeInput[] {
  const workspacePackageNames = new Set<string>();
  for (const entry of packageMetadataMap.values()) {
    const packageName = readOptionalString(entry.packageJson?.name);
    if (packageName) {
      workspacePackageNames.add(packageName);
    }
  }

  const nodes = new Map<string, GovernanceNodeInput>();

  for (const project of projects) {
    const packageMetadata = packageMetadataMap.get(project.id)?.packageJson;
    if (!packageMetadata) {
      continue;
    }

    for (const dependency of readPackageDependencies(packageMetadata)) {
      if (workspacePackageNames.has(dependency.name)) {
        continue;
      }

      const id = buildExternalPackageNodeId(dependency.name);
      if (nodes.has(id)) {
        continue;
      }

      nodes.set(id, {
        id,
        name: dependency.name,
        kind: 'resource',
        sourceSystem: packageManager ?? 'npm',
        source: TYPESCRIPT_ADAPTER_SOURCE,
        authority: 'documented',
        confidence: 1,
        extensions: {
          'governance-extension:typescript':
            buildTypeScriptWorkspacePackageNodeExpansion(
              packageManager,
              '',
              undefined,
              {
                packageName: dependency.name,
                workspace: false,
                external: true,
              },
            ),
        },
        metadata: {},
      });
    }
  }

  return [...nodes.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function buildWorkspaceMembershipRelations(
  workspaceNodeId: string,
  projects: readonly TypeScriptDiscoveredProject[],
): GovernanceRelationInput[] {
  return [...projects]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((project) => ({
      id: `typescript:workspace-member:${workspaceNodeId}->${project.id}`,
      sourceNodeId: workspaceNodeId,
      targetNodeId: project.id,
      kind: 'traceability',
      source: TYPESCRIPT_ADAPTER_SOURCE,
      authority: 'documented',
      confidence: 1,
      extensions: {
        'governance-extension:typescript':
          buildTypeScriptWorkspaceMemberRelationExpansion(project.root ?? ''),
      },
      metadata: {},
    }));
}

function buildPackageDependencyRelations(
  packageManager: WorkspacePackageResolution['packageManager'],
  packageMetadataMap: ReadonlyMap<string, LoadedPackageMetadata>,
  projects: readonly TypeScriptDiscoveredProject[],
): GovernanceRelationInput[] {
  const packageNameToNodeId = new Map<string, string>();

  for (const project of projects) {
    const packageName = readOptionalString(
      packageMetadataMap.get(project.id)?.packageJson?.name,
    );
    if (packageName) {
      packageNameToNodeId.set(packageName, project.id);
    }
  }

  const relations: GovernanceRelationInput[] = [];
  const relationKeys = new Set<string>();

  for (const project of [...projects].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const packageMetadata = packageMetadataMap.get(project.id)?.packageJson;
    if (!packageMetadata) {
      continue;
    }

    for (const dependency of readPackageDependencies(packageMetadata)) {
      const targetNodeId =
        packageNameToNodeId.get(dependency.name) ??
        buildExternalPackageNodeId(dependency.name);
      const relationId = `typescript:dependency:${project.id}->${targetNodeId}:${dependency.type}`;

      if (relationKeys.has(relationId)) {
        continue;
      }

      relationKeys.add(relationId);
      relations.push({
        id: relationId,
        sourceNodeId: project.id,
        targetNodeId,
        kind: 'dependency',
        source: TYPESCRIPT_ADAPTER_SOURCE,
        authority: 'documented',
        confidence: 1,
        extensions: {
          'governance-extension:typescript':
            buildTypeScriptPackageDependencyRelationExpansion({
              packageManager,
              dependencyType: dependency.type,
              packageName: dependency.name,
              specifier: dependency.specifier,
            }),
        },
        metadata: {},
      });
    }
  }

  return relations;
}

function buildTsconfigPathMappingRelations(
  tsconfig: TsConfigResolutionModel,
  projects: readonly TypeScriptDiscoveredProject[],
): GovernanceRelationInput[] {
  const relations: GovernanceRelationInput[] = [];
  const relationKeys = new Set<string>();

  for (const configFile of [...tsconfig.configFiles].sort()) {
    const tsconfigNodeId = buildTsconfigNodeId(configFile);

    for (const [alias, targets] of Object.entries(tsconfig.pathAliases).sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      for (const target of [...targets].sort()) {
        const normalizedTarget = normalizePath(target.replace(/\/\*$/u, ''));
        const matchingProjects = projects
          .filter((project) => {
            const root = normalizePath(project.root ?? '');
            return root.length > 0 && normalizedTarget.startsWith(root);
          })
          .sort((left, right) => left.id.localeCompare(right.id));

        for (const project of matchingProjects) {
          const relationId = `typescript:path-mapping:${tsconfigNodeId}->${project.id}:${alias}`;
          if (relationKeys.has(relationId)) {
            continue;
          }

          relationKeys.add(relationId);
          relations.push({
            id: relationId,
            sourceNodeId: tsconfigNodeId,
            targetNodeId: project.id,
            kind: 'traceability',
            source: TYPESCRIPT_ADAPTER_SOURCE,
            authority: 'documented',
            confidence: 1,
            extensions: {
              'governance-extension:typescript':
                buildTypeScriptPathMappingRelationExpansion({
                  alias,
                  target,
                  tsconfig: configFile,
                }),
            },
            metadata: {},
          });
        }
      }
    }
  }

  return relations;
}

function readProjectPackageMetadata(
  workspaceRoot: string,
  projects: readonly TypeScriptDiscoveredProject[],
): Map<string, LoadedPackageMetadata> {
  const metadata = new Map<string, LoadedPackageMetadata>();

  for (const project of projects) {
    if (!project.root) {
      continue;
    }

    const loaded = loadPackageMetadata(path.join(workspaceRoot, project.root));
    metadata.set(project.id, {
      packageJsonPath: normalizeRelativePath(
        workspaceRoot,
        loaded.packageJsonPath,
      ),
      packageJson: loaded.packageJson,
    });
  }

  return metadata;
}

function readPackageDependencies(packageJson: Record<string, unknown>): Array<{
  name: string;
  specifier: string;
  type:
    | 'dependencies'
    | 'devDependencies'
    | 'peerDependencies'
    | 'optionalDependencies';
}> {
  const sections = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const;
  const dependencies: Array<{
    name: string;
    specifier: string;
    type: (typeof sections)[number];
  }> = [];

  for (const section of sections) {
    const record = asRecord(packageJson[section]);
    if (!record) {
      continue;
    }

    for (const [name, specifier] of Object.entries(record).sort((left, right) =>
      left[0].localeCompare(right[0]),
    )) {
      if (typeof specifier !== 'string' || specifier.trim().length === 0) {
        continue;
      }

      dependencies.push({
        name,
        specifier,
        type: section,
      });
    }
  }

  return dependencies;
}

function buildCapabilities(
  workspace: WorkspacePackageResolution,
  tsconfig: TsConfigResolutionModel,
): GovernanceCapability[] {
  return [
    {
      id: 'governance.typescript.workspace',
      source: 'governance-adapter:typescript',
      data: {
        packageManager: workspace.packageManager ?? 'unknown',
        patterns: [...workspace.patterns],
        packageRoots: [...workspace.packageRoots],
      },
    },
    {
      id: 'governance.typescript.tsconfig',
      source: 'governance-adapter:typescript',
      data: {
        configFiles: [...tsconfig.configFiles],
        ...(tsconfig.baseUrl ? { baseUrl: tsconfig.baseUrl } : {}),
        pathAliases: tsconfig.pathAliases,
      },
    },
  ];
}

function sortNodes(nodes: GovernanceNodeInput[]): GovernanceNodeInput[] {
  return [...nodes].sort((left, right) => left.id.localeCompare(right.id));
}

function sortRelations(
  relations: GovernanceRelationInput[],
): GovernanceRelationInput[] {
  return [...relations].sort(
    (left, right) =>
      (left.id ?? '').localeCompare(right.id ?? '') ||
      left.sourceNodeId.localeCompare(right.sourceNodeId) ||
      left.targetNodeId.localeCompare(right.targetNodeId) ||
      (left.kind ?? '').localeCompare(right.kind ?? ''),
  );
}

function buildProbeReasons(
  detection: ReturnType<typeof detectTypeScriptWorkspace>,
): string[] {
  const reasons: string[] = [];

  if (detection.indicators.pnpmWorkspace) {
    reasons.push('pnpm-workspace.yaml is present');
  }

  if (detection.indicators.packageManagerWorkspaces) {
    reasons.push('package.json declares package-manager workspaces');
  }

  if (detection.indicators.tsconfig) {
    reasons.push('tsconfig.json is present');
  }

  if (detection.indicators.tsconfigBase) {
    reasons.push('tsconfig.base.json is present');
  }

  if (reasons.length === 0) {
    reasons.push('no TypeScript workspace indicators were found');
  }

  return reasons;
}

function inferWorkspaceId(workspaceRoot: string): string {
  return inferWorkspaceName(workspaceRoot);
}

function inferWorkspaceName(workspaceRoot: string): string {
  const packageJsonPath = path.join(workspaceRoot, 'package.json');

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      typeof (parsed as Record<string, unknown>).name === 'string'
    ) {
      const packageName = (
        (parsed as Record<string, unknown>).name as string
      ).trim();
      if (packageName.length > 0) {
        return packageName;
      }
    }
  } catch {
    // Fall back to the directory name when package.json is absent or invalid.
  }

  return path.basename(workspaceRoot);
}

function buildWorkspaceNodeId(workspaceName: string): string {
  return `workspace:${workspaceName}`;
}

function buildTsconfigNodeId(configFile: string): string {
  return `tsconfig:${normalizePath(configFile)}`;
}

function buildExternalPackageNodeId(packageName: string): string {
  return `package:${packageName}`;
}

function canonicalizeAdapterDiagnostics(
  diagnostics: readonly TypeScriptWorkspaceDetectionDiagnostic[],
): GovernanceDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    const nodeIds = readNodeIds(diagnostic);

    return {
      severity: diagnosticSeverity(diagnostic),
      kind: diagnosticKind(diagnostic),
      category: diagnosticCategory(diagnostic),
      ...(nodeIds.length > 0 ? { reference: { relatedNodeIds: nodeIds } } : {}),
      ...diagnostic,
    };
  });
}

function readNodeIds(
  diagnostic: TypeScriptWorkspaceDetectionDiagnostic,
): string[] {
  const details = asRecord(diagnostic.details);
  const nodeIds = details?.nodeIds;

  return Array.isArray(nodeIds)
    ? nodeIds.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0,
      )
    : [];
}

function diagnosticSeverity(
  diagnostic: TypeScriptWorkspaceDetectionDiagnostic,
): GovernanceDiagnosticSeverity {
  if (
    diagnostic.code ===
      'governance.typescript_adapter.no_workspace_indicators' ||
    isDefaultDiscoveryNoMatchDiagnostic(diagnostic)
  ) {
    return 'info';
  }

  return 'warning';
}

function isDefaultDiscoveryNoMatchDiagnostic(
  diagnostic: TypeScriptWorkspaceDetectionDiagnostic,
): boolean {
  const metadata = asRecord(diagnostic.metadata);

  return (
    diagnostic.code ===
      'governance.typescript_adapter.discovery_pattern_no_matches' &&
    metadata?.configuredBy === 'default'
  );
}

function diagnosticKind(
  diagnostic: TypeScriptWorkspaceDetectionDiagnostic,
): GovernanceDiagnosticKind {
  if (diagnosticSeverity(diagnostic) === 'info') {
    return 'observation';
  }

  return 'warning';
}

function diagnosticCategory(
  diagnostic: TypeScriptWorkspaceDetectionDiagnostic,
): GovernanceDiagnosticCategory {
  const configurationCodes = new Set([
    'governance.typescript_adapter.invalid_package_json',
    'governance.typescript_adapter.invalid_package_metadata_json',
    'governance.typescript_adapter.unsupported_package_metadata_format',
    'governance.typescript_adapter.invalid_package_governance_metadata',
    'governance.typescript_adapter.invalid_package_governance_metadata_field',
    'governance.typescript_adapter.invalid_package_governance_metadata_path_config',
    'governance.typescript_adapter.invalid_package_governance_metadata_path_resolution',
    'governance.typescript_adapter.invalid_package_governance_metadata_field_mapping_config',
    'governance.typescript_adapter.invalid_package_governance_metadata_field_mapping_format',
    'governance.typescript_adapter.invalid_workspace_config',
    'governance.typescript_adapter.unsupported_workspace_format',
    'governance.typescript_adapter.invalid_tsconfig',
    'governance.typescript_adapter.invalid_tsconfig_extends',
    'governance.typescript_adapter.circular_tsconfig_extends',
    'governance.typescript_adapter.invalid_path_alias',
    'governance.typescript_adapter.invalid_discovery_pattern',
    'governance.typescript_adapter.invalid_tag_template',
    'governance.typescript_adapter.invalid_project_name_template',
  ]);

  return configurationCodes.has(diagnostic.code) ? 'configuration' : 'adapter';
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizeRelativePath(
  workspaceRoot: string,
  filePath: string,
): string {
  return normalizePath(path.relative(workspaceRoot, filePath));
}

function normalizePath(value: string): string {
  return value
    .split(path.sep)
    .join('/')
    .replace(/^\.\/+/u, '');
}
