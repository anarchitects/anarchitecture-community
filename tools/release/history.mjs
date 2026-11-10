import { execFileSync } from 'node:child_process';
import { requireCondition, validateHistory } from './policy.mjs';

export const repository = 'anarchitects/anarchitecture-community';
const exec = (command, args) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
  });

export async function registryVersions(identity, fetcher = fetch) {
  if (identity.channel === 'github') return [];
  requireCondition(
    ['npm', 'pypi'].includes(identity.channel),
    'Unsupported distribution channel',
  );
  const url =
    identity.channel === 'npm'
      ? `https://registry.npmjs.org/${encodeURIComponent(identity.name)}`
      : `https://pypi.org/pypi/${encodeURIComponent(identity.name)}/json`;
  const response = await fetcher(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    redirect: 'error',
  });
  const data = await response.json();
  if (response.status === 404) {
    requireCondition(
      identity.channel === 'npm'
        ? data.error === 'Not found'
        : data.message === 'Not Found',
      'Unrecognized registry absence response',
    );
    return [];
  }
  requireCondition(
    response.ok,
    `Registry history unavailable (${response.status}) for ${identity.name}`,
  );
  const name =
    identity.channel === 'npm'
      ? data?.name
      : data?.info?.name?.toLowerCase().replace(/[-_.]+/g, '-');
  requireCondition(
    name === identity.name,
    `Malformed registry identity for ${identity.name}`,
  );
  const versions = identity.channel === 'npm' ? data.versions : data.releases;
  requireCondition(
    versions && typeof versions === 'object' && !Array.isArray(versions),
    `Malformed registry history for ${identity.name}`,
  );
  return Object.keys(versions);
}

/** Fresh reads only. Never persist this as cacheable release authorization. */
export async function collectHistories(
  identities,
  { execute = exec, fetcher = fetch } = {},
) {
  if (identities.length === 0) return {};
  const refs = execute('git', [
    'ls-remote',
    '--tags',
    `https://github.com/${repository}.git`,
  ]);
  const pages = JSON.parse(
    execute('gh', [
      'api',
      '--paginate',
      '--slurp',
      `repos/${repository}/releases?per_page=100`,
    ]),
  );
  requireCondition(
    Array.isArray(pages) && pages.every(Array.isArray),
    'Malformed GitHub release history',
  );
  const releases = pages.flat();
  requireCondition(
    releases.every(
      (r) => typeof r.tag_name === 'string' && typeof r.draft === 'boolean',
    ),
    'Malformed GitHub release record',
  );
  const tags = refs.trim()
    ? refs
        .trim()
        .split('\n')
        .map((line) => {
          requireCondition(
            /^[a-f0-9]{40}\s+refs\/tags\/\S+$/.test(line),
            'Malformed remote tag history',
          );
          return line
            .split(/\s+/)[1]
            .slice('refs/tags/'.length)
            .replace(/\^\{\}$/, '');
        })
    : [];
  return Object.fromEntries(
    await Promise.all(
      identities.map(async (identity) => {
        const prefix = `${identity.project}@`;
        const versions = (names) => [
          ...new Set(
            names
              .filter((n) => n.startsWith(prefix))
              .map((n) => n.slice(prefix.length)),
          ),
        ];
        const history = {
          project: identity.project,
          channel: identity.channel,
          tags: versions(tags),
          releases: versions(
            releases.filter((r) => !r.draft).map((r) => r.tag_name),
          ),
          registry: await registryVersions(identity, fetcher),
          checkedAt: new Date().toISOString(),
        };
        validateHistory(history, identity.project);
        return [identity.project, history];
      }),
    ),
  );
}
