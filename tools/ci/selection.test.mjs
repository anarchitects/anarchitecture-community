import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { format } from 'prettier';
import {
  checkResults,
  comparison,
  createPlan,
  jobProjects,
  jobNames,
  neutralArgs,
  selectJobs,
  workspaceArgs,
} from './selection.mjs';

const owners = [
  ...new Set([
    ...Object.values(jobProjects).flat(),
    '@anarchitecture-community/source',
  ]),
];
const base = '1'.repeat(40);
const head = '2'.repeat(40);
const affected = { mode: 'affected', base, head, reason: 'test' };
const planFor = (projects, mode = 'affected') => ({
  version: 1,
  ...affected,
  mode,
  projects,
  selected: selectJobs(projects, owners, mode),
});
function needsFor(plan) {
  return {
    selection: { result: 'success', outputs: { plan: JSON.stringify(plan) } },
    ...Object.fromEntries(
      jobNames.map((job) => [
        job,
        { result: plan.selected[job] ? 'success' : 'skipped' },
      ]),
    ),
  };
}

test('aggregate accepts only explicitly unaffected skips and complete successful required jobs', () => {
  for (const plan of [
    planFor([]),
    planFor(['editorjs-angular-e2e']),
    planFor(owners, 'all'),
  ]) {
    const needs = needsFor(plan);
    assert.doesNotThrow(() => checkResults(needs));
    for (const job of jobNames) {
      for (const result of [
        'failure',
        'cancelled',
        'skipped',
        'success',
        undefined,
      ]) {
        if (result === needs[job].result) continue;
        assert.throws(
          () => checkResults({ ...needs, [job]: { result } }),
          undefined,
          `${job}: ${result}`,
        );
      }
      const missing = structuredClone(needs);
      delete missing[job];
      assert.throws(() => checkResults(missing));
    }
    for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
      assert.throws(() => checkResults({ ...needs, selection: { result } }));
    }
    assert.throws(() =>
      checkResults({ ...needs, untracked: { result: 'success' } }),
    );
  }
});

test('invalid, incomplete and contradictory plans cannot produce a green aggregate', () => {
  const plan = planFor(owners);
  for (const mutation of [
    (p) => {
      delete p.selected.workspace;
    },
    (p) => {
      p.selected.workspace = 'true';
    },
    (p) => {
      p.selected.workspace = false;
    },
    (p) => {
      p.selected['editorjs-angular-packed'] = false;
    },
    (p) => {
      p.mode = 'unknown';
    },
    (p) => {
      p.version = 2;
    },
    (p) => {
      p.base = '--help';
    },
    (p) => {
      delete p.projects;
    },
  ]) {
    const broken = structuredClone(plan);
    mutation(broken);
    assert.throws(() => checkResults(needsFor(broken)));
  }
  for (const value of ['', '{}', 'null', 'not json']) {
    const needs = needsFor(plan);
    needs.selection.outputs.plan = value;
    assert.throws(() => checkResults(needs));
  }
});

test('query failures fall back to all; broken graphs and unknown owners fail closed', () => {
  let calls = 0;
  const plan = createPlan({
    revisions: affected,
    listProjects: () => {
      if (calls++ === 0) return owners;
      throw new Error('comparison failed');
    },
  });
  assert.equal(plan.mode, 'all');
  assert.ok(Object.values(plan.selected).every(Boolean));
  assert.throws(() =>
    createPlan({
      revisions: affected,
      listProjects: () => {
        throw new Error('broken graph');
      },
    }),
  );
  assert.throws(() =>
    createPlan({ revisions: affected, listProjects: () => [] }),
  );
  assert.throws(() => selectJobs(['unknown'], owners, 'affected'));
  assert.throws(() =>
    selectJobs(
      [],
      owners.filter((p) => p !== 'editorjs-html-angular'),
      'affected',
    ),
  );
});

test('workspace uses verified comparison arguments, or the complete baseline', () => {
  assert.deepEqual(workspaceArgs(planFor(owners)), [
    'nx',
    'affected',
    '-t',
    'lint',
    'test',
    'build',
    'typecheck',
    `--base=${base}`,
    `--head=${head}`,
  ]);
  assert.deepEqual(workspaceArgs(planFor(owners, 'all')), [
    'nx',
    'run-many',
    '-t',
    'lint',
    'test',
    'build',
    'typecheck',
  ]);
  assert.throws(() => workspaceArgs(planFor([])));
  assert.throws(() =>
    workspaceArgs(planFor(['@anarchitecture-community/source'])),
  );
  const upload = neutralArgs(planFor(['editorjs-upload-fetch']));
  assert.equal(upload[upload.indexOf('-p') + 1], 'editorjs-upload-fetch');
  assert.ok(!upload.includes('lint'), 'Lint has one coordinator owner');
  assert.throws(() => neutralArgs(planFor(['editorjs-angular-e2e'])));
});

