import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateVersion } from './policy.mjs';
import {
  validateRecord,
  validateArtifactSource,
  planRecord,
  verifyFiles,
  sha256,
  OWNER,
  REPOSITORY,
} from './execution.mjs';
import {
  MAINTENANCE_BRANCH,
  MAINTENANCE_ANCHOR,
  validateSsrManifest,
} from './lines.mjs';
import { validateProtection, protectionRevision, exactCI } from './github.mjs';
import { inspectRequest, controllerDigest } from './controller.mjs';

const candidate = 'a'.repeat(40),
  controller = 'c'.repeat(40),
  hash = 'b'.repeat(64);
const pkg = () => ({
  project: 'nest-angular-ssr',
  name: '@anarchitects/nest-angular-ssr',
  channel: 'npm',
  version: '0.3.3',
  tag: 'nest-angular-ssr@0.3.3',
  distTag: 'nest11',
  channelTargets: ['nest11'],
  dependencies: [],
  nxVersion: { currentVersion: '0.3.2', newVersion: '0.3.3' },
  nxBaseline: { tag: 'nest-angular-ssr@0.3.2', commit: 'd'.repeat(40) },
  compatibility: {
    minimumBump: 'patch',
    evidence: 'compatible fixture only; not the breaking floor migration',
  },
  files: [{ name: 'ssr.tgz', size: 1, sha256: hash }],
});
function record() {
  return {
    schema: 2,
    repository: REPOSITORY,
    owner: OWNER,
    line: 'nest11',
    baseline: candidate,
    requestDigest: hash,
    lockDigest: hash,
    candidate: {
      commit: candidate,
      tree: candidate,
      branch: MAINTENANCE_BRANCH,
      anchor: MAINTENANCE_ANCHOR,
    },
    controller: { commit: controller, digest: hash },
    preparation: { runId: 12, attempt: 1 },
    evidence: {
      ciRunId: 10,
      ci: { id: 10, head: candidate, branch: MAINTENANCE_BRANCH },
      gates: ['package checks'],
      sourceProtection: { branch: MAINTENANCE_BRANCH },
    },
    packages: [pkg()],
  };
}
function versionInput() {
  const p = pkg();
  return {
    ...p,
    manifest: { name: p.name, version: p.version },
    artifacts: [{ name: p.name, version: p.version, sha256: hash }],
    history: {
      project: p.project,
      channel: 'npm',
      tags: ['0.3.2', '0.4.0'],
      releases: ['0.3.2', '0.4.0'],
      registry: ['0.3.2', '0.4.0'],
    },
    sourceLine: {
      name: 'nest11',
      branch: MAINTENANCE_BRANCH,
      distTag: 'nest11',
      reachableVersions: ['0.3.2'],
    },
  };
}

test('a lower maintenance patch advances reachable history without discarding global history', () => {
  assert.equal(validateVersion(versionInput()).existingVersion, false);
  const ordinary = versionInput();
  delete ordinary.sourceLine;
  assert.throws(() => validateVersion(ordinary), /advance existing history/);
  for (const mutate of [
    (r) => {
      r.sourceLine.branch = 'unprotected';
    },
    (r) => {
      r.sourceLine.distTag = 'latest';
    },
    (r) => {
      r.sourceLine.reachableVersions.push('0.4.0');
    },
    (r) => {
      r.nxVersion.currentVersion = '0.2.0';
    },
    (r) => {
      r.history.registry = ['0.4.0'];
    },
    (r) => {
      r.compatibility.minimumBump = 'major';
    },
    (r) => {
      r.history.registry.push('0.3.3');
    },
    (r) => {
      r.project = 'other';
      r.history.project = 'other';
    },
  ]) {
    const r = versionInput();
    mutate(r);
    assert.throws(() => validateVersion(r));
  }
});

