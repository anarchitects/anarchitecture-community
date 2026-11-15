import { readFileSync } from 'node:fs';
import {
  assert,
  REPOSITORY,
  SHA,
  OWNER,
  sha256,
  canonical,
} from './execution.mjs';
import { MAINTENANCE_BRANCH } from './lines.mjs';

export async function github(
  path,
  { method = 'GET', body, token = process.env.GH_TOKEN, missing = false } = {},
) {
  assert(
    path.startsWith('/') && !path.includes('://'),
    'Invalid GitHub API path',
  );
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 404 && missing) return null;
  assert(response.ok, `GitHub ${method} ${path}: ${response.status}`);
  return response.status === 204 ? null : response.json();
}
export const repoApi = (path, options) =>
  github(`/repos/${REPOSITORY}${path}`, options);
export async function pages(path, key) {
  const items = [];
  for (let page = 1; page <= 100; page++) {
    const value = await repoApi(
      `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
    );
    const batch = key ? value[key] : value;
    assert(Array.isArray(batch), 'Malformed paginated GitHub response');
    items.push(...batch);
    if (batch.length < 100) return items;
  }
  throw new Error('GitHub pagination limit; review before release');
}
export async function mainCommit() {
  return branchCommit('main');
}
export async function branchCommit(branch) {
  assert(
    ['main', MAINTENANCE_BRANCH].includes(branch),
    'Unapproved source branch',
  );
  const commit = (await repoApi(`/git/ref/heads/${encodeURIComponent(branch)}`))
    .object.sha;
  assert(SHA.test(commit), 'Invalid source head');
  return commit;
}

export function protectionTimestamp(value) {
  // GitHub renders the same revision in the caller's offset or UTC. Require
  // an explicit zone and millisecond-or-coarser precision; never guess a zone
  // or truncate a more precise revision when binding the owner's snapshot.
  assert(
    typeof value === 'string' &&
      /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(
        value,
      ),
    'Invalid source protection revision timestamp',
  );
  const instant = Date.parse(value);
  assert(
    Number.isFinite(instant) &&
      new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) ===
        value.slice(0, 10),
    'Invalid source protection revision timestamp',
  );
  return new Date(instant).toISOString();
}

export function protectionRevision(ruleset) {
  return sha256(
    canonical(
      Object.fromEntries(
        [
          'id',
          'source_type',
          'source',
          'target',
          'enforcement',
          'conditions',
          'rules',
          'updated_at',
        ].map((key) => [
          key,
          key === 'updated_at'
            ? protectionTimestamp(ruleset[key])
            : ruleset[key],
        ]),
      ),
    ),
  );
}

export function validateProtection(branch, rules, rulesets, snapshots = []) {
  assert(
    ['main', MAINTENANCE_BRANCH].includes(branch),
    'Unapproved protected branch',
  );
  assert(
    Array.isArray(rules) && rules.length > 0,
    'Missing effective source rules',
  );
  for (const rule of rules) {
    const set = rulesets.find((s) => s.id === rule.ruleset_id);
    assert(
      set?.enforcement === 'active' && set.target === 'branch',
      'Source rules must be active',
    );
    if (Object.hasOwn(set, 'bypass_actors')) {
      assert(
        Array.isArray(set.bypass_actors) && set.bypass_actors.length === 0,
        'Source rules must have verified empty bypass lists',
      );
    } else {
      // GitHub hides bypass lists from read-only workflow tokens. Never treat
      // omission as an empty list or grant the build job ruleset write access.
      const snapshot = snapshots.find((s) => s.id === set.id);
      assert(
        snapshot?.ownerId === OWNER.id &&
          snapshot.bypassActors?.length === 0 &&
          Array.isArray(snapshot.bypassActors) &&
          protectionTimestamp(snapshot.updatedAt) ===
            protectionTimestamp(set.updated_at) &&
          snapshot.publicDigest === protectionRevision(set),
        'Hidden bypass list requires owner-reviewed matching ruleset revision',
      );
    }
  }
  for (const type of [
    'deletion',
    'non_fast_forward',
    'required_signatures',
    'pull_request',
  ])
    assert(
      rules.some((r) => r.type === type),
      `Missing source protection: ${type}`,
    );
  assert(
    rules.some(
      (r) =>
        r.type === 'required_status_checks' &&
        r.parameters?.strict_required_status_checks_policy === true &&
        r.parameters.required_status_checks?.some(
          (c) => c.context === 'main' && c.integration_id === 15368,
        ),
    ),
    'Missing strict main check bound to GitHub Actions',
  );
  return {
    branch,
    rules,
    rulesets,
    snapshots,
    checkedAt: new Date().toISOString(),
  };
}

export async function sourceProtection(branch) {
  const rules = await pages(`/rules/branches/${encodeURIComponent(branch)}`);
  const rulesets = [];
  for (const rule of rules) {
    if (rulesets.some((s) => s.id === rule.ruleset_id)) continue;
    assert(
      Number.isSafeInteger(rule.ruleset_id) && rule.ruleset_id > 0,
      'Invalid ruleset identity',
    );
    const path =
      rule.ruleset_source_type === 'Repository' &&
      rule.ruleset_source === REPOSITORY
        ? `/repos/${REPOSITORY}/rulesets/${rule.ruleset_id}`
        : rule.ruleset_source_type === 'Organization' &&
            rule.ruleset_source === 'anarchitects'
          ? `/orgs/anarchitects/rulesets/${rule.ruleset_id}`
          : null;
    assert(path, 'Unverified inherited source ruleset');
    rulesets.push(await github(path));
  }
  const approvals = JSON.parse(
    readFileSync(new URL('./source-protection.json', import.meta.url), 'utf8'),
  );
  assert(approvals.schema === 1, 'Invalid source-protection snapshot format');
  return validateProtection(
    branch,
    rules,
    rulesets,
    approvals.branches[branch] ?? [],
  );
}
export async function tagIdentity(tag) {
  const ref = await repoApi(`/git/ref/tags/${encodeURIComponent(tag)}`, {
    missing: true,
  });
  if (!ref) return null;
  let object = ref.object;
  const objectId = object.sha;
  for (let depth = 0; object.type === 'tag' && depth < 5; depth++)
    object = (await repoApi(`/git/tags/${object.sha}`)).object;
  assert(
    object.type === 'commit' && SHA.test(object.sha),
    'Invalid release tag object',
  );
  return { objectId, commit: object.sha };
}
export async function exactCI(commit, runId, branch = 'main') {
  assert(['main', MAINTENANCE_BRANCH].includes(branch), 'Unapproved CI branch');
  const run = await repoApi(`/actions/runs/${runId}`);
  assert(
    run.head_sha === commit &&
      run.head_branch === branch &&
      run.event === 'push' &&
      run.path === '.github/workflows/ci.yml' &&
      run.conclusion === 'success' &&
      run.repository?.full_name === REPOSITORY,
    'Exact integrated candidate CI is not successful',
  );
  const jobs = await pages(
    `/actions/runs/${runId}/attempts/${run.run_attempt}/jobs`,
    'jobs',
  );
  assert(
    jobs.some((j) => j.name === 'main' && j.conclusion === 'success') &&
      jobs.every((j) => ['success', 'skipped'].includes(j.conclusion)),
    'Missing required CI aggregate or failed jobs',
  );
  return {
    id: runId,
    attempt: run.run_attempt,
    head: commit,
    branch,
    url: run.html_url,
  };
}
