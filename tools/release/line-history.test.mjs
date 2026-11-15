import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  realpathSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bumpTypes } from './policy.mjs';

test(
  'installed Nx uses reachable maintenance tags and a published maintenance-first feature baseline on divergent histories',
  { timeout: 120_000 },
  () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const workspaceModule = new URL('./workspace.mjs', import.meta.url).href;
    const prepareModule = new URL('./prepare.mjs', import.meta.url).href;
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'ssr-line-history-')));
    const git = (args) =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
    const write = (file, data) =>
      writeFileSync(join(dir, file), JSON.stringify(data));
    const commit = (message) => {
      git(['add', '.']);
      git([
        '-c',
        'commit.gpgsign=false',
        '-c',
        'core.hooksPath=/dev/null',
        'commit',
        '-qm',
        message,
      ]);
      return git(['rev-parse', 'HEAD']);
    };
    const preview = (line, current, next, prepare = false) => {
      const before = git(['show-ref']);
      const script = prepare
        ? `import {prepareNxVersions} from ${JSON.stringify(prepareModule)}; const r=await prepareNxVersions(['lib'],false,false,${JSON.stringify(line)}); console.log('RESULT:'+JSON.stringify(r.projectsVersionData));`
        : `import {nxPreview} from ${JSON.stringify(workspaceModule)}; const r=await nxPreview(['lib'],false,false,${JSON.stringify(line)}); console.log('RESULT:'+JSON.stringify(r.projectsVersionData));`;
      const output = execFileSync(
        process.execPath,
        ['--input-type=module', '-e', script],
        {
          cwd: dir,
          encoding: 'utf8',
          timeout: 30_000,
          maxBuffer: 4 * 1024 * 1024,
          env: {
            ...process.env,
            NODE_OPTIONS: '',
            VSCODE_INSPECTOR_OPTIONS: '',
            NX_WORKSPACE_ROOT_PATH: dir,
            NX_DAEMON: 'false',
            NX_ISOLATE_PLUGINS: 'false',
            NX_NO_CLOUD: 'true',
            NX_INTERACTIVE: 'false',
            CI: 'true',
          },
        },
      );
      const result = JSON.parse(output.split('RESULT:')[1]).lib;
      assert.equal(result.currentVersion, current, output);
      assert.equal(result.newVersion, next, output);
      assert.equal(git(['show-ref']), before, 'no refs/tags/commits changed');
      assert.equal(
        git(['diff', '--cached', '--name-only']),
        '',
        'index unchanged',
      );
      return result;
    };
    try {
      mkdirSync(join(dir, 'packages/lib'), { recursive: true });
      symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
      writeFileSync(join(dir, '.gitignore'), 'node_modules\n.nx\n');
      write('package.json', {
        name: 'line-fixture',
        private: true,
        workspaces: ['packages/*'],
        devDependencies: { nx: '23.2.1', '@nx/js': '23.2.1' },
      });
      write('packages/lib/package.json', {
        name: '@example/lib',
        version: '0.3.2',
        nx: { name: 'lib' },
      });
      write('nx.json', {
        release: {
          projects: ['lib'],
          projectsRelationship: 'independent',
          releaseTag: { pattern: '{projectName}@{version}' },
          version: {
            conventionalCommits: true,
            adjustSemverBumpsForZeroMajorVersion: true,
            versionActionsOptions: { skipLockFileUpdate: true },
          },
          conventionalCommits: {
            types: Object.fromEntries(
              Object.entries(bumpTypes).map(([name, semverBump]) => [
                name,
                { semverBump },
              ]),
            ),
          },
        },
      });
      git(['init', '-q', '-b', 'main']);
      git(['config', 'user.name', 'Line fixture']);
      git(['config', 'user.email', 'fixture@example.invalid']);
      const base = commit('chore: published fixture baseline');
      git(['tag', 'lib@0.3.2']);
      git(['checkout', '-qb', 'feature']);
      writeFileSync(join(dir, 'packages/lib/index.js'), 'feature');
      commit('feat(lib)!: new framework');
      git(['tag', 'lib@0.4.0']);
      git(['checkout', '-qb', 'maintenance', base]);
      writeFileSync(join(dir, 'packages/lib/index.js'), 'compatible fix');
      commit('fix(lib): compatible repair');
      preview('nest11', '0.3.2', '0.3.3');
      // The global tag remains visible; selecting it would produce the wrong baseline.
      preview('nest12', '0.4.0', '0.4.1');
      assert.equal(git(['status', '--porcelain']), '');
      // This is disposable fixture history, never a real tag rewrite.
      git(['tag', '-d', 'lib@0.4.0']);
      writeFileSync(
        join(dir, 'packages/lib/index.js'),
        'patched adapter floor',
      );
      commit('fix(lib)!: tighten adapter minimum');
      preview('nest11', '0.3.2', '0.4.0', true);
      assert.equal(
        JSON.parse(readFileSync(join(dir, 'packages/lib/package.json')))
          .version,
        '0.4.0',
      );
      commit('chore(lib): integrate maintenance version');
      git(['tag', 'lib@0.4.0']);
      git(['checkout', 'feature']);
      preview('nest12', '0.4.0', '0.5.0');
      assert.equal(git(['status', '--porcelain']), '');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
