import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  bumpTypes,
  parseCommit,
  validateCommit,
  validateConfiguration,
  validateVersion,
} from './policy.mjs';
import { collectHistories, registryVersions } from './history.mjs';
import { commitRequest } from './check.mjs';

const graph = {
  nodes: {
    old: { data: { root: 'packages/old' } },
    fresh: { data: { root: 'packages/fresh' } },
    fixture: { data: { root: 'apps/fixture' } },
  },
};
const history = (project, versions = []) => ({
  project,
  channel: 'npm',
  tags: versions,
  releases: [],
  registry: versions,
});
const base = {
  graph,
  releaseProjects: ['old', 'fresh'],
  histories: { old: history('old', ['0.0.1']), fresh: history('fresh') },
};
const commit = (message, files = []) =>
  validateCommit({ ...base, message, files });

test('every allowed type has an explicit mapping; drift and version plans fail', () => {
  const config = JSON.parse(
    readFileSync(new URL('../../nx.json', import.meta.url)),
  );
  const g = {
    nodes: Object.fromEntries(config.release.projects.map((p) => [p, {}])),
  };
  assert.equal(validateConfiguration(config, g).length, 21);
  config.release.version.adjustSemverBumpsForZeroMajorVersion = false;
  assert.throws(() => validateConfiguration(config, g), /zero-major/);
  config.release.version.adjustSemverBumpsForZeroMajorVersion = true;
  for (const type of Object.keys(bumpTypes))
    assert.equal(
      parseCommit(`${type === 'init' ? 'init(fresh)' : type}: subject`, graph)
        .type,
      type,
    );
  config.release.conventionalCommits.types.perf.semverBump = 'none';
  assert.throws(() => validateConfiguration(config, g), /mapping/);
  config.release.conventionalCommits.types.perf.semverBump = 'patch';
  config.release.versionPlans = true;
  assert.throws(() => validateConfiguration(config, g), /authority/);
});

test('exact graph scopes, prospective messages and mixed lifecycles', () => {
  commit('docs: repository documentation', ['docs/sdlc.md']);
  commit('fix(old): repair API', ['packages/old/src/index.ts']);
  commit('init(fresh,fixture): initial support', [
    'packages/fresh/index.ts',
    'apps/fixture/index.ts',
  ]);
  for (const message of [
    'fix(ci): bad scope',
    'release: publish',
    'fix(old, old): whitespace',
    'fix(old,old): duplicate',
    'Fix(old): case',
    'fix(old): ',
    'init: missing scope',
    'init(fresh)!: breaking',
    'init(fresh): first\n\nBREAKING CHANGE: invalid',
  ]) {
    assert.throws(() => commit(message), undefined, message);
  }
  assert.throws(() => commit('init(old): already shipped'), /already released/);
  assert.throws(() => commit('feat(fresh): premature bump'), /unreleased/);
  assert.throws(() => commit('init(fresh,old): mixed'), /already released/);
  assert.throws(() => commit('fix(old,fresh): mixed'), /unreleased/);
  assert.throws(
    () => commit('chore: package update', ['packages/old/package.json']),
    /scope old/,
  );
  assert.throws(
    () => commit('fix(fixture): hidden change', ['packages/old/index.ts']),
    /scope old/,
  );
  assert.equal(
    commit('fix(old): change\n\nBREAKING CHANGE: removes method').breaking,
    true,
  );
  assert.throws(
    () => commit('fix(old): change\n\nBREAKING-CHANGE: removes method'),
    /hyphenated/,
  );
});

const candidate = () => ({
  project: 'old',
  version: '0.0.2',
  tag: 'old@0.0.2',
  manifest: { name: '@example/old', version: '0.0.2' },
  artifacts: [
    { name: '@example/old', version: '0.0.2', sha256: 'a'.repeat(64) },
  ],
  history: history('old', ['0.0.1']),
  nxVersion: { currentVersion: '0.0.1', newVersion: '0.0.2' },
  compatibility: { minimumBump: 'patch', evidence: 'reviewed API comparison' },
});