test('maintenance provenance binds main controller separately from candidate, line, CI and channels', () => {
  const r = record();
  validateRecord(r);
  const run = {
    id: 12,
    repository: { full_name: REPOSITORY },
    run_attempt: 1,
    conclusion: 'success',
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: controller,
    path: '.github/workflows/release-prepare.yml',
  };
  const artifact = {
    name: 'community-release-record',
    workflow_run: { id: 12, head_sha: controller },
    expired: false,
  };
  validateArtifactSource(artifact, run, r);
  assert.throws(() =>
    validateArtifactSource(artifact, { ...run, head_sha: candidate }, r),
  );
  assert.throws(() =>
    validateArtifactSource(
      artifact,
      { ...run, head_branch: MAINTENANCE_BRANCH },
      r,
    ),
  );
  for (const mutate of [
    (r) => {
      r.schema = 1;
    },
    (r) => {
      r.line = 'custom';
    },
    (r) => {
      r.candidate.branch = 'main';
    },
    (r) => {
      r.candidate.anchor = candidate;
    },
    (r) => {
      r.evidence.ci.head = controller;
    },
    (r) => {
      r.evidence.ci.branch = 'main';
    },
    (r) => {
      r.packages[0].distTag = 'latest';
    },
    (r) => {
      r.packages[0].channelTargets.push('next');
    },
    (r) => {
      r.packages.push({ ...pkg(), project: 'other' });
    },
    (r) => {
      r.packages[0].dependencies.push({ project: 'other' });
    },
    (r) => {
      delete r.requestDigest;
    },
    (r) => {
      delete r.packages[0].nxBaseline;
    },
  ]) {
    const bad = record();
    mutate(bad);
    assert.throws(() => validateRecord(bad));
  }
});

test('tagging checks maintenance head and existing-tag recovery preserves its identity', async () => {
  const r = record();
  let head = candidate,
    tag;
  const service = {
    history: async () => {},
    branch: async (branch) => {
      assert.equal(branch, MAINTENANCE_BRANCH);
      return head;
    },
    main: async () => {
      throw Error('maintenance must not use main as source');
    },
    publication: async (p) => ({ missing: p.files }),
    tag: async () => tag,
    release: async () => null,
  };
  assert.deepEqual(
    (await planRecord(r, { action: 'release' }, service)).plan.map(
      (p) => p.kind,
    ),
    ['tag', 'release'],
  );
  head = controller;
  await assert.rejects(
    planRecord(r, { action: 'release' }, service),
    /Source branch advanced/,
  );
  tag = { commit: candidate };
  assert.deepEqual(
    (await planRecord(r, { action: 'release' }, service)).plan.map(
      (p) => p.kind,
    ),
    ['release'],
  );
  tag = { commit: controller };
  await assert.rejects(
    planRecord(r, { action: 'release' }, service),
    /Conflicting tag/,
  );
});

test('channel promotion is separate intent; maintenance cannot select latest or next', async () => {
  const r = record();
  const service = {
    history: async () => {},
    tag: async () => ({ commit: candidate }),
    dependency: async () => {},
    publication: async () => ({ missing: [], distTag: '0.3.2' }),
  };
  for (const channel of ['latest', 'next', undefined])
    await assert.rejects(
      planRecord(r, { action: 'channel', tag: pkg().tag, channel }, service),
      /explicitly recorded target/,
    );
  const maintenance = await planRecord(
    r,
    { action: 'channel', tag: pkg().tag, channel: 'nest11' },
    service,
  );
  assert.equal(maintenance.plan[0].package.distTag, 'nest11');
  r.line = 'nest12';
  r.candidate.branch = 'main';
  r.evidence.ci.branch = 'main';
  r.evidence.sourceProtection.branch = 'main';
  r.packages[0].distTag = 'next';
  r.packages[0].channelTargets = ['next', 'latest'];
  const promotion = await planRecord(
    r,
    { action: 'channel', tag: pkg().tag, channel: 'latest' },
    service,
  );
  assert.equal(promotion.plan[0].kind, 'channel');
  assert.equal(promotion.plan[0].package.distTag, 'latest');
  assert.equal(r.packages[0].distTag, 'next', 'record remains immutable');
  await assert.rejects(
    planRecord(
      r,
      { action: 'publish', tag: pkg().tag, channel: 'latest' },
      service,
    ),
  );
});

test('source rules require exact strict check, signatures, PRs and no bypass', () => {
  const rules = [
    'deletion',
    'non_fast_forward',
    'required_signatures',
    'pull_request',
  ].map((type) => ({ type, ruleset_id: 1 }));
  rules.push({
    type: 'required_status_checks',
    ruleset_id: 1,
    parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: [{ context: 'main', integration_id: 15368 }],
    },
  });
  const sets = [
    { id: 1, target: 'branch', enforcement: 'active', bypass_actors: [] },
  ];
  validateProtection(MAINTENANCE_BRANCH, rules, sets);
  for (let i = 0; i < rules.length; i++)
    assert.throws(() =>
      validateProtection(
        MAINTENANCE_BRANCH,
        rules.filter((_, n) => n !== i),
        sets,
      ),
    );
  for (const bad of [
    { ...sets[0], bypass_actors: [{}] },
    { ...sets[0], bypass_actors: undefined },
    { ...sets[0], enforcement: 'evaluate' },
  ])
    assert.throws(() => validateProtection(MAINTENANCE_BRANCH, rules, [bad]));
});

