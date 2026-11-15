// Main-owned admission before any maintenance checkout/install/build.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { assert, SHA, REPOSITORY } from './execution.mjs';
import { releaseLine, MAINTENANCE_ANCHOR } from './lines.mjs';
import { branchCommit, sourceProtection, exactCI, repoApi } from './github.mjs';

export async function admitSource(env = process.env) {
  assert(
    env.GITHUB_REPOSITORY === REPOSITORY &&
      env.GITHUB_REF === 'refs/heads/main' &&
      env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
      env.GITHUB_RUN_ATTEMPT === '1',
    'Preparation admission requires a fresh main dispatch',
  );
  assert(
    (await branchCommit('main')) === env.GITHUB_SHA,
    'Preparation controller is stale',
  );
  const line = env.RELEASE_LINE;
  if (line === 'standard') {
    assert(
      !env.RELEASE_SOURCE_COMMIT,
      'Standard preparation cannot select another source',
    );
    return env.GITHUB_SHA;
  }
  const policy = releaseLine(line);
  const commit = line === 'nest11' ? env.RELEASE_SOURCE_COMMIT : env.GITHUB_SHA;
  assert(SHA.test(commit), 'Select an immutable maintenance source SHA');
  assert(
    !env.RELEASE_SOURCE_COMMIT || env.RELEASE_SOURCE_COMMIT === commit,
    'Source mismatch',
  );
  await sourceProtection('main');
  await sourceProtection(policy.branch);
  assert(
    (await branchCommit(policy.branch)) === commit,
    'Source head advanced',
  );
  if (line === 'nest11') {
    const ancestry = await repoApi(
      `/compare/${MAINTENANCE_ANCHOR}...${commit}`,
    );
    assert(
      ['ahead', 'identical'].includes(ancestry.status),
      'Unrelated maintenance source',
    );
  }
  await exactCI(commit, Number(env.RELEASE_CI_RUN_ID), policy.branch);
  return commit;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  admitSource()
    .then((commit) =>
      writeFileSync(process.env.GITHUB_OUTPUT, `commit=${commit}\n`, {
        flag: 'a',
      }),
    )
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
