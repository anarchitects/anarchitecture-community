import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Job admission maps checks to Nx projects, never to package paths. Root owns
// the Nest fixture validators and explicitly depends on their fixture projects.
export const jobProjects = {
  'editorjs-core-runtime-baseline': [
    'editorjs-core',
    'editorjs-tool-paragraph',
    'editorjs-tool-header',
    'editorjs-tool-list',
    'editorjs-tool-quote',
    'editorjs-tool-image',
    'editorjs-upload-fetch',
    'editorjs-html',
  ],
  'better-auth-typeorm-adapter-compatibility': ['better-auth-typeorm-adapter'],
  'nest-angular-ssr-consumers': ['@anarchitecture-community/source'],
  'nest-angular-ssr-compatibility': ['@anarchitecture-community/source'],
  'editorjs-angular-browser': ['editorjs-angular-e2e', 'editorjs-upload-fetch'],
  'editorjs-angular-ssr': ['editorjs-angular-e2e', 'editorjs-html-angular'],
  'editorjs-angular-packed': ['editorjs-angular-e2e'],
  workspace: [],
};

export function selectJobs(projects, allProjects, mode) {
  if (!['affected', 'all'].includes(mode))
    throw new Error('Invalid selection mode');
  for (const name of Object.values(jobProjects).flat()) {
    if (!allProjects.includes(name))
      throw new Error(`Missing CI project: ${name}`);
  }
  if (projects.some((name) => !allProjects.includes(name))) {
    throw new Error('Affected selection contains an unknown project');
  }
  return Object.fromEntries(
    Object.entries(jobProjects).map(([job, owners]) => [
      job,
      mode === 'all' ||
        (job === 'workspace'
          ? projects.length > 0
          : owners.some((name) => projects.includes(name))),
    ]),
  );
}

const shaPattern = /^[0-9a-f]{40}$/;
const validSha = (value) =>
  typeof value === 'string' &&
  shaPattern.test(value) &&
  value !== '0'.repeat(40);

export function comparison({ eventName, event, sha, git }) {
  const fallback = (reason) => ({ mode: 'all', base: '', head: '', reason });
  const base =
    eventName === 'pull_request'
      ? event.pull_request?.base?.sha
      : eventName === 'push'
        ? event.before
        : event.merge_group?.base_sha;
  if (!validSha(base) || !validSha(sha))
    return fallback('missing-or-invalid-revisions');
  try {
    if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'false') {
      return fallback('shallow-history');
    }
    if (git(['rev-parse', 'HEAD']).trim() !== sha)
      return fallback('checkout-head-mismatch');
    for (const revision of [base, sha])
      git(['cat-file', '-e', `${revision}^{commit}`]);
    git(['merge-base', '--is-ancestor', base, sha]);
    if (eventName === 'pull_request') {
      const sourceHead = event.pull_request?.head?.sha;
      if (!validSha(sourceHead)) return fallback('invalid-pr-head');
      git(['merge-base', '--is-ancestor', sourceHead, sha]);
      return {
        mode: 'affected',
        base,
        head: sha,
        reason: 'verified-pr-comparison',
      };
    }
    // A previous push need not have passed CI. Main and queue candidates retain
    // the complete integration baseline, without querying hosted CI history.
    return {
      mode: 'all',
      base,
      head: sha,
      reason: 'full-integration-baseline',
    };
  } catch {
    return fallback('unavailable-or-unrelated-history');
  }
}

export function validatePlan(plan) {
  if (
    plan?.version !== 1 ||
    !['all', 'affected'].includes(plan.mode) ||
    !Array.isArray(plan.projects) ||
    !plan.projects.every((name) => typeof name === 'string') ||
    typeof plan.reason !== 'string' ||
    !plan.selected ||
    typeof plan.selected !== 'object'
  ) {
    throw new Error('Missing or invalid CI selection');
  }
  if (
    plan.mode === 'affected' &&
    (!validSha(plan.base) || !validSha(plan.head))
  ) {
    throw new Error('Invalid affected revisions');
  }
  const keys = Object.keys(jobProjects);
  if (
    Object.keys(plan.selected).length !== keys.length ||
    keys.some(
      (job) =>
        typeof plan.selected[job] !== 'boolean' ||
        (plan.mode === 'all' && !plan.selected[job]),
    )
  ) {
    throw new Error('Incomplete or invalid job selection');
  }
  if (plan.mode === 'affected') {
    const expected = selectJobs(
      plan.projects,
      [...new Set([...plan.projects, ...Object.values(jobProjects).flat()])],
      plan.mode,
    );
    if (keys.some((job) => plan.selected[job] !== expected[job])) {
      throw new Error('Job selection disagrees with affected projects');
    }
  }
  return plan;
}

