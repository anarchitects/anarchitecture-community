import { readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  GovernanceDependencyInput,
  GovernanceDiagnostic,
  GovernanceDiagnosticCategory,
  GovernanceDiagnosticKind,
  GovernanceDiagnosticSeverity,
  GovernanceNodeInput,
  GovernanceProjectInput,
  GovernanceRelationInput,
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterProbeResult,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';
import {
  governanceDependenciesToRelations,
  governanceProjectsToNodes,
} from '@anarchitects/governance-core';

import { detectTypeScriptWorkspace } from './detect-typescript-workspace.js';
import { buildTypeScriptImportGraph } from './import-graph.js';
import { mapTypeScriptImportsToGovernanceDependencies } from './map-imports-to-projects.js';
import { parsePackageManagerWorkspace } from './parse-package-manager-workspace.js';
import { parseTsConfigResolution } from './parse-tsconfig.js';
import { discoverTypeScriptProjects } from './project-discovery.js';
import type {
  TypeScriptWorkspaceDetectionDiagnostic,
  TypeScriptPackageGovernanceMetadataConfig,
  TypeScriptProjectDiscoveryConfig,
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
    { pattern: 'packages/*' },
    { pattern: 'packages/*/*' },
    { pattern: 'apps/*' },
    { pattern: 'apps/*/*' },
    { pattern: 'libs/*' },
    { pattern: 'libs/*/*' },
    { pattern: 'services/*' },
    { pattern: 'services/*/*' },
    { pattern: 'tools/*' },
    { pattern: 'tools/*/*' },
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
      const projects = discovered.projects;
      const dependencies = mapping.dependencies;

      return {
        workspaceId: inferWorkspaceId(workspaceRoot),
        workspaceName: inferWorkspaceName(workspaceRoot),
        workspaceRoot: '.',
        projects,
        dependencies,
        nodes: mapTypeScriptProjectsToGovernanceNodes(projects),
        relations: mapTypeScriptDependenciesToGovernanceRelations(dependencies),
        diagnostics: canonicalizeAdapterDiagnostics([
          ...workspace.diagnostics,
          ...discovered.diagnostics,
          ...tsconfig.diagnostics,
          ...importGraph.diagnostics,
          ...mapping.diagnostics,
        ]),
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

function mapTypeScriptProjectsToGovernanceNodes(
  projects: readonly GovernanceProjectInput[],
): GovernanceNodeInput[] {
  return governanceProjectsToNodes(projects).map((node, index) => {
    const project = projects[index];
    const projectType = inferTypeScriptProjectType(project);

    return {
      ...node,
      kind: projectType,
      technology: 'typescript',
      sourceSystem: 'typescript',
      path: project.root ?? node.root,
      classification: {
        ...(node.classification ?? {}),
        tags: project.tags ?? [],
        metadata: {
          ...(node.classification?.metadata ?? {}),
          projectType,
        },
      },
      metadata: {
        ...(node.metadata ?? {}),
        projectType,
        compatibilityProjectType: project.type ?? 'unknown',
      },
    };
  });
}

function mapTypeScriptDependenciesToGovernanceRelations(
  dependencies: readonly GovernanceDependencyInput[],
): GovernanceRelationInput[] {
  return governanceDependenciesToRelations(dependencies).map(
    (relation, index) => {
      const dependency = dependencies[index];

      return {
        ...relation,
        metadata: {
          ...(relation.metadata ?? {}),
          compatibilityDependencyType: dependency.type ?? 'unknown',
        },
      };
    },
  );
}

function inferTypeScriptProjectType(
  project: GovernanceProjectInput,
): GovernanceNodeInput['kind'] {
  const tagType = tagValue(project.tags ?? [], 'type');

  if (tagType === 'app' || tagType === 'application') {
    return 'application';
  }

  if (tagType === 'lib' || tagType === 'library') {
    return 'library';
  }

  if (tagType === 'tool') {
    return 'tool';
  }

  if (project.type && project.type !== 'unknown') {
    return project.type;
  }

  return 'project';
}

function tagValue(tags: readonly string[], prefix: string): string | undefined {
  const found = tags.find((tag) => tag.startsWith(`${prefix}:`));
  return found?.split(':').slice(1).join(':');
}

function canonicalizeAdapterDiagnostics(
  diagnostics: readonly TypeScriptWorkspaceDetectionDiagnostic[],
): GovernanceDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    severity: diagnosticSeverity(diagnostic),
    kind: diagnosticKind(diagnostic),
    category: diagnosticCategory(diagnostic),
    ...diagnostic,
  }));
}

function diagnosticSeverity(
  diagnostic: TypeScriptWorkspaceDetectionDiagnostic,
): GovernanceDiagnosticSeverity {
  if (
    diagnostic.code === 'governance.typescript_adapter.no_workspace_indicators'
  ) {
    return 'info';
  }

  return 'warning';
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
