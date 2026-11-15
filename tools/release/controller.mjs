import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assert,
  sha256,
  canonical,
  REPOSITORY,
  SHA,
  DIGEST,
  validateRecord,
  verifyFiles,
  validateApproval,
  validateArtifactSource,
  executeRecord,
  planRecord,
} from './execution.mjs';
import {
  repoApi,
  pages,
  mainCommit,
  branchCommit,
  sourceProtection,
  tagIdentity,
  exactCI,
} from './github.mjs';
import {
  MAINTENANCE_ANCHOR,
  validateSsrManifest,
  validateIntegratedRequest,
} from './lines.mjs';

const controllerPaths = [
  'tools/release',
  'tools/fixtures',
  'tools/ci',
  '.github/workflows/ci.yml',
  'packages/nest/angular-ssr/package.json',
  '.github/workflows/release.yml',
  '.github/workflows/publish.yml',
  '.github/workflows/release-prepare.yml',
  '.github/workflows/publish-controller.yml',
  'nx.json',
  'package.json',
  'yarn.lock',
  'OWNERSHIP.md',
  'docs/release-controls.md',
];
export function controllerDigest(root = process.cwd()) {
  return sha256(
    execFileSync('git', ['ls-tree', '-r', 'HEAD', '--', ...controllerPaths], {
      cwd: root,
    }),
  );
}
export async function registry(p) {
  if (p.channel === 'github') return null;
  const url =
    p.channel === 'npm'
      ? `https://registry.npmjs.org/${encodeURIComponent(p.name)}`
      : `https://pypi.org/pypi/${encodeURIComponent(p.name)}/json`;
  const response = await fetch(url, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json();
  if (response.status === 404) {
    assert(
      p.channel === 'npm'
        ? data.error === 'Not found'
        : data.message === 'Not Found',
      'Unknown registry absence response',
    );
    return null;
  }
  assert(response.ok, `Registry unavailable: ${response.status}`);
  const name =
    p.channel === 'npm'
      ? data.name
      : data.info?.name?.toLowerCase().replace(/[-_.]+/g, '-');
  assert(name === p.name, 'Registry identity mismatch');
  assert(
    typeof (p.channel === 'npm' ? data.versions : data.releases) === 'object',
    'Malformed registry version map',
  );
  return data;
}
async function remoteDigest(url, allowedHost) {
  const parsed = new URL(url);
  assert(
    parsed.protocol === 'https:' &&
      parsed.hostname === allowedHost &&
      !parsed.username &&
      !parsed.password,
    'Unexpected archive host',
  );
  const r = await fetch(url, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });
  assert(r.ok, `Cannot verify published archive: ${r.status}`);
  const bytes = await r.arrayBuffer();
  assert(bytes.byteLength < 128 * 1024 * 1024, 'Oversized publication');
  return sha256(Buffer.from(bytes));
}
export async function publication(p) {
  if (p.channel === 'github') return { missing: [] };
  const data = await registry(p);
  if (!data) return { missing: p.files };
  if (p.channel === 'npm') {
    const version = data.versions[p.version];
    if (!version)
      return {
        missing: p.files,
        distTag: data['dist-tags']?.[p.distTag],
        channels: data['dist-tags'] ?? {},
      };
    assert(
      version.name === p.name &&
        version.version === p.version &&
        (await remoteDigest(version.dist.tarball, 'registry.npmjs.org')) ===
          p.files[0].sha256,
      'Published npm bytes differ from approved archive',
    );
    return {
      missing: [],
      distTag: data['dist-tags']?.[p.distTag],
      integrity: version.dist.integrity,
      attestations: version.dist.attestations ?? null,
      channels: data['dist-tags'] ?? {},
    };
  }
  const files = data.releases[p.version] ?? [];
  assert(
    files.every((f) =>
      p.files.some((expected) => expected.name === f.filename),
    ),
    'Unreviewed Python distribution already exists',
  );
  const missing = [];
  for (const expected of p.files) {
    const remote = files.find((f) => f.filename === expected.name);
    if (!remote) missing.push(expected);
    else
      assert(
        !remote.yanked &&
          remote.digests?.sha256 === expected.sha256 &&
          (await remoteDigest(remote.url, 'files.pythonhosted.org')) ===
            expected.sha256,
        'Published Python bytes differ',
      );
  }
  return { missing };
}
export async function freshHistory(p) {
  const tags = (
    await pages(
      '/git/matching-refs/tags/' + encodeURIComponent(p.project + '@'),
    )
  ).map((r) => r.ref.slice(`refs/tags/${p.project}@`.length));
  const releases = (await pages('/releases'))
    .filter((r) => !r.draft && r.tag_name.startsWith(p.project + '@'))
    .map((r) => r.tag_name.slice(p.project.length + 1));
  const data = await registry(p);
  const registryVersions = data
    ? Object.keys(p.channel === 'npm' ? data.versions : data.releases)
    : [];
  for (const [key, current] of Object.entries({
    tags,
    releases,
    registry: registryVersions,
  })) {
    const previous = p.history[key];
    assert(
      Array.isArray(previous) &&
        previous.every((v) => current.includes(v)) &&
        current.every((v) => previous.includes(v) || v === p.version),
      'Publication history changed; new record required',
    );
  }
}
export function releaseBody(record, request, p) {
  return `${p.notes}\n\nCommunity release record: ${request.artifactId}\nSHA256: ${request.digest}\nPreparation: ${record.preparation.runId}\nCandidate: ${record.candidate.commit}\n`;
}
export function parseReleaseBody(body) {
  const match =
    /\nCommunity release record: ([1-9]\d*)\nSHA256: ([a-f0-9]{64})\nPreparation: ([1-9]\d*)\nCandidate: ([a-f0-9]{40})\n$/.exec(
      body ?? '',
    );
  assert(
    match,
    'Release lacks immutable record linkage; use reviewed manual recovery',
  );
  return {
    artifactId: Number(match[1]),
    recordDigest: match[2],
    preparation: Number(match[3]),
    candidate: match[4],
  };
}
export async function inspectRequest({
  directory,
  artifactId,
  digest,
  action,
  tag,
  channel,
  env = process.env,
}) {
  assert(
    env.COMMUNITY_RELEASE_CONTROLS === 'active',
    'Activation blocked until #722 settings acceptance',
  );
  assert(
    env.GITHUB_REPOSITORY === REPOSITORY &&
      env.GITHUB_REF === 'refs/heads/main' &&
      env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
      env.GITHUB_RUN_ATTEMPT === '1',
    'Use a fresh dispatch on main',
  );
  assert(
    Number.isSafeInteger(artifactId) && artifactId > 0 && DIGEST.test(digest),
    'Invalid immutable artifact reference',
  );
  const bytes = readFileSync(join(directory, 'release-record.json'));
  assert(sha256(bytes) === digest, 'Release record digest mismatch');
  const record = validateRecord(JSON.parse(bytes));
  const artifact = await repoApi(`/actions/artifacts/${artifactId}`);
  const preparation = await repoApi(
    `/actions/runs/${record.preparation.runId}`,
  );
  validateArtifactSource(artifact, preparation, record);
  assert(
    controllerDigest() === record.controller.digest,
    'Controller changed; prepare a new record',
  );
  assert(
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() ===
      env.GITHUB_SHA && SHA.test(env.GITHUB_SHA),
    'Controller checkout mismatch',
  );
  const candidate = await repoApi(`/git/commits/${record.candidate.commit}`);
  assert(
    candidate.tree.sha === record.candidate.tree,
    'Candidate tree mismatch',
  );
  if (record.packages.some((p) => p.channel === 'github')) {
    const tree = await repoApi(
      `/git/trees/${record.candidate.tree}?recursive=1`,
    );
    assert(!tree.truncated, 'Cannot verify dbt Git subdirectory');
    for (const p of record.packages.filter((p) => p.channel === 'github'))
      assert(
        tree.tree.some(
          (entry) =>
            entry.path === p.subdirectory &&
            entry.type === 'tree' &&
            entry.sha === p.subtree,
        ),
        'dbt subdirectory differs from approved candidate',
      );
  }
  const comparison = await repoApi(
    `/compare/${record.controller.commit}...main`,
  );
  assert(
    ['ahead', 'identical'].includes(comparison.status),
    'Preparation controller is not integrated on main',
  );
  if (comparison.status === 'ahead') {
    // A queued dispatch checks out its original revision. Do not let it retain
    // authority after a newer main revision changes the controller or owner.
    assert(
      Array.isArray(comparison.files) && comparison.files.length < 300,
      'Cannot establish current controller identity',
    );
    assert(
      comparison.files.every((file) =>
        [file.filename, file.previous_filename]
          .filter(Boolean)
          .every(
            (name) =>
              !controllerPaths.some(
                (path) => name === path || name.startsWith(path + '/'),
              ),
          ),
      ),
      'Release controls or ownership changed on main; prepare a new record',
    );
  }
  const branch = record.candidate.branch ?? 'main';
  if (record.schema === 2) {
    await sourceProtection('main');
    await sourceProtection(branch);
    const source = await repoApi(
      `/compare/${record.candidate.commit}...${encodeURIComponent(branch)}`,
    );
    assert(
      ['ahead', 'identical'].includes(source.status),
      'Candidate is not integrated on its protected source branch',
    );
    const requestFile = await repoApi(
      `/contents/.release/request.json?ref=${record.candidate.commit}`,
    );
    assert(
      requestFile.encoding === 'base64' &&
        sha256(Buffer.from(requestFile.content, 'base64')) ===
          record.requestDigest,
      'Integrated request changed',
    );
    validateIntegratedRequest(
      record,
      JSON.parse(Buffer.from(requestFile.content, 'base64').toString('utf8')),
    );
    const rootTree = await repoApi(`/git/trees/${record.candidate.tree}`);
    const lock = rootTree.tree?.find(
      (entry) => entry.path === 'yarn.lock' && entry.type === 'blob',
    );
    assert(lock && !rootTree.truncated, 'Cannot verify source lock');
    const blob = await repoApi(`/git/blobs/${lock.sha}`);
    assert(
      blob.encoding === 'base64' &&
        sha256(Buffer.from(blob.content, 'base64')) === record.lockDigest,
      'Source lock differs from reviewed record',
    );
    const p = record.packages[0];
    const manifestAt = async (ref) => {
      const file = await repoApi(
        `/contents/packages/nest/angular-ssr/package.json?ref=${ref}`,
      );
      assert(file.encoding === 'base64', 'Cannot verify SSR source manifest');
      return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    };
    const manifest = await manifestAt(record.candidate.commit);
    assert(
      manifest.version === p.version,
      'Source version differs from reviewed archive',
    );
    validateSsrManifest(
      record.line,
      manifest,
      await manifestAt(p.nxBaseline.commit),
      p.compatibility,
    );
    assert(
      (await tagIdentity(p.nxBaseline.tag))?.commit === p.nxBaseline.commit,
      'Nx baseline tag moved',
    );
    if (record.line === 'nest11') {
      const ancestry = await repoApi(
        `/compare/${MAINTENANCE_ANCHOR}...${record.candidate.commit}`,
      );
      assert(
        ['ahead', 'identical'].includes(ancestry.status),
        'Maintenance candidate has unrelated ancestry',
      );
      const baseline = await repoApi(
        `/compare/${p.nxBaseline.commit}...${record.candidate.commit}`,
      );
      assert(
        ['ahead', 'identical'].includes(baseline.status),
        'Nx baseline is not reachable from maintenance',
      );
    }
  }
  await exactCI(record.candidate.commit, record.evidence.ciRunId, branch);
  verifyFiles(record, directory);
  const run = await repoApi(`/actions/runs/${env.GITHUB_RUN_ID}`);
  const expectedWorkflow =
    action === 'release'
      ? '.github/workflows/release.yml'
      : '.github/workflows/publish-controller.yml';
  assert(run.path === expectedWorkflow, 'Wrong privileged controller');
  return { record, run };
}
function readService() {
  return {
    history: freshHistory,
    tag: tagIdentity,
    main: mainCommit,
    branch: branchCommit,
    publication,
    release: async (tag) => {
      const r = await repoApi(`/releases/tags/${encodeURIComponent(tag)}`, {
        missing: true,
      });
      return r ? { ...r, ...parseReleaseBody(r.body) } : null;
    },
    dependency: async (d) => {
      // Read the dependency version's exact retained bytes, not just its dist-tag.
      const state = await publication(d);
      assert(
        state.missing.length === 0,
        `Publish prerequisite first: ${d.project}@${d.version}`,
      );
    },
  };
}

