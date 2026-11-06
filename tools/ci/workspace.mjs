import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validatePlan, workspaceArgs } from './selection.mjs';

/** Existing ordered integration checks share one coordinator and its local cache. */
export function workspaceCommands(plan, rendererTargets) {
  validatePlan(plan);
  const selected = plan.selected;
  const commands = [];
  const add = (name, args) => commands.push({ name, args });
  const run = (name, target) => add(name, ['nx', 'run', target]);
  if (selected['editorjs-angular-browser'] || selected['editorjs-angular-ssr'])
    run('Install Chromium', 'editorjs-angular-e2e:install-browsers:ci');
  add('Workspace build, types, unit tests and lint', workspaceArgs(plan));
  if (selected['editorjs-angular-browser']) {
    run('Workspace browser', 'editorjs-angular-e2e:e2e');
    run('Upload browser', 'editorjs-upload-fetch:test-browser');
  }
  if (selected['editorjs-angular-ssr']) {
    // Shared SSR build directories require these build/test pairs to stay ordered.
    run('Workspace SSR', 'editorjs-angular-e2e:test-ssr');
    run('Workspace hydration', 'editorjs-angular-e2e:e2e-hydration');
    run('Workspace isolation', 'editorjs-angular-e2e:e2e-isolation');
    run('Fresh renderer consumers', 'editorjs-html-angular:packed-prepare');
    if (!rendererTargets) throw new Error('Missing required renderer targets');
    add('Renderer proof atoms', [
      'nx',
      'run-many',
      '-p',
      'editorjs-html-angular',
      '-t',
      rendererTargets,
      `--runId=${process.env.EDITORJS_RENDERER_RUN_ID}`,
      '--parallel=2',
    ]);
    run(
      'Require complete renderer evidence',
      'editorjs-html-angular:packed-collect',
    );
  }
  if (selected['nest-angular-ssr-consumers'])
    run('Nest split consumer', 'nest-angular-ssr:validate-split');
  if (selected['better-auth-typeorm-adapter-compatibility']) {
    // Locked Node 24 baseline; compatibility jobs separately resolve their versions.
    run(
      'Locked PostgreSQL integration',
      'better-auth-typeorm-adapter:test-postgres',
    );
    run(
      'Locked Better Auth integration',
      'better-auth-typeorm-adapter:test-better-auth',
    );
  }
  return commands;
}

export function runWorkspace(
  plan,
  {
    targets = () =>
      execFileSync(
        process.execPath,
        ['packages/editorjs/html-angular/tools/packed/run.mjs', 'targets'],
        { encoding: 'utf8' },
      ).trim(),
    execute = (args) => spawnSync('yarn', args, { stdio: 'inherit' }),
    report = (results) => {
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          '\n### Workspace checks\n\n' +
            results
              .map(
                ({ name, passed }) =>
                  `- ${name}: ${passed ? 'passed' : 'failed'}`,
              )
              .join('\n') +
            '\n',
        );
    },
  } = {},
) {
  validatePlan(plan);
  const commands = workspaceCommands(
    plan,
    plan.selected['editorjs-angular-ssr'] ? targets() : undefined,
  );
  const results = [];
  for (const { name, args } of commands) {
    console.log(`::group::${name}`);
    let passed = false;
    try {
      const result = execute(args);
      passed = result.status === 0 && !result.error && !result.signal;
    } catch (error) {
      console.error(error);
    }
    console.log('::endgroup::');
    results.push({ name, passed });
  }
  // Independent checks and required collection still run after a failure, but
  // a later success cannot mask any failed, interrupted or missing command.
  report(results);
  return results.every(({ passed }) => passed) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = runWorkspace(JSON.parse(process.env.CI_PLAN));