test('hidden bypass lists require an owner snapshot of the same public ruleset revision', () => {
  const rules = [
    'deletion',
    'non_fast_forward',
    'required_signatures',
    'pull_request',
  ].map((type) => ({ type, ruleset_id: 1 }));
  rules.push({
    type: 'required_status_checks',
    ruleset_id: 1,
    parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: [{ context: 'main', integration_id: 15368 }],
    },
  });
  const set = {
    id: 1,
    target: 'branch',
    source: REPOSITORY,
    source_type: 'Repository',
    enforcement: 'active',
    updated_at: '2026-11-15T15:00:00Z',
    rules,
  };
  const snapshot = {
    id: 1,
    ownerId: OWNER.id,
    bypassActors: [],
    updatedAt: set.updated_at,
    publicDigest: protectionRevision(set),
  };
  validateProtection(MAINTENANCE_BRANCH, rules, [set], [snapshot]);
  assert.throws(() => validateProtection(MAINTENANCE_BRANCH, rules, [set]));
  assert.throws(() =>
    validateProtection(
      MAINTENANCE_BRANCH,
      rules,
      [{ ...set, updated_at: '2026-11-15T15:00:01Z' }],
      [snapshot],
    ),
  );
  assert.throws(() =>
    validateProtection(
      MAINTENANCE_BRANCH,
      rules,
      [{ ...set, rules: [] }],
      [snapshot],
    ),
  );
  for (const bad of [
    { ...snapshot, ownerId: 1 },
    { ...snapshot, bypassActors: [{}] },
    { ...snapshot, publicDigest: hash },
  ])
    assert.throws(() =>
      validateProtection(MAINTENANCE_BRANCH, rules, [set], [bad]),
    );
  assert.throws(() =>
    validateProtection(
      MAINTENANCE_BRANCH,
      rules,
      [{ ...set, bypass_actors: [{}] }],
      [snapshot],
    ),
  );
});

test('exact CI accepts only the approved source push, never a main run for maintenance', async () => {
  const previous = globalThis.fetch;
  let branch = MAINTENANCE_BRANCH;
  globalThis.fetch = async (url) =>
    Response.json(
      String(url).includes('/jobs')
        ? { jobs: [{ name: 'main', conclusion: 'success' }] }
        : {
            repository: { full_name: REPOSITORY },
            head_sha: candidate,
            head_branch: branch,
            event: 'push',
            path: '.github/workflows/ci.yml',
            conclusion: 'success',
            run_attempt: 1,
          },
    );
  try {
    assert.equal(
      (await exactCI(candidate, 10, MAINTENANCE_BRANCH)).branch,
      MAINTENANCE_BRANCH,
    );
    branch = 'main';
    await assert.rejects(exactCI(candidate, 10, MAINTENANCE_BRANCH));
  } finally {
    globalThis.fetch = previous;
  }
});

test('the patched floor cannot be described as a compatible patch', () => {
  const baseline = {
    peerDependencies: { '@nestjs/platform-fastify': '^11.0.0' },
  };
  const manifest = {
    name: pkg().name,
    peerDependencies: {
      '@nestjs/platform-fastify': '^11.2.10',
      '@nestjs/common': '^11.0.0',
      '@nestjs/core': '^11.0.0',
    },
  };
  assert.throws(
    () =>
      validateSsrManifest('nest11', manifest, baseline, {
        minimumBump: 'patch',
      }),
    /breaking/,
  );
  validateSsrManifest('nest11', manifest, baseline, { minimumBump: 'major' });
  assert.throws(() =>
    validateSsrManifest('nest12', manifest, baseline, { minimumBump: 'major' }),
  );
});

