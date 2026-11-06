import assert from 'node:assert/strict';
import test from 'node:test';
import { jobProjects, selectJobs } from './selection.mjs';
import { runWorkspace, workspaceCommands } from './workspace.mjs';

const owners = [...new Set(Object.values(jobProjects).flat())];
const plan = (projects = owners) => ({
  version: 1,
  mode: 'affected',
  base: '1'.repeat(40),
  head: '2'.repeat(40),
  reason: 'test',
  projects,
  selected: selectJobs(projects, owners, 'affected'),
});

test('one coordinator owns equivalent Node 24 checks and preserves ordered SSR and collection', () => {
  const commands = workspaceCommands(plan(), 'renderer-targets');
  assert.equal(
    new Set(commands.map(({ args }) => JSON.stringify(args))).size,
    commands.length,
  );
  for (const target of [
    'editorjs-angular-e2e:install-browsers:ci',
    'editorjs-angular-e2e:e2e',
    'editorjs-upload-fetch:test-browser',
    'editorjs-angular-e2e:test-ssr',
    'editorjs-angular-e2e:e2e-hydration',
    'editorjs-angular-e2e:e2e-isolation',
    'editorjs-html-angular:packed-prepare',
    'editorjs-html-angular:packed-collect',
    'nest-angular-ssr:validate-split',
    'better-auth-typeorm-adapter:test-postgres',
    'better-auth-typeorm-adapter:test-better-auth',
  ])
    assert.equal(
      commands.filter(({ args }) => args.includes(target)).length,
      1,
      target,
    );
  const names = commands.map(({ name }) => name);
  for (const [before, after] of [
    ['Install Chromium', 'Workspace browser'],
    ['Workspace SSR', 'Workspace hydration'],
    ['Workspace hydration', 'Workspace isolation'],
    ['Fresh renderer consumers', 'Renderer proof atoms'],
    ['Renderer proof atoms', 'Require complete renderer evidence'],
  ])
    assert.ok(names.indexOf(before) < names.indexOf(after));
  assert.throws(() => workspaceCommands(plan()), /renderer targets/);
  const nestOnly = workspaceCommands(plan(['nest-angular-ssr']));
  assert.deepEqual(
    nestOnly.map(({ name }) => name),
    ['Workspace build, types, unit tests and lint', 'Nest split consumer'],
  );
});

test('every failed or interrupted workspace stage fails the job while retaining required collection', (t) => {
  t.mock.method(console, 'log', () => undefined);
  const commands = workspaceCommands(plan(), 'renderer-targets');
  for (let failure = 0; failure < commands.length; failure++) {
    for (const outcome of [
      { status: 1 },
      { status: null, signal: 'SIGTERM' },
      { status: 0, error: new Error('spawn failed') },
    ]) {
      let index = 0;
      let reported;
      const code = runWorkspace(plan(), {
        targets: () => 'renderer-targets',
        execute: () => (index++ === failure ? outcome : { status: 0 }),
        report: (results) => {
          reported = results;
        },
      });
      assert.equal(code, 1);
      assert.equal(index, commands.length);
      assert.equal(reported.filter(({ passed }) => !passed).length, 1);
      assert.ok(
        reported.some(
          ({ name }) => name === 'Require complete renderer evidence',
        ),
      );
    }
  }
  assert.equal(
    runWorkspace(plan(), {
      targets: () => 'renderer-targets',
      execute: () => ({ status: 0 }),
      report: () => undefined,
    }),
    0,
  );
});