test('release identity, Nx result and compatibility must agree', () => {
  assert.equal(validateVersion(candidate()).existingVersion, false);
  for (const edit of [
    (c) => (c.tag = 'other@0.0.2'),
    (c) => (c.manifest.version = '0.0.1'),
    (c) => (c.artifacts[0].name = '@example/other'),
    (c) => (c.artifacts[0].version = '0.0.1'),
    (c) => (c.artifacts = []),
    (c) => (c.nxVersion.newVersion = null),
    (c) => (c.nxVersion.currentVersion = '0.0.0'),
    (c) => (c.compatibility.minimumBump = 'major'),
    (c) => (c.compatibility.evidence = ''),
    (c) => (c.history.registry = null),
    (c) => (c.history.registry = ['0.0.3']),
  ]) {
    const c = candidate();
    edit(c);
    assert.throws(() => validateVersion(c));
  }
  const c = candidate();
  c.version =
    c.manifest.version =
    c.artifacts[0].version =
    c.nxVersion.newVersion =
      '1.0.0';
  c.tag = 'old@1.0.0';
  c.compatibility.minimumBump = 'major';
  assert.throws(() => validateVersion(c), /explicit stable-release/);
  c.stableTransition = {
    version: '1.0.0',
    evidence: 'Owner selected this reviewed stabilization candidate',
  };
  assert.equal(validateVersion(c).version, '1.0.0');
});

test('compatibility floors preserve zero-major adjustment and full stable SemVer', () => {
  for (const [baseline, version, impact, valid] of [
    ['0.0.1', '0.0.2', 'minor', true],
    ['0.3.2', '0.3.3', 'major', false],
    ['0.3.2', '0.4.0', 'major', true],
    ['1.2.3', '1.2.4', 'minor', false],
    ['1.2.3', '1.3.0', 'minor', true],
    ['1.2.3', '1.3.0', 'major', false],
    ['1.2.3', '2.0.0', 'major', true],
  ]) {
    const c = candidate();
    c.nxVersion.currentVersion = baseline;
    c.history = history('old', [baseline]);
    c.version =
      c.manifest.version =
      c.artifacts[0].version =
      c.nxVersion.newVersion =
        version;
    c.tag = `old@${version}`;
    c.compatibility.minimumBump = impact;
    if (valid) assert.equal(validateVersion(c).version, version);
    else assert.throws(() => validateVersion(c), /insufficient/);
  }
});

test('first distribution, extra channels and grandfathered history are distinct', () => {
  for (const version of ['0.0.1', '0.1.0', '1.0.0', '0.0.1-beta.0']) {
    const c = candidate();
    c.history = history('old');
    c.version =
      c.manifest.version =
      c.artifacts[0].version =
      c.nxVersion.newVersion =
        version;
    c.tag = `old@${version}`;
    if (version === '0.0.1') assert.equal(validateVersion(c).version, version);
    else assert.throws(() => validateVersion(c), /First official/);
  }
  const c = candidate();
  c.history = {
    project: 'old',
    channel: 'npm',
    tags: ['0.1.0'],
    releases: ['0.1.0'],
    registry: [],
  };
  c.version =
    c.manifest.version =
    c.artifacts[0].version =
    c.nxVersion.newVersion =
    c.nxVersion.currentVersion =
      '0.1.0';
  c.tag = 'old@0.1.0';
  c.compatibility.minimumBump = 'none';
  assert.equal(validateVersion(c).existingVersion, true);
});

test('initial tag handoff and prerelease compatibility do not reset existing history', () => {
  const c = candidate();
  c.version =
    c.manifest.version =
    c.artifacts[0].version =
    c.nxVersion.newVersion =
      '0.0.1';
  c.nxVersion.currentVersion = '0.0.0';
  c.tag = 'old@0.0.1';
  c.history.registry = [];
  assert.equal(validateVersion(c).version, '0.0.1');
  c.history.registry = ['0.1.0'];
  assert.throws(() => validateVersion(c), /baseline/);
  const pre = candidate();
  pre.version =
    pre.manifest.version =
    pre.artifacts[0].version =
    pre.nxVersion.newVersion =
      '0.1.0-beta.0';
  pre.tag = 'old@0.1.0-beta.0';
  pre.compatibility.minimumBump = 'minor';
  assert.equal(validateVersion(pre).version, '0.1.0-beta.0');
  const missing = candidate();
  missing.history.registry = [];
  assert.throws(() => validateVersion(missing), /distribution channel/);
});

