import { createRequire } from 'node:module';

// Use the SemVer implementation declared by the pinned Nx installation.
const requireNx = createRequire(import.meta.resolve('nx/package.json'));
export const semver = requireNx('semver');
export const bumpTypes = Object.freeze({
  init: 'none',
  feat: 'minor',
  fix: 'patch',
  perf: 'patch',
  refactor: 'patch',
  revert: 'patch',
  docs: 'none',
  chore: 'none',
  style: 'none',
  test: 'none',
  e2e: 'none',
  build: 'none',
  ci: 'none',
});

export function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateConfiguration(config, graph) {
  const release = config.release;
  requireCondition(
    release?.projectsRelationship === 'independent',
    'Community releases must be independent',
  );
  requireCondition(
    release.version?.conventionalCommits === true &&
      !release.versionPlans &&
      release.version.specifierSource !== 'version-plans',
    'Nx Conventional Commits must remain the version authority',
  );
  requireCondition(
    release.releaseTag?.pattern === '{projectName}@{version}',
    'Unexpected release tag pattern',
  );
  const types = release.conventionalCommits?.types ?? {};
  requireCondition(
    Object.keys(types).length === Object.keys(bumpTypes).length,
    'Every allowed type needs an explicit, reviewed bump mapping',
  );
  for (const [type, bump] of Object.entries(bumpTypes)) {
    requireCondition(
      types[type]?.semverBump === bump,
      `Incorrect or missing bump mapping: ${type}`,
    );
  }
  requireCondition(
    Array.isArray(release.projects) && release.projects.length > 0,
    'Explicit release projects required',
  );
  for (const name of release.projects)
    requireCondition(
      Object.hasOwn(graph.nodes, name),
      `Unknown release project: ${name}`,
    );
  requireCondition(
    new Set(release.projects).size === release.projects.length,
    'Duplicate release project',
  );
  requireCondition(!release.groups, 'Preserve independent release selection');
  requireCondition(
    release.version.adjustSemverBumpsForZeroMajorVersion === true,
    'Preserve Nx zero-major bump adjustment until an explicit stable-release decision',
  );
  return release.projects;
}

export function parseCommit(message, graph) {
  const header = message.split(/\r?\n/, 1)[0];
  const match = /^([a-z][a-z0-9]*)(?:\(([^()]+)\))?(!)?: (\S.*)$/.exec(header);
  requireCondition(
    match && Object.hasOwn(bumpTypes, match[1]),
    'Use an allowed Conventional Commit type and nonempty subject',
  );
  const scopes = match[2]?.split(',') ?? [];
  requireCondition(
    new Set(scopes).size === scopes.length,
    'Duplicate commit scope',
  );
  for (const scope of scopes)
    requireCondition(
      Object.hasOwn(graph.nodes, scope),
      `Commit scope is not an exact Nx project: ${scope}`,
    );
  requireCondition(
    !/(?:^|\n)BREAKING-CHANGE:/.test(message),
    'Use BREAKING CHANGE: or !; pinned Nx does not detect the hyphenated footer',
  );
  const breaking =
    Boolean(match[3]) ||
    /(?:^|\n)BREAKING(?: CHANGE|-CHANGE):\s*\S/.test(message);
  requireCondition(
    match[1] !== 'init' || (!breaking && scopes.length > 0),
    'init must be scoped and non-breaking',
  );
  return { type: match[1], scopes, breaking };
}

export function touchedProjects(files, graph) {
  const projects = Object.entries(graph.nodes).sort(
    (a, b) => b[1].data.root.length - a[1].data.root.length,
  );
  return [
    ...new Set(
      files
        .map(
          (file) =>
            projects.find(([, node]) => {
              const root = node.data.root.replace(/\/$/, '');
              return (
                root &&
                root !== '.' &&
                (file === root || file.startsWith(`${root}/`))
              );
            })?.[0],
        )
        .filter(Boolean),
    ),
  ];
}

export function validateHistory(history, project) {
  requireCondition(
    history?.project === project,
    `Missing history for ${project}`,
  );
  requireCondition(
    ['npm', 'pypi', 'github'].includes(history.channel),
    'History must identify its distribution channel',
  );
  for (const source of ['tags', 'releases', 'registry']) {
    requireCondition(
      Array.isArray(history[source]),
      `Unverified ${source} history for ${project}`,
    );
    for (const version of history[source])
      requireCondition(
        semver.valid(version) === version,
        `Invalid ${source} version for ${project}: ${version}`,
      );
  }
  return [
    ...new Set([...history.tags, ...history.releases, ...history.registry]),
  ];
}

