import { assert, REPOSITORY, SHA } from './execution.mjs';

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
  return (await repoApi('/git/ref/heads/main')).object.sha;
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
export async function exactCI(commit, runId) {
  const run = await repoApi(`/actions/runs/${runId}`);
  assert(
    run.head_sha === commit &&
      run.head_branch === 'main' &&
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
    url: run.html_url,
  };
}
