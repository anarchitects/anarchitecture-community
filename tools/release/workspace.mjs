import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  requireCondition,
  validateConfiguration,
  validateVersion,
} from './policy.mjs';
import { collectHistories } from './history.mjs';

const requireNx = createRequire(import.meta.resolve('nx/package.json'));
const yaml = requireNx('yaml');
const helper = fileURLToPath(new URL('./artifact.py', import.meta.url));
const python = (kind, path) =>
  JSON.parse(
    execFileSync('python3', [helper, kind, path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
    }),
  );
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const pythonName = (name) => name.toLowerCase().replace(/[-_.]+/g, '-');

export async function workspace(root = process.cwd()) {
  const { createProjectGraphAsync } = await import('@nx/devkit');
  const graph = await createProjectGraphAsync();
  const config = json(join(root, 'nx.json'));
  const projects = validateConfiguration(config, graph);
  return { root, graph, config, projects };
}

export function identity(context, project) {
  requireCondition(
    context.projects.includes(project),
    `Not a release project: ${project}`,
  );
  const root = join(context.root, context.graph.nodes[project].data.root);
  const executor =
    context.graph.nodes[project].data.targets['nx-release-publish']?.executor;
  if (executor === '@nx/js:release-publish') {
    const manifest = json(join(root, 'package.json'));
    requireCondition(
      !manifest.private && typeof manifest.name === 'string',
      'Invalid public npm identity',
    );
    return {
      project,
      channel: 'npm',
      name: manifest.name,
      version: manifest.version,
    };
  }
  if (project === 'governance-host-dbt') {
    const manifest = python('pyproject', join(root, 'pyproject.toml'));
    return {
      project,
      channel: 'pypi',
      ...manifest,
      name: pythonName(manifest.name),
    };
  }
  if (project === 'governance-dbt-package') {
    const manifest = yaml.parse(
      readFileSync(join(root, 'dbt_project.yml'), 'utf8'),
    );
    return {
      project,
      channel: 'github',
      name: manifest.name,
      version: String(manifest.version),
    };
  }
  throw new Error(`Review the distribution channel for ${project}`);
}

export function inspectArtifact(channel, path) {
  if (channel !== 'github') {
    const artifact = python(channel, path);
    if (channel === 'pypi') artifact.name = pythonName(artifact.name);
    return artifact;
  }
  // dbt currently distributes a Git subdirectory, not a registry archive.
  const hash = createHash('sha256');
  const visit = (directory, relative = '') => {
    for (const name of readdirSync(directory).sort()) {
      const file = join(directory, name),
        key = `${relative}${name}`;
      const stat = lstatSync(file);
      requireCondition(
        !stat.isSymbolicLink(),
        'dbt artifact symlinks require separate review',
      );
      if (stat.isDirectory()) visit(file, `${key}/`);
      else {
        requireCondition(stat.isFile(), 'Unsupported dbt artifact entry');
        hash.update(JSON.stringify([key, stat.size]));
        hash.update(readFileSync(file));
      }
    }
  };
  visit(path);
  const manifest = yaml.parse(
    readFileSync(join(path, 'dbt_project.yml'), 'utf8'),
  );
  return {
    name: manifest.name,
    version: String(manifest.version),
    sha256: hash.digest('hex'),
  };
}

/** #721 supplies authenticated Nx preparation data and compatibility evidence. */
export async function validateCandidate(context, candidate, dependencies) {
  const manifest = identity(context, candidate.project);
  const histories = await collectHistories([manifest], dependencies);
  const artifacts = candidate.artifacts.map((path) =>
    inspectArtifact(manifest.channel, resolve(context.root, path)),
  );
  if (manifest.channel === 'pypi') {
    requireCondition(
      candidate.artifacts.length === 2 &&
        candidate.artifacts.some((p) => p.endsWith('.whl')) &&
        candidate.artifacts.some((p) => p.endsWith('.tar.gz')),
      'Python publication requires one wheel and one sdist',
    );
  }
  return {
    ...validateVersion({
      ...candidate,
      manifest,
      artifacts,
      history: histories[candidate.project],
    }),
    artifacts,
    history: histories[candidate.project],
  };
}

/** Never call release/changelog/publish; dryRun alone still executes preVersionCommand. */
export async function previewVersions(context, projects, firstRelease = false) {
  requireCondition(
    projects.length > 0 && projects.every((p) => context.projects.includes(p)),
    'Select explicit release project names',
  );
  const histories = await collectHistories(
    projects.map((p) => identity(context, p)),
  );
  for (const p of projects) {
    const h = histories[p];
    const published = h.tags.length + h.releases.length + h.registry.length > 0;
    requireCondition(
      firstRelease ? !published : published,
      'Separate unreleased and released preview selections; first-release cannot reset history',
    );
  }
  const result = await nxPreview(projects, firstRelease);
  const expanded = Object.keys(result.projectsVersionData).filter(
    (p) => !histories[p],
  );
  Object.assign(
    histories,
    await collectHistories(expanded.map((p) => identity(context, p))),
  );
  for (const [p, data] of Object.entries(result.projectsVersionData)) {
    const h = histories[p];
    if (
      h.tags.length + h.releases.length + h.registry.length === 0 &&
      data.newVersion
    ) {
      requireCondition(
        data.newVersion === '0.0.1',
        `Expanded unreleased project ${p} must start at 0.0.1`,
      );
    }
  }
  return { projectsVersionData: result.projectsVersionData, histories };
}

// Offline calculation seam for installed-Nx regression tests; not a readiness gate.
export async function nxPreview(projects, firstRelease = false) {
  const { ReleaseClient } = await import('nx/release');
  const client = new ReleaseClient({ version: { preVersionCommand: '' } });
  const result = await client.releaseVersion({
    projects,
    dryRun: true,
    firstRelease,
    ...(firstRelease ? { specifier: '0.0.1' } : {}),
    gitCommit: false,
    gitTag: false,
    gitPush: false,
    stageChanges: false,
  });
  return result;
}