export function validateCommit({
  message,
  files,
  graph,
  releaseProjects,
  histories,
}) {
  const commit = parseCommit(message, graph);
  const touched = touchedProjects(files, graph).filter((p) =>
    releaseProjects.includes(p),
  );
  for (const p of touched)
    requireCondition(
      commit.scopes.includes(p),
      `Package changes require exact scope ${p}; split or explicitly scope mixed work`,
    );
  const relevant = [
    ...new Set([
      ...touched,
      ...commit.scopes.filter((p) => releaseProjects.includes(p)),
    ]),
  ];
  for (const p of relevant) {
    const published = validateHistory(histories[p], p).length > 0;
    requireCondition(
      published ? commit.type !== 'init' : commit.type === 'init',
      published
        ? `${p} is already released; init is not allowed`
        : `${p} is unreleased; use init(${p}) before its first distribution`,
    );
  }
  return commit;
}

/** Nx computes the candidate version; this guard checks it, never chooses a bump. */
export function validateVersion({
  project,
  version,
  tag,
  manifest,
  artifacts,
  history,
  nxVersion,
  compatibility,
  stableTransition,
}) {
  const versions = validateHistory(history, project);
  requireCondition(
    semver.valid(version) === version,
    `Invalid candidate version: ${version}`,
  );
  requireCondition(
    tag === `${project}@${version}`,
    'Tag/project/version mismatch',
  );
  requireCondition(
    manifest?.version === version &&
      typeof manifest.name === 'string' &&
      manifest.name.length > 0,
    'Source manifest identity/version mismatch',
  );
  requireCondition(
    Array.isArray(artifacts) && artifacts.length > 0,
    'Actual artifact metadata is required',
  );
  for (const artifact of artifacts) {
    requireCondition(
      artifact.name === manifest.name &&
        artifact.version === version &&
        /^[a-f0-9]{64}$/.test(artifact.sha256),
      'Artifact identity/version/digest mismatch',
    );
  }
  requireCondition(
    nxVersion?.newVersion === version,
    'Candidate does not match Nx-derived version data',
  );
  requireCondition(
    compatibility &&
      ['none', 'patch', 'minor', 'major'].includes(compatibility.minimumBump) &&
      typeof compatibility.evidence === 'string' &&
      compatibility.evidence.trim(),
    'Compatibility impact and evidence are required',
  );
  const initialTagHandoff =
    version === '0.0.1' &&
    nxVersion.currentVersion === '0.0.0' &&
    versions.every((v) => v === version);
  if (versions.length === 0 || initialTagHandoff) {
    requireCondition(
      version === '0.0.1',
      'First official Community distribution must be 0.0.1',
    );
  } else {
    requireCondition(
      semver.valid(nxVersion.currentVersion) === nxVersion.currentVersion &&
        versions.includes(nxVersion.currentVersion),
      'Nx baseline is not established by distribution history',
    );
    if (
      semver.major(nxVersion.currentVersion) === 0 &&
      semver.major(version) > 0
    ) {
      requireCondition(
        stableTransition?.version === version &&
          typeof stableTransition.evidence === 'string' &&
          stableTransition.evidence.trim(),
        'Leaving 0.x requires an explicit stable-release decision for this version',
      );
    }
    if (nxVersion.currentVersion !== version) {
      const distributed =
        history.channel === 'github' ? history.releases : history.registry;
      requireCondition(
        distributed.includes(nxVersion.currentVersion),
        'Nx baseline has not reached its distribution channel; reconcile history before advancing',
      );
    }
    // An existing tag/version may be a recovery or additional-channel candidate.
    // Authorizing it and comparing remote bytes is deliberately left to #721.
    if (!versions.includes(version))
      requireCondition(
        versions.every((v) => semver.gt(version, v)),
        'New version must advance existing history; reconcile discrepancies first',
      );
    if (compatibility.minimumBump !== 'none') {
      // Match pinned Nx's adjustment without weakening post-1.0 compatibility.
      const minimum =
        semver.major(nxVersion.currentVersion) === 0
          ? ({ major: 'minor', minor: 'patch' }[compatibility.minimumBump] ??
            compatibility.minimumBump)
          : compatibility.minimumBump;
      const floor = semver.inc(nxVersion.currentVersion, minimum);
      const coreVersion = `${semver.major(version)}.${semver.minor(version)}.${semver.patch(version)}`;
      requireCondition(
        semver.gte(coreVersion, floor),
        `Version is insufficient for ${compatibility.minimumBump} compatibility impact`,
      );
    }
  }
  return { project, version, existingVersion: versions.includes(version) };
}
