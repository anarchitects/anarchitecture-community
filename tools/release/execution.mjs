// Credentialed execution deliberately uses only Node built-ins, never candidate code.
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export const REPOSITORY = 'anarchitects/anarchitecture-community';
export const OWNER = Object.freeze({ login: 'vrxj81', id: 5003361 });
export const SHA = /^[a-f0-9]{40}$/;
export const DIGEST = /^[a-f0-9]{64}$/;
export const VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
export const PROJECT = /^[a-z][a-z0-9-]+$/;
export const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
export const canonical = (value) => JSON.stringify(value, null, 2) + '\n';

export function validateRecord(record) {
  assert(
    record?.schema === 1 && record.repository === REPOSITORY,
    'Wrong release record/repository',
  );
  assert(
    record.owner?.id === OWNER.id && record.owner.login === OWNER.login,
    'Owner mapping changed',
  );
  for (const value of [
    record.candidate?.commit,
    record.candidate?.tree,
    record.baseline,
    record.controller?.commit,
  ])
    assert(SHA.test(value), 'Immutable commit/tree required');
  assert(
    DIGEST.test(record.controller.digest) && DIGEST.test(record.lockDigest),
    'Controller/lock digest required',
  );
  assert(
    record.controller.commit === record.candidate.commit,
    'Preparation controller must be integrated with the candidate',
  );
  assert(
    Number.isSafeInteger(record.preparation?.runId) &&
      record.preparation.runId > 0 &&
      record.preparation.attempt === 1,
    'Invalid preparation run',
  );
  assert(
    Array.isArray(record.packages) && record.packages.length > 0,
    'Empty release scope',
  );
  assert(
    new Set(record.packages.map((p) => p.project)).size ===
      record.packages.length,
    'Duplicate project',
  );
  assert(
    record.evidence?.ciRunId > 0 && record.evidence.gates?.length > 0,
    'Missing readiness evidence',
  );
  for (const p of record.packages) {
    assert(
      PROJECT.test(p.project) &&
        VERSION.test(p.version) &&
        p.tag === `${p.project}@${p.version}`,
      'Invalid project/tag/version',
    );
    assert(
      ['npm', 'pypi', 'github'].includes(p.channel) &&
        typeof p.name === 'string',
      'Invalid distribution identity',
    );
    assert(p.nxVersion?.newVersion === p.version, 'Missing Nx version result');
    assert(
      ['none', 'patch', 'minor', 'major'].includes(
        p.compatibility?.minimumBump,
      ) && p.compatibility.evidence?.trim(),
      'Missing compatibility review',
    );
    assert(/^[a-z][a-z0-9-]*$/.test(p.distTag), 'Invalid registry channel');
    assert(
      Array.isArray(p.files) && p.files.length > 0,
      'Missing final artifacts',
    );
    for (const f of p.files) {
      assert(
        /^[a-zA-Z0-9_.-]+$/.test(f.name) &&
          f.name !== '.' &&
          f.name !== '..' &&
          DIGEST.test(f.sha256),
        'Unsafe artifact identity',
      );
      assert(
        Number.isSafeInteger(f.size) && f.size > 0,
        'Invalid artifact size',
      );
    }
    assert(
      new Set(p.files.map((f) => f.name)).size === p.files.length,
      'Duplicate artifact',
    );
    if (p.channel === 'npm')
      assert(
        p.files.length === 1 && p.files[0].name.endsWith('.tgz'),
        'npm requires one exact archive',
      );
    if (p.channel === 'pypi')
      assert(
        p.files.length === 2 &&
          p.files.some((f) => f.name.endsWith('.whl')) &&
          p.files.some((f) => f.name.endsWith('.tar.gz')),
        'Python requires wheel and sdist',
      );
    if (p.channel === 'github')
      assert(
        /^packages\/[a-z0-9/-]+$/.test(p.subdirectory) &&
          !p.subdirectory.includes('..') &&
          SHA.test(p.subtree),
        'Missing dbt Git subdirectory identity',
      );
    assert(Array.isArray(p.dependencies), 'Missing publication closure');
  }
  return record;
}

export function verifyFiles(record, directory) {
  for (const p of record.packages)
    for (const f of p.files) {
      const path = resolve(directory, p.project, f.name);
      assert(
        path.startsWith(resolve(directory) + sep) &&
          realpathSync(path).startsWith(realpathSync(directory) + sep) &&
          lstatSync(path).isFile() &&
          !lstatSync(path).isSymbolicLink(),
        'Unsafe artifact path',
      );
      const bytes = readFileSync(path);
      assert(
        bytes.length === f.size && sha256(bytes) === f.sha256,
        `Artifact changed: ${p.project}/${f.name}`,
      );
    }
  for (const evidence of record.evidence.consumers ?? []) {
    assert(
      /^evidence\/[a-z0-9-]+-package-lock\.json$/.test(evidence.path),
      'Unsafe consumer evidence path',
    );
    const path = resolve(directory, evidence.path);
    assert(
      realpathSync(path).startsWith(realpathSync(directory) + sep),
      'Consumer evidence escaped artifact',
    );
    const bytes = readFileSync(path);
    assert(
      bytes.length === evidence.size && sha256(bytes) === evidence.sha256,
      'Consumer lock changed',
    );
  }
}

