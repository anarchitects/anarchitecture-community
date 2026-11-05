import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
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
