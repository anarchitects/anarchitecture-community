import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildGovernanceAssessmentArtifacts,
  type GovernanceProfile,
} from '@anarchitects/governance-core';

import { discoverTypeScriptProjects } from './project-discovery.js';
import {
  DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
  createGovernanceWorkspaceAdapter,
} from './workspace-adapter.js';

const specDir = fileURLToPath(new URL('.', import.meta.url));

describe('package governance metadata regression coverage', () => {
  it('maps default package.json governance metadata shape into discovery output', () => {
    const workspaceRoot = materializeFixture('pnpm');
    writeJsonFile(path.join(workspaceRoot, 'packages', 'customer'), {
      name: '@fixture/customer',
      governance: {
        domain: 'booking',
        layer: 'domain',
        scope: 'booking',
        owner: 'booking-team',
      },
    });

    const result =
      createGovernanceWorkspaceAdapter().loadWorkspace(workspaceRoot);

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'customer',
          classification: expect.objectContaining({
            domain: 'booking',
            layer: 'domain',
            scope: 'booking',
          }),
          ownership: expect.objectContaining({
            team: 'booking-team',
            source: 'project-metadata',
          }),
          tags: ['domain:booking', 'layer:domain', 'scope:booking'],
        }),
      ]),
    );
    expect(
      result.diagnostics?.filter((entry) =>
        entry.code.startsWith(
          'governance.typescript_adapter.invalid_package_governance_metadata',
        ),
      ),
    ).toEqual([]);
  });

  it('supports custom metadata paths and custom field mappings in adapter options', () => {
    const workspaceRoot = materializeFixture('pnpm');
    writeJsonFile(path.join(workspaceRoot, 'packages', 'customer'), {
      name: '@fixture/customer',
      anarchitects: {
        governance: {
          boundedContext: 'booking',
          architecturalLayer: 'domain',
          moduleScope: 'booking',
          owningTeam: 'booking-team',
        },
      },
    });

    const result = createGovernanceWorkspaceAdapter({
      packageGovernanceMetadataConfig: {
        ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
        path: ['anarchitects', 'governance'],
        fields: {
          domain: 'boundedContext',
          layer: 'architecturalLayer',
          scope: 'moduleScope',
          owner: 'owningTeam',
        },
      },
    }).loadWorkspace(workspaceRoot);

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'customer',
          classification: expect.objectContaining({
            domain: 'booking',
            layer: 'domain',
            scope: 'booking',
          }),
          ownership: expect.objectContaining({
            team: 'booking-team',
            source: 'project-metadata',
          }),
          tags: ['domain:booking', 'layer:domain', 'scope:booking'],
        }),
      ]),
    );
  });

  it('applies precedence to tags deterministically and maps owner to canonical ownership', () => {
    const workspaceRoot = mkdtempSync(
      path.join(tmpdir(), 'governance-typescript-metadata-regression-'),
    );
    writeJsonFile(path.join(workspaceRoot, 'packages', 'orders'), {
      name: '@fixture/orders',
      governance: {
        domain: 'booking',
        layer: 'domain',
        scope: 'booking',
        owner: 'booking-team',
      },
    });

    const discovered = discoverTypeScriptProjects(
      {
        workspaceRoot,
        packageRoots: ['packages/orders'],
        patterns: ['packages/*'],
        diagnostics: [],
      },
      {
        projects: [
          {
            pattern: 'packages/*',
            name: '{segment:1}',
            tags: [
              'type:lib',
              'domain:legacy',
              'layer:application',
              'scope:legacy',
              'type:lib',
            ],
          },
        ],
      },
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    );

    expect(discovered.projects).toEqual([
      {
        id: 'orders',
        name: 'orders',
        root: 'packages/orders',
        type: 'unknown',
        domain: 'booking',
        layer: 'domain',
        scope: 'booking',
        tags: ['type:lib', 'domain:booking', 'layer:domain', 'scope:booking'],
        ownership: {
          team: 'booking-team',
          source: 'project-metadata',
        },
        metadata: {},
      },
    ]);
    expect(discovered.projects[0]?.tags).not.toContain('owner:booking-team');
    expect(discovered.diagnostics).toEqual([]);
  });

  it('prevents ownership-gap assessment output for package governance.owner declarations', async () => {
    const workspaceRoot = createWorkspaceWithPackageOwner('customer');
    const adapterResult =
      createGovernanceWorkspaceAdapter().loadWorkspace(workspaceRoot);
    const artifacts = await buildGovernanceAssessmentArtifacts({
      workspaceAdapterResult: adapterResult,
      profile: {
        name: 'ownership-required',
        boundaryPolicySource: 'profile',
        layers: [],
        allowedDomainDependencies: {
          '*': [],
        },
        ownership: {
          required: true,
          metadataField: 'ownership',
        },
        health: {
          statusThresholds: {
            goodMinScore: 85,
            warningMinScore: 70,
          },
        },
        metrics: {} as GovernanceProfile['metrics'],
      },
      exceptions: [],
      asOf: new Date('2026-06-12T00:00:00.000Z'),
    });

    expect(adapterResult.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'customer',
          ownership: expect.objectContaining({
            team: 'booking-team',
            source: 'project-metadata',
          }),
        }),
      ]),
    );
    expect(artifacts.violations).not.toContainEqual(
      expect.objectContaining({
        ruleId: 'ownership-presence',
        subjectId: 'customer',
      }),
    );
    expect(artifacts.signals).not.toContainEqual(
      expect.objectContaining({
        type: 'ownership-gap',
        nodeId: 'customer',
      }),
    );
  });

  it('includes metadata diagnostics and continues discovery', () => {
    const workspaceRoot = materializeFixture('pnpm');
    writeJsonFile(path.join(workspaceRoot, 'packages', 'customer'), {
      name: '@fixture/customer',
      governance: {
        domain: 42,
      },
    });

    const result =
      createGovernanceWorkspaceAdapter().loadWorkspace(workspaceRoot);

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'web' }),
        expect.objectContaining({ id: 'customer' }),
        expect.objectContaining({ id: 'order' }),
      ]),
    );
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.typescript_adapter.invalid_package_governance_metadata_field',
          path: '/package.json/governance/domain',
        }),
      ]),
    );
  });

  it('keeps workspace output stable without metadata and preserves dependency mapping behavior', () => {
    const workspaceRoot = materializeFixture('pnpm');
    const adapter = createGovernanceWorkspaceAdapter();

    const baseline = adapter.loadWorkspace(workspaceRoot);
    writeJsonFile(path.join(workspaceRoot, 'packages', 'customer'), {
      name: '@fixture/customer',
      governance: {
        domain: 'booking',
      },
    });

    expect(
      baseline.diagnostics?.filter((entry) =>
        entry.code.startsWith(
          'governance.typescript_adapter.invalid_package_governance_metadata',
        ),
      ),
    ).toEqual([]);
  });

  it('surfaces invalid path and field-mapping diagnostics from configured metadata options', () => {
    const workspaceRoot = materializeFixture('pnpm');
    writeJsonFile(path.join(workspaceRoot, 'packages', 'customer'), {
      name: '@fixture/customer',
      governance: {
        domain: 'booking',
      },
    });

    const result = createGovernanceWorkspaceAdapter({
      packageGovernanceMetadataConfig: {
        ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
        path: ['anarchitects', ''] as unknown as string[],
        fields: 'invalid' as unknown as {
          domain: string;
          layer: string;
          scope: string;
          owner: string;
        },
      },
    }).loadWorkspace(workspaceRoot);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.typescript_adapter.invalid_package_governance_metadata_path_config',
        }),
        expect.objectContaining({
          code: 'governance.typescript_adapter.invalid_package_governance_metadata_field_mapping_format',
        }),
      ]),
    );
  });
});