test('real Git comparisons verify checkout, both PR parents, ancestry and available history', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ci-revisions-'));
  const git = (args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const commit = (message = 'fixture') =>
    git([
      '-c',
      'user.name=CI fixture',
      '-c',
      'user.email=ci@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--allow-empty',
      '-m',
      message,
    ]);
  try {
    git(['init', '-b', 'main']);
    commit();
    const base = git(['rev-parse', 'HEAD']).trim();
    commit();
    const head = git(['rev-parse', 'HEAD']).trim();
    const event = {
      pull_request: { base: { sha: base }, head: { sha: head } },
    };
    const input = { eventName: 'pull_request', event, sha: head, git };
    assert.equal(comparison(input).mode, 'affected');
    assert.equal(
      comparison({ ...input, sha: base }).reason,
      'checkout-head-mismatch',
    );
    assert.equal(
      comparison({
        ...input,
        git: (args) =>
          args.includes('--is-shallow-repository') ? 'true' : git(args),
      }).reason,
      'shallow-history',
    );
    for (const invalid of [
      undefined,
      '',
      '0'.repeat(40),
      '--help',
      'f'.repeat(40),
    ]) {
      assert.equal(
        comparison({
          ...input,
          event: {
            pull_request: { ...event.pull_request, base: { sha: invalid } },
          },
        }).mode,
        'all',
      );
      assert.equal(
        comparison({
          ...input,
          event: {
            pull_request: { ...event.pull_request, head: { sha: invalid } },
          },
        }).mode,
        'all',
      );
    }
    for (const [eventName, event] of [
      ['push', { before: base }],
      ['merge_group', { merge_group: { base_sha: base } }],
    ]) {
      assert.deepEqual(comparison({ ...input, eventName, event }), {
        mode: 'all',
        base,
        head,
        reason: 'full-integration-baseline',
      });
    }
    git(['checkout', '-b', 'topic', base]);
    commit('topic change');
    const topic = git(['rev-parse', 'HEAD']).trim();
    git(['checkout', 'main']);
    git([
      '-c',
      'user.name=CI fixture',
      '-c',
      'user.email=ci@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'merge',
      '--no-ff',
      'topic',
      '-m',
      'candidate',
    ]);
    const candidate = git(['rev-parse', 'HEAD']).trim();
    assert.deepEqual(
      comparison({
        ...input,
        sha: candidate,
        event: { pull_request: { base: { sha: head }, head: { sha: topic } } },
      }),
      {
        mode: 'affected',
        base: head,
        head: candidate,
        reason: 'verified-pr-comparison',
      },
    );
    mkdirSync(join(cwd, 'tools/ci'), { recursive: true });
    writeFileSync(
      join(cwd, 'tools/ci/selection.mjs'),
      '// changed orchestration',
    );
    git(['add', '.']);
    commit('orchestration');
    const orchestration = git(['rev-parse', 'HEAD']).trim();
    assert.equal(
      comparison({
        ...input,
        sha: orchestration,
        event: {
          pull_request: {
            base: { sha: candidate },
            head: { sha: orchestration },
          },
        },
      }).reason,
      'ci-orchestration-changed',
    );
    writeFileSync(
      join(cwd, 'tools/ci/graph.test.mjs'),
      '// selection regression',
    );
    git(['add', '.']);
    commit('test only');
    const testHead = git(['rev-parse', 'HEAD']).trim();
    assert.equal(
      comparison({
        ...input,
        sha: testHead,
        event: {
          pull_request: {
            base: { sha: orchestration },
            head: { sha: testHead },
          },
        },
      }).mode,
      'affected',
    );
    git(['checkout', '--orphan', 'unrelated']);
    commit();
    const unrelated = git(['rev-parse', 'HEAD']).trim();
    assert.equal(
      comparison({ ...input, sha: unrelated }).reason,
      'unavailable-or-unrelated-history',
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('workflow gates every workload before allocation and retains the required main check', async () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  // The installed YAML formatter also rejects malformed YAML without adding a parser dependency.
  await format(workflow, { parser: 'yaml' });
  const jobs = [
    ...workflow.matchAll(
      /^ {2}([a-z][a-z0-9-]*):\n(?= {4}(?:name|needs|if):)/gm,
    ),
  ];
  assert.deepEqual(
    jobs.map((match) => match[1]).sort(),
    ['selection', 'main', ...jobNames].sort(),
  );
  const section = (job) => {
    const index = jobs.findIndex((match) => match[1] === job);
    return workflow.slice(jobs[index].index, jobs[index + 1]?.index);
  };
  for (const job of jobNames) {
    const block = section(job);
    assert.match(block, /^ {4}needs: selection$/m);
    const access = job === 'workspace' ? '.workspace' : `['${job}']`;
    assert.ok(
      block.includes(
        `    if: \${{ fromJSON(needs.selection.outputs.plan).selected${access} }}`,
      ),
    );
  }
  const main = section('main');
  assert.match(main, /^ {4}if: \$\{\{ always\(\) \}\}$/m);
  assert.deepEqual(
    [...main.matchAll(/^ {6}- ([a-z][a-z0-9-]*)$/gm)]
      .map((match) => match[1])
      .sort(),
    ['selection', ...jobNames].sort(),
  );
  assert.ok(main.includes('CI_NEEDS: ${{ toJSON(needs) }}'));
  assert.ok(main.includes('node tools/ci/selection.mjs check'));
  assert.match(section('selection'), /fetch-depth: 0/);
  assert.match(section('selection'), /test-ci-selection/);
  assert.match(
    section('nest-angular-ssr-consumers'),
    /os: \[ubuntu-latest, macos-latest\]/,
  );
  for (const cell of ['angular21-nx22', 'angular21-nx23', 'angular22-nx23']) {
    assert.ok(section('nest-angular-ssr-compatibility').includes(`- ${cell}`));
  }
  assert.ok(
    section('workspace').includes('node tools/ci/selection.mjs workspace'),
  );
  assert.ok(
    section('editorjs-core-runtime-baseline').includes(
      'node tools/ci/selection.mjs neutral',
    ),
  );
});
