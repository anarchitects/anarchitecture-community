import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverTypeScriptProjects } from './project-discovery.js';
import { DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG } from './workspace-adapter.js';
import type { WorkspacePackageResolution } from './types.js';

const specDir = fileURLToPath(new URL('.', import.meta.url));

describe('TypeScript project discovery', () => {
  it('discovers projects from libs/*/* with deterministic naming and tag mapping', () => {
    const result = discoverTypeScriptProjects(
      workspace({
        packageRoots: ['libs/customer/domain', 'libs/order/domain'],
      }),
      {
        projects: [
          {
            pattern: 'libs/*/*',
            name: '{segment:1}-{segment:2}',
            tags: ['scope:{segment:1}', 'layer:{segment:2}'],
          },
        ],
      },
    );

    expect(result).toEqual({
      workspaceRoot: '/repo',
      projects: [
        {
          id: 'customer-domain',
          name: 'customer-domain',
          root: 'libs/customer/domain',
          type: 'unknown',
          tags: ['scope:customer', 'layer:domain'],
          layer: 'domain',
          scope: 'customer',
          metadata: {},
        },
        {
          id: 'order-domain',
          name: 'order-domain',
          root: 'libs/order/domain',
          type: 'unknown',
          tags: ['scope:order', 'layer:domain'],
          layer: 'domain',
          scope: 'order',
          metadata: {},
        },
      ],
      diagnostics: [],
    });
  });

  it('discovers projects from apps/* with static tags', () => {
    const result = discoverTypeScriptProjects(
      workspace({
        packageRoots: ['apps/admin', 'apps/storefront'],
      }),
      {
        projects: [
          {
            pattern: 'apps/*',
            name: '{segment:1}',
            tags: ['type:app'],
          },
        ],
      },
    );

    expect(result.projects).toEqual([
      {
        id: 'admin',
        name: 'admin',
        root: 'apps/admin',
        type: 'unknown',
        tags: ['type:app'],
        metadata: {},
      },
      {
        id: 'storefront',
        name: 'storefront',
        root: 'apps/storefront',
        type: 'unknown',
        tags: ['type:app'],
        metadata: {},
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('keeps project ordering deterministic by discovered root', () => {
    const result = discoverTypeScriptProjects(
      workspace({
        packageRoots: ['libs/zeta/core', 'libs/alpha/core', 'apps/site'],
      }),
      {
        projects: [
          {
            pattern: 'libs/*/*',
            name: '{segment:1}-{segment:2}',
          },
          {
            pattern: 'apps/*',
            name: '{segment:1}',
          },
        ],
      },
    );

    expect(result.projects.map((project) => project.root)).toEqual([
      'apps/site',
      'libs/alpha/core',
      'libs/zeta/core',
    ]);
  });

  it('reports duplicate roots deterministically and keeps the first match', () => {
    const result = discoverTypeScriptProjects(
      workspace({
        packageRoots: ['apps/site'],
      }),
      {
        projects: [
          {
            pattern: 'apps/*',
            name: '{segment:1}',
          },
          {
            pattern: 'apps/*',
            name: 'duplicate-{segment:1}',
          },
        ],
      },
    );

    expect(result.projects).toEqual([
      {
        id: 'site',
        name: 'site',
        root: 'apps/site',
        type: 'unknown',
        tags: [],
        metadata: {},
      },
    ]);
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.duplicate_project_root',
        message:
          'Duplicate discovered project root "apps/site" is not allowed.',
        source: 'governance.typescript_adapter',
        path: '/projects/1/pattern',
      },
    ]);
  });

  it('reports duplicate names deterministically and keeps the first project', () => {
    const result = discoverTypeScriptProjects(
      workspace({
        packageRoots: ['apps/site', 'packages/site'],
      }),
      {
        projects: [
          {
            pattern: 'apps/*',
            name: '{segment:1}',
          },
          {
            pattern: 'packages/*',
            name: '{segment:1}',
          },
        ],
      },
    );

    expect(result.projects).toEqual([
      {
        id: 'site',
        name: 'site',
        root: 'apps/site',
        type: 'unknown',
        tags: [],
        metadata: {},
      },
    ]);
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.duplicate_project_name',
        message: 'Duplicate discovered project name "site" is not allowed.',
        source: 'governance.typescript_adapter',
        path: '/projects/1/name',
      },
    ]);
  });

  it('reports no-match patterns without crashing', () => {
    const result = discoverTypeScriptProjects(
      workspace({
        packageRoots: ['packages/core'],
      }),
      {
        projects: [
          {
            pattern: 'apps/*',
            name: '{segment:1}',
          },
        ],
      },
    );

    expect(result.projects).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.discovery_pattern_no_matches',
        message: 'Discovery pattern "apps/*" did not match any package roots.',
        source: 'governance.typescript_adapter',
        path: '/projects/0/pattern',
      },
    ]);
  });

  it('reports invalid discovery patterns deterministically', () => {
    const result = discoverTypeScriptProjects(
      workspace({
        packageRoots: ['packages/core'],
      }),
      {
        projects: [
          {
            pattern: '   ',
          },
        ],
      },
    );

    expect(result.projects).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.invalid_discovery_pattern',
        message: 'Discovery pattern must be a non-empty string.',
        source: 'governance.typescript_adapter',
        path: '/projects/0/pattern',
      },
    ]);
  });

  it('reports invalid tag templates and keeps valid static tags', () => {
    const result = discoverTypeScriptProjects(
      workspace({
        packageRoots: ['libs/shared/utils'],
      }),
      {
        projects: [
          {
            pattern: 'libs/*/*',
            name: '{segment:1}-{segment:2}',
            tags: ['scope:{segment:1}', 'type:{segment:3}', 'kind:static'],
          },
        ],
      },
    );

    expect(result.projects).toEqual([
      {
        id: 'shared-utils',
        name: 'shared-utils',
        root: 'libs/shared/utils',
        type: 'unknown',
        tags: ['scope:shared', 'kind:static'],
        scope: 'shared',
        metadata: {},
      },
    ]);
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.invalid_tag_template',
        message: 'Template "type:{segment:3}" references missing segment 3.',
        source: 'governance.typescript_adapter',
        path: '/projects/0/tags/1',
      },
    ]);
  });

  it('reports invalid name templates and skips invalid projects', () => {
    const result = discoverTypeScriptProjects(
      workspace({
        packageRoots: ['libs/shared/utils'],
      }),
      {
        projects: [
          {
            pattern: 'libs/*/*',
            name: '{segment:x}',
          },
        ],
      },
    );

    expect(result.projects).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.invalid_project_name_template',
        message:
          'Template "{segment:x}" contains an invalid {segment:N} placeholder.',
        source: 'governance.typescript_adapter',
        path: '/projects/0/name',
      },
    ]);
  });

  it('maps package metadata to domain, layer, and scope', () => {
    const packageRoot = makeTempPackageRoot({
      governance: {
        domain: 'booking',
        layer: 'domain',
        scope: 'booking',
      },
    });

    const result = discoverTypeScriptProjects(
      workspace({
        workspaceRoot: packageRoot.workspaceRoot,
        packageRoots: ['packages/order'],
      }),
      {
        projects: [
          {
            pattern: 'packages/*',
            name: '{segment:1}',
          },
        ],
      },
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    );

    expect(result.projects).toEqual([
      {
        id: 'order',
        name: 'order',
        root: 'packages/order',
        type: 'unknown',
        tags: ['domain:booking', 'layer:domain', 'scope:booking'],
        domain: 'booking',
        layer: 'domain',
        scope: 'booking',
        metadata: {},
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('maps metadata owner to project.metadata.owner', () => {
    const packageRoot = makeTempPackageRoot({
      governance: {
        owner: 'booking-team',
      },
    });

    const result = discoverTypeScriptProjects(
      workspace({
        workspaceRoot: packageRoot.workspaceRoot,
        packageRoots: ['packages/order'],
      }),
      {
        projects: [
          {
            pattern: 'packages/*',
            name: '{segment:1}',
          },
        ],
      },
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    );

    expect(result.projects).toEqual([
      {
        id: 'order',
        name: 'order',
        root: 'packages/order',
        type: 'unknown',
        tags: [],
        metadata: {
          owner: 'booking-team',
        },
      },
    ]);
  });

  it('preserves existing discovery-derived output when package metadata is absent', () => {
    const packageRoot = makeTempPackageRoot();

    const result = discoverTypeScriptProjects(
      workspace({
        workspaceRoot: packageRoot.workspaceRoot,
        packageRoots: ['libs/customer/domain'],
      }),
      {
        projects: [
          {
            pattern: 'libs/*/*',
            name: '{segment:1}-{segment:2}',
            tags: ['scope:{segment:1}', 'layer:{segment:2}'],
          },
        ],
      },
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    );

    expect(result.projects).toEqual([
      {
        id: 'customer-domain',
        name: 'customer-domain',
        root: 'libs/customer/domain',
        type: 'unknown',
        tags: ['scope:customer', 'layer:domain'],
        layer: 'domain',
        scope: 'customer',
        metadata: {},
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('maps only the present package metadata fields', () => {
    const packageRoot = makeTempPackageRoot({
      governance: {
        domain: 'booking',
        owner: 'booking-team',
      },
    });

    const result = discoverTypeScriptProjects(
      workspace({
        workspaceRoot: packageRoot.workspaceRoot,
        packageRoots: ['packages/order'],
      }),
      {
        projects: [
          {
            pattern: 'packages/*',
            name: '{segment:1}',
            tags: ['layer:application'],
          },
        ],
      },
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    );

    expect(result.projects).toEqual([
      {
        id: 'order',
        name: 'order',
        root: 'packages/order',
        type: 'unknown',
        tags: ['layer:application', 'domain:booking'],
        domain: 'booking',
        layer: 'application',
        metadata: {
          owner: 'booking-team',
        },
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('keeps existing discovery behavior stable when metadata and derived values both exist', () => {
    const packageRoot = makeTempPackageRoot({
      governance: {
        domain: 'booking',
        layer: 'domain',
      },
    });

    const result = discoverTypeScriptProjects(
      workspace({
        workspaceRoot: packageRoot.workspaceRoot,
        packageRoots: ['libs/customer/application'],
      }),
      {
        projects: [
          {
            pattern: 'libs/*/*',
            name: '{segment:1}-{segment:2}',
            tags: ['scope:{segment:1}', 'layer:{segment:2}'],
          },
        ],
      },
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    );

    expect(result.projects).toEqual([
      {
        id: 'customer-application',
        name: 'customer-application',
        root: 'libs/customer/application',
        type: 'unknown',
        tags: [
          'scope:customer',
          'layer:application',
          'domain:booking',
          'layer:domain',
        ],
        domain: 'booking',
        layer: 'domain',
        scope: 'customer',
        metadata: {},
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('merges metadata-derived tags with existing discovery-rule tags deterministically', () => {
    const packageRoot = makeTempPackageRoot({
      governance: {
        domain: 'booking',
        scope: 'ordering',
      },
    });

    const result = discoverTypeScriptProjects(
      workspace({
        workspaceRoot: packageRoot.workspaceRoot,
        packageRoots: ['packages/order'],
      }),
      {
        projects: [
          {
            pattern: 'packages/*',
            name: '{segment:1}',
            tags: ['type:lib', 'layer:application'],
          },
        ],
      },
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    );

    expect(result.projects[0]?.tags).toEqual([
      'type:lib',
      'layer:application',
      'domain:booking',
      'scope:ordering',
    ]);
  });

  it('removes duplicate metadata-derived tags', () => {
    const packageRoot = makeTempPackageRoot({
      governance: {
        layer: 'application',
      },
    });

    const result = discoverTypeScriptProjects(
      workspace({
        workspaceRoot: packageRoot.workspaceRoot,
        packageRoots: ['packages/order'],
      }),
      {
        projects: [
          {
            pattern: 'packages/*',
            name: '{segment:1}',
            tags: ['layer:application', 'layer:application'],
          },
        ],
      },
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    );

    expect(result.projects[0]?.tags).toEqual(['layer:application']);
  });

  it('preserves existing tags when metadata is absent', () => {
    const packageRoot = makeTempPackageRoot();

    const result = discoverTypeScriptProjects(
      workspace({
        workspaceRoot: packageRoot.workspaceRoot,
        packageRoots: ['packages/order'],
      }),
      {
        projects: [
          {
            pattern: 'packages/*',
            name: '{segment:1}',
            tags: ['type:lib'],
          },
        ],
      },
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    );

    expect(result.projects[0]?.tags).toEqual(['type:lib']);
  });

  it('keeps metadata-generated tag ordering deterministic', () => {
    const packageRoot = makeTempPackageRoot({
      governance: {
        scope: 'ordering',
        domain: 'booking',
        layer: 'application',
      },
    });

    const result = discoverTypeScriptProjects(
      workspace({
        workspaceRoot: packageRoot.workspaceRoot,
        packageRoots: ['packages/order'],
      }),
      {
        projects: [
          {
            pattern: 'packages/*',
            name: '{segment:1}',
            tags: ['type:lib'],
          },
        ],
      },
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    );

    expect(result.projects[0]?.tags).toEqual([
      'type:lib',
      'domain:booking',
      'layer:application',
      'scope:ordering',
    ]);
  });

  it('does not import Nx APIs', () => {
    const discoverySource = readFileSync(
      path.join(specDir, 'project-discovery.ts'),
      'utf8',
    );
    const namingSource = readFileSync(
      path.join(specDir, 'project-naming.ts'),
      'utf8',
    );
    const tagsSource = readFileSync(
      path.join(specDir, 'tag-mapping.ts'),
      'utf8',
    );

    expect(discoverySource).not.toMatch(/from ['"]nx['"]/);
    expect(discoverySource).not.toMatch(/from ['"]@nx\//);
    expect(namingSource).not.toMatch(/from ['"]nx['"]/);
    expect(namingSource).not.toMatch(/from ['"]@nx\//);
    expect(tagsSource).not.toMatch(/from ['"]nx['"]/);
    expect(tagsSource).not.toMatch(/from ['"]@nx\//);
  });
});

function workspace(
  overrides: Partial<WorkspacePackageResolution>,
): WorkspacePackageResolution {
  return {
    workspaceRoot: '/repo',
    patterns: [],
    packageRoots: [],
    diagnostics: [],
    ...overrides,
  };
}

function makeTempPackageRoot(packageJson: Record<string, unknown> = {}): {
  workspaceRoot: string;
} {
  const workspaceRoot = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-project-discovery-'),
  );
  const packageRoot = path.join(workspaceRoot, 'packages', 'order');
  const libsRoot = path.join(workspaceRoot, 'libs', 'customer', 'domain');
  const libsApplicationRoot = path.join(
    workspaceRoot,
    'libs',
    'customer',
    'application',
  );

  writePackageJson(path.join(workspaceRoot, 'packages', 'order'), packageJson);
  writePackageJson(path.join(workspaceRoot, 'libs', 'customer', 'domain'), {});
  writePackageJson(
    path.join(workspaceRoot, 'libs', 'customer', 'application'),
    packageJson,
  );

  void packageRoot;
  void libsRoot;
  void libsApplicationRoot;

  return { workspaceRoot };
}

function writePackageJson(
  root: string,
  packageJson: Record<string, unknown>,
): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, 'package.json'), JSON.stringify(packageJson), {
    encoding: 'utf8',
    flag: 'w',
  });
}