function fixturePath(name: string): string {
  return path.join(
    specDir,
    '..',
    'tests',
    'fixtures',
    'typescript-adapter',
    'workspace-behavior',
    name,
  );
}

function materializeFixture(name: string): string {
  const sourceRoot = fixturePath(name);
  const root = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-workspace-regression-'),
  );
  cpSync(sourceRoot, root, { recursive: true });
  materializePackageJsonTemplates(root);
  return root;
}

function materializePackageJsonTemplates(root: string): void {
  renameIfExists(root, 'fixture.package.json', 'package.json');

  for (const childEntry of readdirSync(root, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    if (!childEntry.isDirectory()) {
      continue;
    }

    materializePackageJsonTemplates(path.join(root, childEntry.name));
  }
}

function renameIfExists(root: string, from: string, to: string): void {
  const source = path.join(root, from);

  if (existsSync(source)) {
    renameSync(source, path.join(root, to));
  }
}

function writeJsonFile(root: string, value: Record<string, unknown>): void {
  mkdirSync(root, { recursive: true });

  const packageJsonPath = path.join(root, 'package.json');
  const current = existsSync(packageJsonPath)
    ? (JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<
        string,
        unknown
      >)
    : {};

  writeFileSync(
    packageJsonPath,
    JSON.stringify({ ...current, ...value }),
    'utf8',
  );
}

function createWorkspaceWithPackageOwner(packageName: string): string {
  const workspaceRoot = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-owner-workspace-'),
  );

  writeFileSync(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify(
      {
        name: '@fixture/workspace',
        private: true,
        workspaces: ['packages/*'],
      },
      null,
      2,
    ),
    'utf8',
  );
  writeJsonFile(path.join(workspaceRoot, 'packages', packageName), {
    name: `@fixture/${packageName}`,
    governance: {
      owner: 'booking-team',
    },
  });

  return workspaceRoot;
}
