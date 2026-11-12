import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import {
  REPOSITORY,
  OWNER,
  sha256,
  validateRecord,
  validateApproval,
  validateArtifactSource,
  verifyFiles,
  executeRecord,
} from './execution.mjs';
import {
  publishClosure,
  selectedProjects,
  readinessTargets,
} from './prepare.mjs';
import {
  publication,
  parseReleaseBody,
  releaseBody,
  inspectRequest,
  controllerDigest,
} from './controller.mjs';

const commit = 'a'.repeat(40),
  digest = 'b'.repeat(64);
const bytes = Buffer.from('reviewed archive');
const pkg = (project = 'sample') => ({
  project,
  name: `@anarchitects/${project}`,
  version: '0.0.2',
  tag: `${project}@0.0.2`,
  channel: 'npm',
  distTag: 'latest',
  nxVersion: { currentVersion: '0.0.1', newVersion: '0.0.2' },
  compatibility: { minimumBump: 'patch', evidence: 'reviewed public API' },
  files: [{ name: 'sample.tgz', size: bytes.length, sha256: sha256(bytes) }],
  dependencies: [],
  history: { tags: ['0.0.1'], releases: ['0.0.1'], registry: ['0.0.1'] },
});
const record = () => ({
  schema: 1,
  repository: REPOSITORY,
  owner: OWNER,
  baseline: commit,
  candidate: { commit, tree: commit },
  controller: { commit, digest },
  lockDigest: digest,
  preparation: { runId: 12, attempt: 1 },
  evidence: { ciRunId: 10, gates: ['main', 'package checks'] },
  packages: [pkg()],
});
const request = { action: 'release', digest, artifactId: 42 };
function service(overrides = {}) {
  const mutations = [],
    receipts = [],
    tags = new Map(),
    releases = new Map();
  const impl = {
    history: async () => {},
    main: async () => commit,
    tag: async (t) => tags.get(t),
    release: async (t) => releases.get(t),
    dependency: async () => {},
    publication: async (p) => ({ missing: p.files }),
    mutate: async (op) => {
      mutations.push(op.kind);
      if (op.kind === 'tag') tags.set(op.package.tag, { commit });
      if (op.kind === 'release')
        releases.set(op.package.tag, {
          recordDigest: digest,
          artifactId: 42,
          draft: false,
        });
      return { id: mutations.length };
    },
    verify: async () => {},
    receipt: async (r) => receipts.push(structuredClone(r)),
    ...overrides,
  };
  return { impl, mutations, receipts, tags, releases };
}
test('record, artifact and owner bindings reject forged or stale handoffs', () => {
  const r = record();
  validateRecord(r);
  for (const change of [
    (r) => (r.repository = 'other/repo'),
    (r) => (r.owner.id = 9),
    (r) => (r.candidate.commit = 'main'),
    (r) => (r.packages[0].tag = 'other@0.0.2'),
    (r) => (r.packages[0].files[0].name = '../evil.tgz'),
    (r) => r.packages.push(r.packages[0]),
    (r) => (r.preparation.attempt = 2),
  ]) {
    const bad = structuredClone(r);
    change(bad);
    assert.throws(() => validateRecord(bad));
  }
  const run = {
    id: 21,
    repository: { full_name: REPOSITORY },
    head_branch: 'main',
    head_sha: commit,
    event: 'workflow_dispatch',
    run_attempt: 1,
  };
  const reviews = [
    {
      state: 'approved',
      user: OWNER,
      environments: [{ name: 'community-release' }],
    },
  ];
  assert.equal(
    validateApproval(run, reviews, 'community-release', commit).runId,
    21,
  );
  for (const bad of [
    [],
    [{ ...reviews[0], state: 'rejected' }],
    [{ ...reviews[0], user: { ...OWNER, id: 1 } }],
  ])
    assert.throws(() =>
      validateApproval(run, bad, 'community-release', commit),
    );
  assert.throws(() =>
    validateApproval(
      { ...run, run_attempt: 2 },
      reviews,
      'community-release',
      commit,
    ),
  );
  assert.throws(() =>
    validateApproval(
      { ...run, head_branch: 'tag' },
      reviews,
      'community-release',
      commit,
    ),
  );
  const preparation = {
    ...run,
    id: 12,
    path: '.github/workflows/release-prepare.yml',
    conclusion: 'success',
  };
  const artifact = {
    name: 'community-release-record',
    expired: false,
    workflow_run: { id: 12, head_sha: commit },
  };
  validateArtifactSource(artifact, preparation, r);
  assert.throws(() =>
    validateArtifactSource({ ...artifact, expired: true }, preparation, r),
  );
  assert.throws(() =>
    validateArtifactSource(
      artifact,
      { ...preparation, event: 'pull_request' },
      r,
    ),
  );
});
test('reviewed bytes cannot be replaced after artifact retention', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-bytes-'));
  try {
    mkdirSync(join(dir, 'sample'));
    writeFileSync(join(dir, 'sample/sample.tgz'), bytes);
    verifyFiles(record(), dir);
    writeFileSync(join(dir, 'sample/sample.tgz'), 'replacement');
    assert.throws(() => verifyFiles(record(), dir), /Artifact changed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('all preflights complete before any public mutation', async () => {
  const r = record();
  r.packages.push(pkg('second'));
  for (const failure of [
    {
      history: async (p) => {
        if (p.project === 'second') throw Error('registry offline');
      },
    },
    { main: async () => 'c'.repeat(40) },
    { tag: async () => ({ commit: 'd'.repeat(40) }) },
    { release: async () => ({ recordDigest: 'e'.repeat(64), artifactId: 42 }) },
  ]) {
    const s = service(failure);
    await assert.rejects(executeRecord(r, request, s.impl));
    assert.deepEqual(s.mutations, []);
  }
});
test('partial tag/release interruption resumes only absent approved mutations', async () => {
  const s = service();
  let fail = true;
  const original = s.impl.mutate;
  s.impl.mutate = async (op) => {
    if (op.kind === 'release' && fail) {
      fail = false;
      throw Error('interrupted');
    }
    return original(op);
  };
  await assert.rejects(executeRecord(record(), request, s.impl), /interrupted/);
  assert.deepEqual(s.mutations, ['tag']);
  assert.equal(s.receipts.at(-1).complete, false);
  await executeRecord(record(), request, s.impl);
  assert.deepEqual(s.mutations, ['tag', 'release']);
  assert.equal(s.receipts.at(-1).complete, true);
  await executeRecord(record(), request, s.impl);
  assert.deepEqual(s.mutations, ['tag', 'release']);
});
test('publish enforces tag, dependency availability, exact-byte reconciliation and explicit channel intent', async () => {
  const r = record();
  r.packages[0].dependencies = [pkg('dependency')];
  const req = { ...request, action: 'publish', tag: 'sample@0.0.2' };
  const s = service({
    tag: async () => ({ commit }),
    dependency: async () => {
      throw Error('dependency absent');
    },
  });
  await assert.rejects(executeRecord(r, req, s.impl), /dependency absent/);
  assert.deepEqual(s.mutations, []);
  s.impl.dependency = async () => {};
  s.impl.publication = async () => ({ missing: [], distTag: '0.0.1' });
  await assert.rejects(executeRecord(r, req, s.impl), /channel differs/);
  assert.deepEqual(s.mutations, []);
  await executeRecord(r, { ...req, action: 'channel' }, s.impl);
  assert.deepEqual(s.mutations, ['channel']);
  const missing = service({ tag: async () => ({ commit }) });
  await executeRecord(r, req, missing.impl);
  assert.deepEqual(missing.mutations, ['publish']);
  await assert.rejects(
    executeRecord(r, { ...req, tag: 'unapproved@0.0.2' }, missing.impl),
    /outside approved/,
  );
});
test('registry reconciliation verifies bytes and resumes a partial wheel/sdist upload', async () => {
  const old = globalThis.fetch;
  const p = pkg();
  try {
    let payload = bytes;
    globalThis.fetch = async (url) =>
      String(url).endsWith('.tgz')
        ? new Response(payload)
        : Response.json({
            name: p.name,
            versions: {
              [p.version]: {
                name: p.name,
                version: p.version,
                dist: { tarball: 'https://registry.npmjs.org/sample.tgz' },
              },
            },
            'dist-tags': { latest: p.version },
          });
    assert.equal((await publication(p)).missing.length, 0);
    payload = Buffer.from('different');
    await assert.rejects(publication(p), /bytes differ/);
    const python = {
      ...p,
      name: 'example',
      channel: 'pypi',
      files: [
        { name: 'example.whl', sha256: sha256(bytes), size: bytes.length },
        { name: 'example.tar.gz', sha256: digest, size: 5 },
      ],
    };
    globalThis.fetch = async (url) =>
      String(url).endsWith('.whl')
        ? new Response(bytes)
        : Response.json({
            info: { name: 'example' },
            releases: {
              [p.version]: [
                {
                  filename: 'example.whl',
                  digests: { sha256: sha256(bytes) },
                  url: 'https://files.pythonhosted.org/example.whl',
                },
              ],
            },
          });
    assert.deepEqual((await publication(python)).missing, [python.files[1]]);
    globalThis.fetch = async () =>
      Response.json({ error: 'unavailable' }, { status: 503 });
    await assert.rejects(publication(p), /unavailable/);
    globalThis.fetch = async () =>
      Response.json({ error: 'Not found' }, { status: 404 });
    assert.deepEqual((await publication(p)).missing, p.files);
  } finally {
    globalThis.fetch = old;
  }
});
test('release body binds event forwarding to immutable artifact and candidate', () => {
  const r = record();
  r.packages[0].notes = 'Nx release notes';
  assert.deepEqual(parseReleaseBody(releaseBody(r, request, r.packages[0])), {
    artifactId: 42,
    recordDigest: digest,
    preparation: 12,
    candidate: commit,
  });
  assert.throws(() => parseReleaseBody('random tag'));
});
test('publication closure includes implicit Nx publish dependencies and the Python runtime hook', () => {
  const graph = {
    nodes: {},
    dependencies: {
      host: [{ target: 'core' }],
      core: [],
      'governance-host-dbt': [],
      'governance-runtime-dbt': [],
    },
  };
  for (const name of [
    'host',
    'core',
    'governance-host-dbt',
    'governance-runtime-dbt',
  ])
    graph.nodes[name] = {
      data: {
        targets: {
          'nx-release-publish': { dependsOn: ['^nx-release-publish'] },
        },
      },
    };
  const context = { graph, projects: Object.keys(graph.nodes) };
  assert.deepEqual(publishClosure(context, 'host'), ['core']);
  assert.deepEqual(publishClosure(context, 'governance-host-dbt'), [
    'governance-runtime-dbt',
  ]);
  assert.throws(() => selectedProjects(context, 'host;echo bad'));
  assert.throws(() => selectedProjects(context, 'host,host'));
  assert.ok(
    readinessTargets(['nest-angular-ssr']).includes(
      '@anarchitecture-community/source:validate-nest-angular-ssr-release-gate',
    ),
  );
});
test('workflow privilege boundaries and staged activation are explicit', () => {
  const yaml = createRequire(import.meta.resolve('nx/package.json'))('yaml');
  const workflow = (name) =>
    yaml.parse(
      readFileSync(
        new URL(`../../.github/workflows/${name}.yml`, import.meta.url),
        'utf8',
      ),
    );
  const release = workflow('release'),
    publish = workflow('publish'),
    controller = workflow('publish-controller'),
    prepare = workflow('release-prepare');
  assert.equal(prepare.permissions['id-token'], undefined);
  assert.equal(prepare.permissions.contents, 'read');
  assert.equal(publish.jobs.forward.permissions['id-token'], undefined);
  assert.equal(
    publish.jobs.forward.steps.some((s) =>
      s.uses?.startsWith('actions/checkout'),
    ),
    false,
  );
  assert.match(publish.jobs.forward.steps[0].with.script, /ref: 'main'/);
  assert.equal(release.concurrency.group, controller.concurrency.group);
  assert.equal(release.concurrency.queue, 'max');
  assert.equal(controller.concurrency.queue, 'max');
  for (const [job, environment] of [
    [release.jobs.approved, 'community-release'],
    [controller.jobs.publish, 'community-publish'],
  ]) {
    assert.equal(job.environment, environment);
    assert.equal(job.needs, 'review');
    assert.equal(
      job.steps.some((s) =>
        /yarn|npm install|nx release|uv build/.test(s.run ?? ''),
      ),
      false,
    );
    const checkout = job.steps.find((s) =>
      s.uses?.startsWith('actions/checkout'),
    );
    assert.equal(checkout.with.ref, '${{ github.sha }}');
    assert.equal(checkout.with['persist-credentials'], false);
    const download = job.steps.find((s) =>
      s.uses?.startsWith('actions/download-artifact'),
    );
    assert.equal(download.with['run-id'], '${{ steps.source.outputs.run_id }}');
  }
  assert.match(release.jobs.release.if, /== ''/);
  assert.match(publish.jobs.publish.if, /== ''/);
  assert.match(release.jobs.review.if, /== 'active'/);
  assert.match(controller.jobs.review.if, /run_attempt == 1/);
});

test('controller rejects changed code, failed exact CI, foreign preparation and wrong event before mutation', async () => {
  const oldFetch = globalThis.fetch;
  const directory = mkdtempSync(join(tmpdir(), 'release-controller-'));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const r = record();
  r.candidate.commit = head;
  r.controller = { commit: head, digest: controllerDigest() };
  const env = {
    COMMUNITY_RELEASE_CONTROLS: 'active',
    GITHUB_REPOSITORY: REPOSITORY,
    GITHUB_REF: 'refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_RUN_ID: '21',
    GITHUB_SHA: head,
  };
  const base = {
    repository: { full_name: REPOSITORY },
    head_branch: 'main',
    head_sha: head,
    run_attempt: 1,
    conclusion: 'success',
  };
  let override = {};
  globalThis.fetch = async (url, options) => {
    assert.equal(options.method, 'GET', 'pre-review must never mutate');
    const path = new URL(url).pathname.replace(`/repos/${REPOSITORY}`, '');
    const values = {
      '/actions/artifacts/42': {
        name: 'community-release-record',
        expired: false,
        workflow_run: { id: 12, head_sha: head },
      },
      '/actions/runs/12': {
        ...base,
        id: 12,
        event: 'workflow_dispatch',
        path: '.github/workflows/release-prepare.yml',
      },
      [`/git/commits/${head}`]: { tree: { sha: r.candidate.tree } },
      [`/compare/${head}...main`]: { status: 'identical' },
      '/actions/runs/10': {
        ...base,
        id: 10,
        event: 'push',
        path: '.github/workflows/ci.yml',
      },
      '/actions/runs/10/attempts/1/jobs': {
        jobs: [{ name: 'main', conclusion: 'success' }],
      },
      '/actions/runs/21': {
        ...base,
        id: 21,
        event: 'workflow_dispatch',
        path: '.github/workflows/release.yml',
      },
    };
    assert.ok(Object.hasOwn(values, path), `Unexpected API request: ${path}`);
    return Response.json(override[path] ?? values[path]);
  };
  try {
    mkdirSync(join(directory, 'sample'));
    writeFileSync(join(directory, 'sample/sample.tgz'), bytes);
    const inspect = async () => {
      const encoded = JSON.stringify(r);
      writeFileSync(join(directory, 'release-record.json'), encoded);
      return inspectRequest({
        directory,
        artifactId: 42,
        digest: sha256(encoded),
        action: 'release',
        env,
      });
    };
    assert.equal((await inspect()).record.candidate.commit, head);
    override = {
      [`/compare/${head}...main`]: {
        status: 'ahead',
        files: [{ filename: 'OWNERSHIP.md' }],
      },
    };
    await assert.rejects(inspect(), /ownership changed/);
    override = {
      [`/compare/${head}...main`]: {
        status: 'ahead',
        files: [{ filename: 'docs/unrelated.md' }],
      },
    };
    await inspect();
    override = {};
    const actual = r.controller.digest;
    r.controller.digest = digest;
    await assert.rejects(inspect(), /Controller changed/);
    r.controller.digest = actual;
    override = {
      '/actions/runs/10': {
        ...base,
        event: 'push',
        path: '.github/workflows/ci.yml',
        conclusion: 'failure',
      },
    };
    await assert.rejects(inspect(), /CI is not successful/);
    override = {
      '/actions/runs/12': {
        ...base,
        id: 12,
        event: 'pull_request',
        path: '.github/workflows/release-prepare.yml',
      },
    };
    await assert.rejects(inspect(), /Untrusted preparation/);
    override = {};
    env.GITHUB_EVENT_NAME = 'release';
    await assert.rejects(inspect(), /fresh dispatch/);
  } finally {
    globalThis.fetch = oldFetch;
    rmSync(directory, { recursive: true, force: true });
  }
});
