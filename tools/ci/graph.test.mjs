import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { selectJobs } from './selection.mjs';

const query = (args) =>
  JSON.parse(
    execFileSync('yarn', ['nx', 'show', 'projects', '--json', ...args], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NX_DAEMON: 'false', NX_NO_CLOUD: 'true' },
    }),
  );

test('installed Nx graph admits actual fixture, source, dependency and shared configuration changes', () => {
  const allProjects = query([]);
  const scenarios = [
    [
      'packages/editorjs/angular/src/index.ts',
      false,
      ['editorjs-angular-browser', 'editorjs-angular-packed'],
    ],
    [
      'packages/editorjs/html/src/index.ts',
      false,
      ['editorjs-core-runtime-baseline', 'editorjs-angular-ssr'],
    ],
    [
      'packages/editorjs/core/src/index.ts',
      false,
      [
        'editorjs-core-runtime-baseline',
        'editorjs-angular-browser',
        'editorjs-angular-ssr',
        'editorjs-angular-packed',
      ],
    ],
    [
      'packages/editorjs/tool-image/src/index.ts',
      false,
      [
        'editorjs-angular-browser',
        'editorjs-angular-ssr',
        'editorjs-angular-packed',
      ],
    ],
    [
      'packages/editorjs/html-angular/src/index.ts',
      false,
      ['editorjs-angular-ssr', 'editorjs-angular-packed'],
    ],
    [
      'packages/editorjs/html-angular/tools/packed/browser-identity.mjs',
      false,
      [
        'editorjs-angular-browser',
        'editorjs-angular-ssr',
        'editorjs-angular-packed',
      ],
    ],
    ['packages/nest/angular-ssr/src/index.ts', true, []],
    ['apps/fixtures/nest-cjs-consumer/src/main.ts', true, []],
    ['apps/fixtures/nest-esm-consumer/src/main.ts', true, []],
    ['apps/fixtures/nest-angular-split/frontend/src/main.ts', true, []],
    ['apps/fixtures/nest-angular-split/backend/src/main.ts', true, []],
    ['apps/fixtures/nest-angular-split/tsconfig.base.json', true, []],
    ['tools/fixtures/nest-angular-ssr-security-conformance.mjs', true, []],
    ['tools/fixtures/nest-angular-ssr-compatibility-matrix.json', true, []],
    ['packages/nest/angular-ssr/package.json', true, []],
    ['yarn.lock', true, 'all'],
    ['package.json', true, 'all'],
    ['nx.json', true, 'all'],
    ['tsconfig.base.json', true, 'all'],
    ['.yarnrc.yml', true, 'all'],
    ['jest.preset.js', true, 'all'],
    ['vitest.config.ts', true, 'all'],
    ['.gitignore', true, 'all'],
    ['.github/workflows/ci.yml', true, 'all'],
    ['.nx/workflows/editorjs-packed.yaml', true, 'all'],
    ['tools/ci/selection.mjs', true, 'all'],
    // Nx conservatively affects all projects when a project definition is deleted.
    ['packages/deleted/project.json', true, 'all'],
  ];
  for (const [file, nest, required] of scenarios) {
    const projects = query(['--affected', `--files=${file}`]);
    const selected = selectJobs(projects, allProjects, 'affected');
    assert.equal(selected['nest-angular-ssr-consumers'], nest, file);
    assert.equal(selected['nest-angular-ssr-compatibility'], nest, file);
    if (required === 'all') {
      assert.ok(Object.values(selected).every(Boolean), file);
      assert.deepEqual([...projects].sort(), [...allProjects].sort(), file);
    } else
      for (const job of required)
        assert.equal(selected[job], true, `${file}: ${job}`);
    console.log(JSON.stringify({ file, projects, selected }));
  }
});

test('complete-family CI retains all proof atoms, cacheable prerequisites and uncached gates', () => {
  const graph = JSON.parse(
    execFileSync('yarn', ['nx', 'graph', '--print'], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, NX_DAEMON: 'false', NX_NO_CLOUD: 'true' },
    }),
  ).graph;
  const authoring = graph.nodes['editorjs-angular-e2e'].data.targets;
  const renderer = graph.nodes['editorjs-html-angular'].data.targets;
  const emit = (file, args = []) =>
    execFileSync(process.execPath, [file, ...args], { encoding: 'utf8' })
      .trim()
      .split(',');
  const families = [
    [authoring, emit('apps/editorjs/angular-e2e/tools/packed-targets.mjs'), 89],
    [
      renderer,
      emit('packages/editorjs/html-angular/tools/packed/run.mjs', ['targets']),
      16,
    ],
  ];
  for (const [targets, requested, count] of families) {
    assert.equal(requested.length, count);
    assert.equal(new Set(requested).size, count);
    const outputs = new Set();
    for (const name of requested) {
      const target = targets[name];
      assert.equal(target.cache, true, name);
      assert.ok(target.outputs.length > 0, name);
      for (const output of target.outputs) {
        assert.ok(!outputs.has(output), `Overlapping evidence: ${name}`);
        outputs.add(output);
      }
      for (const dependency of target.dependsOn ?? []) {
        assert.ok(
          requested.includes(dependency.target),
          `Prerequisite omitted: ${name}`,
        );
        assert.equal(targets[dependency.target].cache, true);
        assert.equal(dependency.params, 'forward');
      }
    }
    for (const [name, target] of Object.entries(targets)) {
      if (name.endsWith('prepare') || name === 'packed-collect')
        assert.equal(target.cache, false, name);
    }
  }
  for (const name of ['e2e', 'test-ssr', 'e2e-hydration', 'e2e-isolation']) {
    assert.equal(
      authoring[name].parallelism,
      false,
      `Shared workspace resources: ${name}`,
    );
  }
  assert.ok(authoring.e2e.inputs.includes('editorjsBrowser'));
  assert.ok(
    graph.nodes['editorjs-upload-fetch'].data.targets[
      'test-browser'
    ].inputs.includes('editorjsBrowser'),
  );
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.ok(
    workflow.includes(
      'node apps/editorjs/angular-e2e/tools/packed-targets.mjs',
    ),
  );
  assert.ok(
    workflow.includes(
      'node packages/editorjs/html-angular/tools/packed/run.mjs targets',
    ),
  );
  assert.ok(
    workflow.includes(
      'node apps/editorjs/angular-e2e/tools/packed-results.mjs',
    ),
  );
  assert.ok(
    workflow.includes('yarn nx run editorjs-html-angular:packed-collect'),
  );
  const packed = workflow.slice(
    workflow.indexOf('  editorjs-angular-packed:'),
    workflow.indexOf('  workspace:'),
  );
  assert.ok(packed.includes(':install-browsers:ci'));
  assert.ok(packed.includes(':test-packed-harness'));
  assert.ok(
    packed.indexOf(':install-browsers:ci') <
      packed.indexOf(':test-packed-harness'),
  );
  assert.ok(packed.includes('always() && steps.workers.outcome'));
  assert.ok(packed.includes('yarn nx-cloud complete-ci-run'));
});