export function checkResults(needs) {
  if (needs.selection?.result !== 'success')
    throw new Error('CI selection did not succeed');
  const plan = validatePlan(JSON.parse(needs.selection.outputs.plan));
  const expectedJobs = ['selection', ...Object.keys(jobProjects)].sort();
  if (
    JSON.stringify(Object.keys(needs).sort()) !== JSON.stringify(expectedJobs)
  ) {
    throw new Error('Aggregate job dependencies are incomplete or unexpected');
  }
  for (const [job, selected] of Object.entries(plan.selected)) {
    const expected = selected ? 'success' : 'skipped';
    if (needs[job]?.result !== expected) {
      throw new Error(
        `${job}: expected ${expected}, received ${needs[job]?.result ?? 'missing'}`,
      );
    }
  }
}

function nxProjects(args) {
  const result = JSON.parse(
    execFileSync('yarn', ['nx', 'show', 'projects', '--json', ...args], {
      encoding: 'utf8',
      env: { ...process.env, NX_DAEMON: 'false' },
      maxBuffer: 10 * 1024 * 1024,
    }),
  );
  if (
    !Array.isArray(result) ||
    !result.every((name) => typeof name === 'string')
  ) {
    throw new Error('Invalid Nx project selection');
  }
  return result.sort();
}

export function createPlan({ revisions, listProjects = nxProjects }) {
  // A graph failure is fatal. It must never become an empty successful selection.
  const allProjects = listProjects([]);
  let projects = allProjects;
  if (revisions.mode === 'affected') {
    try {
      projects = listProjects([
        '--affected',
        `--base=${revisions.base}`,
        `--head=${revisions.head}`,
      ]);
    } catch {
      revisions = {
        ...revisions,
        mode: 'all',
        reason: 'affected-query-failed',
      };
    }
  }
  return validatePlan({
    version: 1,
    ...revisions,
    projects,
    selected: selectJobs(projects, allProjects, revisions.mode),
  });
}

export function workspaceArgs(plan) {
  validatePlan(plan);
  if (!plan.selected.workspace)
    throw new Error('Workspace job was not selected');
  return [
    'nx',
    plan.mode === 'all' ? 'run-many' : 'affected',
    '-t',
    'lint',
    'test',
    'build',
    'typecheck',
    ...(plan.mode === 'all'
      ? []
      : [`--base=${plan.base}`, `--head=${plan.head}`]),
  ];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const command = process.argv[2];
  if (command === 'select') {
    const revisions = comparison({
      eventName: process.env.GITHUB_EVENT_NAME,
      event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
      sha: process.env.GITHUB_SHA,
      git: (args) =>
        execFileSync('git', args, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
    });
    const plan = createPlan({ revisions });
    console.log(JSON.stringify(plan, null, 2));
    appendFileSync(process.env.GITHUB_OUTPUT, `plan=${JSON.stringify(plan)}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### CI admission\n\nMode: ${plan.mode} (${plan.reason})\n\n` +
          `Base: ${plan.base || 'unavailable'}; head: ${plan.head || 'unavailable'}\n\n` +
          Object.entries(plan.selected)
            .map(
              ([job, selected]) =>
                `- ${job}: ${selected ? 'required' : 'unaffected; skip'}`,
            )
            .join('\n') +
          '\n',
      );
    }
  } else if (command === 'check') {
    checkResults(JSON.parse(process.env.CI_NEEDS));
    console.log(
      'All selected CI jobs succeeded; unaffected jobs were skipped.',
    );
  } else if (command === 'workspace') {
    execFileSync('yarn', workspaceArgs(JSON.parse(process.env.CI_PLAN)), {
      stdio: 'inherit',
    });
  } else {
    throw new Error('Expected select, check or workspace');
  }
}