test('retained SSR evidence is verified and cannot escape through paths or links', () => {
  const directory = mkdtempSync(join(tmpdir(), 'release-evidence-'));
  try {
    const path = 'evidence/nest-angular-ssr-certification/N11-A22/result.json';
    mkdirSync(
      join(directory, 'evidence/nest-angular-ssr-certification/N11-A22'),
      { recursive: true },
    );
    writeFileSync(join(directory, path), 'ok');
    const evidence = { path, size: 2, sha256: sha256('ok') };
    const r = { packages: [], evidence: { consumers: [evidence] } };
    verifyFiles(r, directory);
    writeFileSync(join(directory, path), 'no');
    assert.throws(() => verifyFiles(r, directory));
    evidence.path = '../outside';
    assert.throws(() => verifyFiles(r, directory));
    evidence.path = path;
    rmSync(join(directory, path));
    symlinkSync('/etc/hosts', join(directory, path));
    assert.throws(() => verifyFiles(r, directory));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('main controller independently reconciles a maintenance record with source, request, lock, baseline and CI', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'maintenance-controller-'));
  const oldFetch = globalThis.fetch;
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const r = record(),
    p = r.packages[0];
  r.controller = { commit: head, digest: controllerDigest() };
  const versionRequest = {
    schema: 1,
    line: r.line,
    branch: MAINTENANCE_BRANCH,
    baseline: r.baseline,
    projects: [p.project],
    channels: { [p.project]: p.distTag },
    versions: { [p.project]: p.nxVersion },
    compatibility: { [p.project]: p.compatibility },
    controllerDigest: r.controller.digest,
  };
  const requestBytes = JSON.stringify(versionRequest);
  r.requestDigest = sha256(requestBytes);
  r.lockDigest = sha256('source lock');
  const encoded = (value) => ({
    encoding: 'base64',
    content: Buffer.from(value).toString('base64'),
  });
  const peers = {
    '@nestjs/common': '^11.0.0',
    '@nestjs/core': '^11.0.0',
    '@nestjs/platform-fastify': '^11.2.10',
  };
  const rules = [
    'deletion',
    'non_fast_forward',
    'required_signatures',
    'pull_request',
  ].map((type) => ({
    type,
    ruleset_id: 1,
    ruleset_source_type: 'Repository',
    ruleset_source: REPOSITORY,
  }));
  rules.push({
    type: 'required_status_checks',
    ruleset_id: 1,
    ruleset_source_type: 'Repository',
    ruleset_source: REPOSITORY,
    parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: [{ context: 'main', integration_id: 15368 }],
    },
  });
  const set = {
    id: 1,
    enforcement: 'active',
    target: 'branch',
    bypass_actors: [],
  };
  const run = {
    repository: { full_name: REPOSITORY },
    head_branch: 'main',
    head_sha: head,
    run_attempt: 1,
    conclusion: 'success',
  };
  let override = {};
  globalThis.fetch = async (url, options) => {
    assert.equal(options.method, 'GET');
    const parsed = new URL(url),
      path = decodeURIComponent(parsed.pathname).replace(
        `/repos/${REPOSITORY}`,
        '',
      );
    if (path === '/contents/packages/nest/angular-ssr/package.json')
      return Response.json(
        encoded(
          JSON.stringify({
            name: p.name,
            version:
              parsed.searchParams.get('ref') === candidate
                ? p.version
                : p.nxVersion.currentVersion,
            peerDependencies: peers,
          }),
        ),
      );
    const values = {
      '/actions/artifacts/42': {
        name: 'community-release-record',
        expired: false,
        workflow_run: { id: 12, head_sha: head },
      },
      '/actions/runs/12': {
        ...run,
        id: 12,
        event: 'workflow_dispatch',
        path: '.github/workflows/release-prepare.yml',
      },
      [`/git/commits/${candidate}`]: { tree: { sha: candidate } },
      [`/compare/${head}...main`]: { status: 'identical' },
      [`/compare/${candidate}...${MAINTENANCE_BRANCH}`]: {
        status: 'identical',
      },
      [`/compare/${MAINTENANCE_ANCHOR}...${candidate}`]: { status: 'ahead' },
      [`/compare/${p.nxBaseline.commit}...${candidate}`]: { status: 'ahead' },
      '/rules/branches/main': rules,
      [`/rules/branches/${MAINTENANCE_BRANCH}`]: rules,
      '/rulesets/1': set,
      '/contents/.release/request.json': encoded(requestBytes),
      [`/git/trees/${candidate}`]: {
        tree: [{ path: 'yarn.lock', type: 'blob', sha: candidate }],
      },
      [`/git/blobs/${candidate}`]: encoded('source lock'),
      [`/git/ref/tags/${p.nxBaseline.tag}`]: {
        object: { type: 'commit', sha: p.nxBaseline.commit },
      },
      '/actions/runs/10': {
        ...run,
        id: 10,
        event: 'push',
        path: '.github/workflows/ci.yml',
        head_sha: candidate,
        head_branch: MAINTENANCE_BRANCH,
      },
      '/actions/runs/10/attempts/1/jobs': {
        jobs: [{ name: 'main', conclusion: 'success' }],
      },
      '/actions/runs/21': {
        ...run,
        id: 21,
        event: 'workflow_dispatch',
        path: '.github/workflows/release.yml',
      },
    };
    assert.ok(Object.hasOwn(values, path), `Unexpected API read ${path}`);
    return Response.json(override[path] ?? values[path]);
  };
  try {
    mkdirSync(join(directory, p.project));
    writeFileSync(join(directory, p.project, p.files[0].name), 'x');
    p.files[0].sha256 = sha256('x');
    const evidencePath = 'evidence/nest-angular-ssr-certification/result.json';
    mkdirSync(join(directory, 'evidence/nest-angular-ssr-certification'), {
      recursive: true,
    });
    const direct = [
      'install',
      'dependency-tree',
      'runtime-audit',
      ...['cjs', 'esm'].flatMap((mode) =>
        [
          'declarations',
          'build',
          'exports-security',
          'module-http',
          'async-http',
          'explicit-http',
        ].map((n) => `${mode}-${n}`),
      ),
    ];
    const proof = {
      status: 'passed',
      releaseAudit: true,
      sourceCommit: head,
      archive: {
        source: 'external-verified-archive',
        sha256: p.files[0].sha256,
      },
      cells: ['N11-A21-min-tool', 'N11-A21-next-tool', 'N11-A22'].map(
        (name) => ({
          name,
          status: 'passed',
          checks: [
            ...direct,
            ...(name === 'N11-A22'
              ? ['split-build', 'split-output-boundary', 'split-http-hydration']
              : []),
          ].map((name) => ({ name, status: 'passed' })),
        }),
      ),
    };
    const proofBytes = JSON.stringify(proof);
    writeFileSync(join(directory, evidencePath), proofBytes);
    r.evidence.consumers = [
      {
        path: evidencePath,
        size: Buffer.byteLength(proofBytes),
        sha256: sha256(proofBytes),
      },
    ];
    const inspect = async () => {
      const bytes = JSON.stringify(r);
      writeFileSync(join(directory, 'release-record.json'), bytes);
      return inspectRequest({
        directory,
        artifactId: 42,
        digest: sha256(bytes),
        action: 'release',
        env: {
          COMMUNITY_RELEASE_CONTROLS: 'active',
          GITHUB_REPOSITORY: REPOSITORY,
          GITHUB_REF: 'refs/heads/main',
          GITHUB_EVENT_NAME: 'workflow_dispatch',
          GITHUB_RUN_ATTEMPT: '1',
          GITHUB_RUN_ID: '21',
          GITHUB_SHA: head,
        },
      });
    };
    assert.equal((await inspect()).record.candidate.commit, candidate);
    for (const bad of [
      { '/contents/.release/request.json': encoded('{}') },
      { [`/git/blobs/${candidate}`]: encoded('different lock') },
      {
        [`/git/ref/tags/${p.nxBaseline.tag}`]: {
          object: { type: 'commit', sha: head },
        },
      },
      {
        [`/compare/${candidate}...${MAINTENANCE_BRANCH}`]: {
          status: 'diverged',
        },
      },
      { '/rulesets/1': { ...set, bypass_actors: [{}] } },
      {
        '/actions/runs/10': {
          ...run,
          event: 'push',
          path: '.github/workflows/ci.yml',
        },
      },
      {
        '/actions/runs/12': {
          ...run,
          id: 12,
          event: 'workflow_dispatch',
          head_sha: candidate,
          path: '.github/workflows/release-prepare.yml',
        },
      },
      {
        [`/compare/${head}...main`]: {
          status: 'ahead',
          files: [{ filename: 'tools/release/lines.mjs' }],
        },
      },
    ]) {
      override = bad;
      await assert.rejects(inspect());
    }
  } finally {
    globalThis.fetch = oldFetch;
    rmSync(directory, { recursive: true, force: true });
  }
});