export async function execute({
  directory,
  artifactId,
  digest,
  action,
  tag,
  channel,
  env = process.env,
}) {
  const { record, run } = await inspectRequest({
    directory,
    artifactId,
    digest,
    action,
    tag,
    env,
  });
  const reviews = await repoApi(`/actions/runs/${run.id}/approvals`);
  const approval = validateApproval(
    run,
    reviews,
    action === 'release' ? 'community-release' : 'community-publish',
    env.GITHUB_SHA,
  );
  const request = { action, tag, channel, artifactId, digest };
  const receipt = {
    schema: 1,
    repository: REPOSITORY,
    request,
    approval,
    candidate: record.candidate,
    controller: env.GITHUB_SHA,
  };
  const save = async (state) =>
    writeFileSync(
      'release-receipt.json',
      canonical({ ...receipt, ...state, observedAt: new Date().toISOString() }),
    );
  await save({ complete: false, results: [] });
  const service = {
    ...readService(),
    mutate: async (op) => {
      const p = op.package;
      verifyFiles(record, directory);
      if (op.kind === 'tag') {
        assert(
          (await branchCommit(record.candidate.branch ?? 'main')) ===
            record.candidate.commit && !(await tagIdentity(p.tag)),
          'Tag state changed',
        );
        const object = await repoApi('/git/tags', {
          method: 'POST',
          token: env.RELEASE_TOKEN,
          body: {
            tag: p.tag,
            message: `Approved Community release ${digest}`,
            object: record.candidate.commit,
            type: 'commit',
          },
        });
        await repoApi('/git/refs', {
          method: 'POST',
          token: env.RELEASE_TOKEN,
          body: { ref: `refs/tags/${p.tag}`, sha: object.sha },
        });
        return { object: object.sha, commit: record.candidate.commit };
      }
      if (op.kind === 'release') {
        assert(
          (await tagIdentity(p.tag))?.commit === record.candidate.commit,
          'Missing exact tag',
        );
        const release = await repoApi('/releases', {
          method: 'POST',
          token: env.RELEASE_TOKEN,
          body: {
            tag_name: p.tag,
            target_commitish: record.candidate.commit,
            name: p.tag,
            body: releaseBody(record, request, p),
            draft: false,
            prerelease: p.version.includes('-'),
            make_latest: 'false',
          },
        });
        return { id: release.id, url: release.html_url };
      }
      const state = await publication(p);
      const cleanEnv = {
        ...env,
        NODE_OPTIONS: '',
        NPM_CONFIG_IGNORE_SCRIPTS: 'true',
        NPM_CONFIG_USERCONFIG: resolve('publisher.npmrc'),
        NPM_CONFIG_GLOBALCONFIG: resolve('publisher-global.npmrc'),
      };
      delete cleanEnv.NODE_AUTH_TOKEN;
      delete cleanEnv.NPM_TOKEN;
      for (const key of Object.keys(cleanEnv))
        if (key.startsWith('UV_') || key.startsWith('TWINE_'))
          delete cleanEnv[key];
      writeFileSync(
        'publisher.npmrc',
        'registry=https://registry.npmjs.org/\nignore-scripts=true\n',
      );
      writeFileSync('publisher-global.npmrc', '');
      if (p.channel === 'npm') {
        const version = execFileSync('npm', ['--version'], {
          env: cleanEnv,
          encoding: 'utf8',
        })
          .trim()
          .split('.')
          .map(Number);
        const floor = op.kind === 'channel' ? 21 : 5;
        assert(
          version[0] === 11 &&
            (version[1] > floor ||
              (version[1] === floor && version[2] >= (floor === 5 ? 1 : 0))),
          'Review a supported npm 11 CLI: publish >=11.5.1, channel >=11.21.0',
        );
        const args =
          op.kind === 'channel'
            ? [
                'dist-tag',
                'add',
                `${p.name}@${p.version}`,
                p.distTag,
                '--registry=https://registry.npmjs.org/',
              ]
            : [
                'publish',
                resolve(directory, p.project, p.files[0].name),
                '--ignore-scripts',
                '--provenance',
                '--access=public',
                `--tag=${p.distTag}`,
                '--registry=https://registry.npmjs.org/',
              ];
        assert(
          op.kind === 'channel'
            ? state.missing.length === 0
            : state.missing.length === 1,
          'Registry state changed',
        );
        execFileSync('npm', args, { env: cleanEnv, stdio: 'inherit' });
      } else if (p.channel === 'pypi') {
        assert(op.kind === 'publish', 'Unsupported Python mutation');
        for (const file of state.missing)
          execFileSync(
            'uv',
            [
              'publish',
              '--no-config',
              '--keyring-provider',
              'disabled',
              '--trusted-publishing',
              'always',
              '--publish-url',
              'https://upload.pypi.org/legacy/',
              resolve(directory, p.project, file.name),
            ],
            { env: cleanEnv, stdio: 'inherit' },
          );
      } else
        throw new Error(
          'dbt distribution is the approved Git tag; no registry upload',
        );
      const after = await publication(p);
      if (record.line === 'nest11')
        assert(
          ['latest', 'next'].every(
            (name) => after.channels?.[name] === state.channels?.[name],
          ),
          'Maintenance mutation changed a feature channel',
        );
      return after;
    },
    verify: async (p, action) => {
      const tag = await tagIdentity(p.tag);
      assert(tag?.commit === record.candidate.commit, 'Final tag mismatch');
      if (action === 'release') {
        const release = await service.release(p.tag);
        assert(release?.recordDigest === digest, 'Release linkage mismatch');
        return {
          tag,
          release: {
            id: release.id,
            url: release.html_url,
            recordDigest: release.recordDigest,
          },
        };
      }
      const state = await publication(p);
      assert(
        state.missing.length === 0 &&
          (p.channel !== 'npm' || state.distTag === p.version),
        'Publication incomplete',
      );
      return {
        tag,
        publication: state,
        files: p.files.map((f) => ({ name: f.name, sha256: f.sha256 })),
        ...(p.channel === 'github'
          ? { subdirectory: p.subdirectory, subtree: p.subtree }
          : {}),
      };
    },
    receipt: save,
  };
  return executeRecord(record, request, service);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const options = {
    directory: resolve(process.env.RELEASE_DIRECTORY ?? 'release-payload'),
    artifactId: Number(process.env.RELEASE_ARTIFACT_ID),
    digest: process.env.RELEASE_DIGEST,
    action: process.env.RELEASE_ACTION,
    tag: process.env.RELEASE_TAG,
    channel: process.env.RELEASE_CHANNEL || undefined,
  };
  const operation =
    process.argv[2] === 'locate'
      ? (async () => {
          assert(
            /^[1-9]\d*$/.test(process.env.RELEASE_ARTIFACT_ID),
            'Select one artifact ID',
          );
          const artifact = await repoApi(
            `/actions/artifacts/${options.artifactId}`,
          );
          assert(
            !artifact.expired &&
              artifact.name === 'community-release-record' &&
              artifact.workflow_run?.id > 0,
            'Invalid release artifact',
          );
          const preparation = await repoApi(
            `/actions/runs/${artifact.workflow_run.id}`,
          );
          assert(
            preparation.repository?.full_name === REPOSITORY &&
              preparation.path === '.github/workflows/release-prepare.yml' &&
              preparation.event === 'workflow_dispatch' &&
              preparation.head_branch === 'main' &&
              preparation.run_attempt === 1 &&
              preparation.conclusion === 'success' &&
              preparation.head_sha === artifact.workflow_run.head_sha,
            'Do not download artifacts from an untrusted run',
          );
          writeFileSync(
            process.env.GITHUB_OUTPUT,
            `run_id=${artifact.workflow_run.id}\n`,
            { flag: 'a' },
          );
        })()
      : process.argv[2] === 'review'
        ? inspectRequest(options).then(async ({ record }) => {
            const { plan } = await planRecord(record, options, readService());
            const summary = `## Release review\n\nAction: ${options.action}\n\nArtifact ID: ${options.artifactId}\n\nRecord SHA-256: ${options.digest}\n\nCandidate: ${record.candidate.commit}\n\nController: ${process.env.GITHUB_SHA}\n\nChannel target: ${options.channel ?? 'recorded publication channel'}\n\nSource branch: ${record.candidate.branch ?? 'main'}\n\nTag: ${options.tag ?? 'all recorded tags'}\n\nPackages:\n${record.packages.map((p) => `- ${p.project}@${p.version} (${p.channel}, ${p.distTag})`).join('\n')}\n\nRemaining mutations:\n${plan.map((op) => `- ${op.kind}: ${op.package.tag}${op.files ? ` (${op.files.map((f) => f.name).join(', ')})` : ''}`).join('\n') || 'None; verified reconciliation only'}\n\nInspect the retained release-record.json for compatibility, closure, inventories and exact CI evidence before approving.\n`;
            writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
          })
        : execute(options);
  operation.catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
