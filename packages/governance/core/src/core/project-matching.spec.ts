import {
  resolveAffectedGovernanceProjects,
  type GovernanceProject,
} from './index.js';

describe('resolveAffectedGovernanceProjects', () => {
  const projects: GovernanceProject[] = [
    {
      id: 'root-app',
      name: 'root-app',
      root: '.',
      type: 'application',
      tags: [],
      metadata: {},
    },
    {
      id: 'foo',
      name: 'foo',
      root: 'apps/foo',
      type: 'application',
      tags: [],
      metadata: {},
    },
    {
      id: 'foo-nested',
      name: 'foo-nested',
      root: 'apps/foo/nested/',
      type: 'library',
      tags: [],
      metadata: {},
    },
    {
      id: 'foobar',
      name: 'foobar',
      root: 'apps/foobar',
      type: 'application',
      tags: [],
      metadata: {},
    },
    {
      id: 'workspace-tooling',
      name: 'workspace-tooling',
      root: '',
      type: 'tool',
      tags: [],
      metadata: {},
    },
  ];

  it('returns an empty array for empty changed files without mutating inputs', () => {
    const changedFiles = ['', '   '];
    const originalProjects = structuredClone(projects);
    const originalChangedFiles = [...changedFiles];

    const result = resolveAffectedGovernanceProjects({
      projects,
      changedFiles,
    });

    expect(result).toEqual([]);
    expect(projects).toEqual(originalProjects);
    expect(changedFiles).toEqual(originalChangedFiles);
  });

  it('matches a single project root and sorts results deterministically by name', () => {
    const result = resolveAffectedGovernanceProjects({
      projects: [projects[3], projects[1]],
      changedFiles: ['apps/foo'],
    });

    expect(result.map((project) => project.name)).toEqual(['foo']);
  });

  it('matches nested project roots for the same changed file', () => {
    const result = resolveAffectedGovernanceProjects({
      projects,
      changedFiles: ['apps/foo/nested/src/index.ts'],
    });

    expect(result.map((project) => project.name)).toEqual([
      'foo',
      'foo-nested',
      'root-app',
      'workspace-tooling',
    ]);
  });

  it('does not allow prefix false positives across sibling roots', () => {
    const result = resolveAffectedGovernanceProjects({
      projects,
      changedFiles: ['apps/foobar/src/main.ts'],
    });

    expect(result.map((project) => project.name)).toEqual([
      'foobar',
      'root-app',
      'workspace-tooling',
    ]);
    expect(result.some((project) => project.name === 'foo')).toBe(false);
  });

  it('normalizes Windows separators, ignores duplicate changed files, and does not mutate input', () => {
    const changedFiles = [
      'apps\\foo\\nested\\src\\index.ts',
      'apps\\foo\\nested\\src\\index.ts',
      '.\\package.json',
    ];
    const originalChangedFiles = [...changedFiles];

    const result = resolveAffectedGovernanceProjects({
      projects,
      changedFiles,
    });

    expect(result.map((project) => project.name)).toEqual([
      'foo',
      'foo-nested',
      'root-app',
      'workspace-tooling',
    ]);
    expect(changedFiles).toEqual(originalChangedFiles);
  });

  it('matches root-level projects for top-level and nested changed files when present', () => {
    const result = resolveAffectedGovernanceProjects({
      projects,
      changedFiles: ['package.json', 'apps/foo/project.json'],
    });

    expect(result.map((project) => project.name)).toEqual([
      'foo',
      'root-app',
      'workspace-tooling',
    ]);
  });
});
