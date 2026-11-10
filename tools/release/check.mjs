import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import {
  parseCommit,
  requireCondition,
  touchedProjects,
  validateCommit,
} from './policy.mjs';
import { collectHistories } from './history.mjs';
import { identity, previewVersions, workspace } from './workspace.mjs';

export function commitRequest(eventName, event, git) {
  requireCondition(
    eventName === 'pull_request',
    'Commit admission currently validates the prospective squash message on pull requests',
  );
  const pr = event.pull_request;
  for (const sha of [pr?.base?.sha, pr?.head?.sha])
    requireCondition(
      /^[a-f0-9]{40}$/.test(sha),
      'Missing trustworthy PR revisions',
    );
  requireCondition(
    git(['rev-parse', '--is-shallow-repository']).trim() === 'false',
    'Commit admission requires full Git history',
  );
  const base = git(['merge-base', pr.base.sha, pr.head.sha]).trim();
  requireCondition(/^[a-f0-9]{40}$/.test(base), 'Cannot resolve PR comparison');
  return {
    message: `${pr.title}\n\n${pr.body ?? ''}`,
    files: git([
      'diff',
      '--no-renames',
      '--name-only',
      '-z',
      base,
      pr.head.sha,
      '--',
    ])
      .split('\0')
      .filter(Boolean),
  };
}

export async function checkCommit(context, request, dependencies) {
  const parsed = parseCommit(request.message, context.graph);
  const touched = touchedProjects(request.files, context.graph);
  for (const file of request.files) {
    requireCondition(
      !file.startsWith('packages/') ||
        touchedProjects([file], context.graph).length > 0,
      'Unmapped package changes require a reviewed project migration',
    );
  }
  const names = [...new Set([...parsed.scopes, ...touched])].filter((p) =>
    context.projects.includes(p),
  );
  const histories = await collectHistories(
    names.map((p) => identity(context, p)),
    dependencies,
  );
  return validateCommit({
    ...request,
    graph: context.graph,
    releaseProjects: context.projects,
    histories,
  });
}

export async function main(args = process.argv.slice(2)) {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      projects: { type: 'string' },
      'first-release': { type: 'boolean', default: false },
    },
  });
  requireCondition(
    positionals.length === 1,
    'Usage: check.mjs config|ci|history|preview [--projects=a,b] [--first-release]',
  );
  const context = await workspace();
  const command = positionals[0];
  if (command === 'config') return { projects: context.projects, valid: true };
  if (command === 'ci') {
    const event = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'),
    );
    const request = commitRequest(
      process.env.GITHUB_EVENT_NAME,
      event,
      (args) => execFileSync('git', args, { encoding: 'utf8' }),
    );
    return checkCommit(context, request);
  }
  const projects = values.projects?.split(',') ?? [];
  requireCondition(
    projects.length > 0 && new Set(projects).size === projects.length,
    'Select unique, explicit Nx release projects',
  );
  const identities = projects.map((p) => identity(context, p));
  if (command === 'history') return collectHistories(identities);
  if (command === 'preview')
    return previewVersions(context, projects, values['first-release']);
  throw new Error(`Unknown command: ${command}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