test('registry absence is explicit; transport/auth/server/malformed failures never mean unreleased', async () => {
  const npm = { channel: 'npm', name: '@example/lib' },
    pypi = { channel: 'pypi', name: 'example' };
  const response = (status, data) => async () => ({
    status,
    ok: status === 200,
    json: async () => data,
  });
  assert.deepEqual(
    await registryVersions(npm, response(404, { error: 'Not found' })),
    [],
  );
  assert.deepEqual(
    await registryVersions(pypi, response(404, { message: 'Not Found' })),
    [],
  );
  assert.deepEqual(
    await registryVersions(
      npm,
      response(200, { name: npm.name, versions: { '0.0.1': {} } }),
    ),
    ['0.0.1'],
  );
  assert.deepEqual(
    await registryVersions(
      pypi,
      response(200, { info: { name: pypi.name }, releases: { '0.0.1': [] } }),
    ),
    ['0.0.1'],
  );
  await assert.rejects(
    registryVersions(npm, response(200, { name: 'wrong', versions: {} })),
    /identity/,
  );
  for (const status of [401, 403, 429, 500])
    await assert.rejects(
      registryVersions(npm, response(status, {})),
      /unavailable/,
    );
  await assert.rejects(
    registryVersions(npm, response(404, {})),
    /Unrecognized/,
  );
  await assert.rejects(registryVersions(npm, response(200, {})), /Malformed/);
  await assert.rejects(
    registryVersions(npm, async () => {
      throw new Error('offline');
    }),
    /offline/,
  );
});

test('history includes peeled tags and published releases; draft and unrelated versions are excluded', async () => {
  const dependencies = {
    execute: (cmd, args) => {
      assert.ok(
        !args.some((arg) => ['POST', 'PATCH', 'DELETE', 'push'].includes(arg)),
      );
      return cmd === 'git'
        ? `${'a'.repeat(40)}\trefs/tags/old@0.0.1\n${'b'.repeat(40)}\trefs/tags/old@0.0.1^{}\n`
        : JSON.stringify([
            [
              { tag_name: 'old@0.0.2', draft: false },
              { tag_name: 'old@0.0.3', draft: true },
            ],
          ]);
    },
    fetcher: async () => ({
      status: 200,
      ok: true,
      json: async () => ({ name: '@example/old', versions: { '0.0.1': {} } }),
    }),
  };
  const result = await collectHistories(
    [{ project: 'old', channel: 'npm', name: '@example/old' }],
    dependencies,
  );
  assert.deepEqual(result.old.tags, ['0.0.1']);
  assert.deepEqual(result.old.releases, ['0.0.2']);
  await assert.rejects(
    collectHistories([{ project: 'old', channel: 'npm', name: 'old' }], {
      ...dependencies,
      execute: () => {
        throw new Error('GitHub inaccessible');
      },
    }),
    /inaccessible/,
  );
});

test('CI checks the prospective squash message, using merge-base and complete history', () => {
  const event = {
    pull_request: {
      title: 'fix(old): change',
      body: 'BREAKING CHANGE: remove API',
      base: { sha: 'a'.repeat(40) },
      head: { sha: 'b'.repeat(40) },
    },
  };
  const git = (args) =>
    args[0] === 'rev-parse'
      ? 'false'
      : args[0] === 'merge-base'
        ? 'c'.repeat(40)
        : 'packages/old/index.ts\0';
  const request = commitRequest('pull_request', event, git);
  assert.equal(parseCommit(request.message, graph).breaking, true);
  assert.deepEqual(request.files, ['packages/old/index.ts']);
  assert.throws(
    () => commitRequest('pull_request', event, () => 'true'),
    /full Git history/,
  );
  assert.throws(
    () =>
      commitRequest(
        'pull_request',
        { pull_request: { ...event.pull_request, head: {} } },
        git,
      ),
    /revisions/,
  );
});