export function validateApproval(run, reviews, environment, controllerCommit) {
  assert(
    run.repository?.full_name === REPOSITORY &&
      run.head_branch === 'main' &&
      run.event === 'workflow_dispatch',
    'Mutation must use the main controller',
  );
  assert(
    run.head_sha === controllerCommit && run.run_attempt === 1,
    'Retry via a NEW dispatch; old attempts cannot inherit approval',
  );
  const decisions = reviews.filter((r) =>
    r.environments?.some((e) => e.name === environment),
  );
  assert(
    decisions.length === 1 &&
      decisions[0].state === 'approved' &&
      decisions[0].user?.id === OWNER.id &&
      decisions[0].user.login === OWNER.login,
    'Missing, rejected or ambiguous owner approval',
  );
  return {
    runId: run.id,
    attempt: run.run_attempt,
    environment,
    owner: OWNER,
    review: decisions[0],
    checkedAt: new Date().toISOString(),
  };
}

export function validateArtifactSource(artifact, run, record) {
  assert(
    !artifact.expired &&
      artifact.name === 'community-release-record' &&
      artifact.workflow_run?.id === record.preparation.runId,
    'Missing/expired/unrelated release artifact',
  );
  assert(
    run.id === record.preparation.runId &&
      run.run_attempt === 1 &&
      run.conclusion === 'success' &&
      run.event === 'workflow_dispatch' &&
      run.head_branch === 'main' &&
      run.head_sha === record.candidate.commit &&
      run.path === '.github/workflows/release-prepare.yml' &&
      run.repository?.full_name === REPOSITORY,
    'Untrusted preparation provenance',
  );
  assert(
    artifact.workflow_run.head_sha === record.candidate.commit,
    'Artifact candidate mismatch',
  );
}

/** Complete preflight before the first mutation. Existing results never imply success blindly. */
export async function planRecord(record, request, service) {
  validateRecord(record);
  assert(
    ['release', 'publish', 'channel'].includes(request.action),
    'Invalid action',
  );
  const selected =
    request.action === 'release'
      ? record.packages
      : record.packages.filter((p) => p.tag === request.tag);
  assert(selected.length > 0, 'Tag is outside approved scope');
  const plan = [];
  for (const p of selected) {
    await service.history(p);
    const tag = await service.tag(p.tag);
    if (tag)
      assert(
        tag.commit === record.candidate.commit,
        `Conflicting tag: ${p.tag}`,
      );
    if (request.action === 'release') {
      // A version may have been uploaded manually or during an interrupted run.
      // Reject conflicting bytes before creating even the first tag.
      await service.publication(p);
      if (!tag) {
        assert(
          (await service.main()) === record.candidate.commit,
          'Main advanced; prepare a new candidate before creating tags',
        );
        plan.push({ kind: 'tag', package: p });
      }
      const release = await service.release(p.tag);
      if (release)
        assert(
          release.recordDigest === request.digest &&
            release.artifactId === request.artifactId &&
            !release.draft,
          'Existing release has a different record',
        );
      else plan.push({ kind: 'release', package: p });
    } else {
      assert(tag, 'Publish requires an existing exact tag');
      for (const dependency of p.dependencies)
        await service.dependency(dependency);
      const state = await service.publication(p);
      // service.publication verifies every existing archive byte before returning.
      if (request.action === 'channel') {
        assert(
          p.channel === 'npm' && state.missing.length === 0,
          'Channel moves require an existing verified npm version',
        );
        if (state.distTag !== p.version)
          plan.push({ kind: 'channel', package: p });
      } else {
        if (state.missing.length)
          plan.push({ kind: 'publish', package: p, files: state.missing });
        else if (p.channel === 'npm')
          assert(
            state.distTag === p.version,
            'Existing bytes match but channel differs; request an explicit channel action',
          );
      }
    }
  }
  return { selected, plan };
}

export async function executeRecord(record, request, service) {
  const { selected, plan } = await planRecord(record, request, service);
  const results = [];
  for (const operation of plan) {
    // Serialized workflow plus another live read closes the normal check/write race.
    await service.history(operation.package);
    const result = await service.mutate(operation);
    results.push({
      kind: operation.kind,
      project: operation.package.project,
      result,
    });
    await service.receipt({ complete: false, results });
  }
  const observed = [];
  for (const p of selected)
    observed.push({
      project: p.project,
      state: await service.verify(p, request.action),
    });
  await service.receipt({ complete: true, results, observed });
  return results;
}
