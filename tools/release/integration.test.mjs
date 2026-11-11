import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  existsSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectArtifact, validateCandidate } from './workspace.mjs';
import { bumpTypes } from './policy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const moduleUrl = new URL('./workspace.mjs', import.meta.url).href;
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value));

test(
  'installed Nx dry runs preserve manifests, index, commits, tags and disable pre-version commands',
  { timeout: 120_000 },
  () => {
    const dir = realpathSync(
      mkdtempSync(join(tmpdir(), 'community-release-policy-')),
    );
    const git = (args) =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
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
    };
    try {
      mkdirSync(join(dir, 'packages/lib'), { recursive: true });
      symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
      writeFileSync(join(dir, '.gitignore'), 'node_modules\n.nx\n');
      writeJson(join(dir, 'package.json'), {
        name: 'policy-fixture',
        private: true,
        workspaces: ['packages/*'],
        devDependencies: { nx: '23.2.1', '@nx/js': '23.2.1' },
      });
      writeJson(join(dir, 'nx.json'), {
        release: {
          projects: ['lib'],
          projectsRelationship: 'independent',
          releaseTag: { pattern: '{projectName}@{version}' },
          version: {
            // Fixture shares installed modules; never resolve a second install.
            versionActionsOptions: { skipLockFileUpdate: true },
            conventionalCommits: true,
            adjustSemverBumpsForZeroMajorVersion: true,
            preVersionCommand:
              "node -e \"require('fs').writeFileSync('UNSAFE','ran')\"",
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
      writeJson(join(dir, 'packages/lib/package.json'), {
        name: '@example/lib',
        version: '0.0.1',
        nx: { name: 'lib' },
      });
      git(['init', '-q']);
      git(['config', 'user.name', 'Policy fixture']);
      git(['config', 'user.email', 'fixture@example.invalid']);
      commit('init(lib): baseline');
      git(['tag', 'lib@0.0.1']);
      const baseline = git(['rev-parse', 'HEAD']).trim();
      const preview = (expected, firstRelease = false, stabilize = false) => {
        const script = `import { nxPreview } from ${JSON.stringify(moduleUrl)}; const r=await nxPreview(['lib'],${firstRelease},${stabilize}); console.log('RESULT:'+JSON.stringify(r.projectsVersionData));`;
        const before = git(['show-ref']);
        const manifest = readFileSync(
          join(dir, 'packages/lib/package.json'),
          'utf8',
        );
        const output = execFileSync(
          process.execPath,
          ['--input-type=module', '-e', script],
          {
            cwd: dir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 25_000,
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
        const result = JSON.parse(output.split('RESULT:')[1]);
        assert.equal(result.lib?.newVersion ?? null, expected, output);
        assert.equal(
          readFileSync(join(dir, 'packages/lib/package.json'), 'utf8'),
          manifest,
        );
        assert.equal(git(['show-ref']), before);
        assert.equal(git(['status', '--porcelain']), '');
        assert.equal(existsSync(join(dir, 'UNSAFE')), false);
      };
      for (const [message, expected] of [
        ['init(lib): no bump', null],
        ['fix(lib): repair', '0.0.2'],
        ['feat(lib): feature', '0.0.2'],
        ['perf(lib): faster', '0.0.2'],
        ['revert(lib): undo', '0.0.2'],
        ['build(lib): tooling', null],
        ['fix(lib)!: remove API', '0.1.0'],
        ['fix(lib): remove API\n\nBREAKING CHANGE: removed method', '0.1.0'],
      ]) {
        // Fixture-only history; the release operation itself must make no writes.
        git(['reset', '--hard', baseline]);
        writeFileSync(join(dir, 'packages/lib/index.js'), message);
        commit(message);
        preview(expected);
      }
      git(['reset', '--hard', baseline]);
      writeJson(join(dir, 'packages/lib/package.json'), {
        name: '@example/lib',
        version: '1.2.3',
        nx: { name: 'lib' },
      });
      commit('chore: fixture stable baseline');
      git(['tag', 'lib@1.2.3']);
      const stable = git(['rev-parse', 'HEAD']).trim();
      for (const [message, expected] of [
        ['fix(lib): stable fix', '1.2.4'],
        ['feat(lib): stable feature', '1.3.0'],
        ['feat(lib)!: stable break', '2.0.0'],
      ]) {
        git(['reset', '--hard', stable]);
        writeFileSync(join(dir, 'packages/lib/index.js'), message);
        commit(message);
        preview(expected);
      }
      // Remove tags only inside this disposable fixture to exercise initial release.
      git(['reset', '--hard', baseline]);
      git(['tag', '-d', 'lib@0.0.1', 'lib@1.2.3']);
      writeJson(join(dir, 'packages/lib/package.json'), {
        name: '@example/lib',
        version: '0.0.0',
        nx: { name: 'lib' },
      });
      commit('init(lib): unreleased fixture');
      preview('0.0.1', true);
      // The preparation path may write version/changelog files, but must never
      // stage, commit, tag, push or execute the configured preVersionCommand.
      const headBefore = git(['rev-parse', 'HEAD']);
      const refsBefore = git(['show-ref']);
      const prepareModule = new URL('./prepare.mjs', import.meta.url).href;
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import { prepareNxVersions } from ${JSON.stringify(prepareModule)}; await prepareNxVersions(['lib'],true);`,
        ],
        {
          cwd: dir,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 30_000,
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
      assert.equal(
        JSON.parse(readFileSync(join(dir, 'packages/lib/package.json'), 'utf8'))
          .version,
        '0.0.1',
      );
      assert.ok(existsSync(join(dir, 'packages/lib/CHANGELOG.md')));
      assert.equal(git(['rev-parse', 'HEAD']), headBefore);
      assert.equal(git(['show-ref']), refsBefore);
      assert.equal(git(['diff', '--cached', '--name-only']), '');
      assert.equal(existsSync(join(dir, 'UNSAFE')), false);
      commit('init(lib): prepare first version');
      preview('0.0.1', true);
      git(['tag', 'lib@0.0.1']);
      preview('1.0.0', false, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

test('reads real artifacts and rechecks candidate history without extraction or hooks', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'community-release-artifacts-'));
  try {
    execFileSync('python3', [
      '-c',
      `import io,json,tarfile,zipfile,sys
from pathlib import Path
p=Path(sys.argv[1])
def tar(name,entry,data):
 with tarfile.open(p/name,'w:gz') as a:
  b=data.encode(); i=tarfile.TarInfo(entry); i.size=len(b); a.addfile(i,io.BytesIO(b))
tar('npm.tgz','package/package.json',json.dumps({'name':'@example/lib','version':'0.0.2','scripts':{'prepublishOnly':'exit 99'}}))
tar('sdist.tar.gz','example_lib-0.0.2/PKG-INFO','Name: example-lib\\nVersion: 0.0.2\\n')
with zipfile.ZipFile(p/'example_lib.whl','w') as a: a.writestr('example_lib-0.0.2.dist-info/METADATA','Name: example_lib\\nVersion: 0.0.2\\n')
tar('wrong.tgz','other/package.json','{}')
`,
      dir,
    ]);
    for (const [channel, name, file] of [
      ['npm', '@example/lib', 'npm.tgz'],
      ['pypi', 'example-lib', 'sdist.tar.gz'],
      ['pypi', 'example-lib', 'example_lib.whl'],
    ]) {
      const result = inspectArtifact(channel, join(dir, file));
      assert.equal(result.name, name);
      assert.equal(result.version, '0.0.2');
      assert.match(result.sha256, /^[a-f0-9]{64}$/);
    }
    assert.throws(() => inspectArtifact('npm', join(dir, 'wrong.tgz')));
    writeJson(join(dir, 'package.json'), {
      name: '@example/lib',
      version: '0.0.2',
    });
    const context = {
      root: dir,
      projects: ['lib'],
      graph: {
        nodes: {
          lib: {
            data: {
              root: '.',
              targets: {
                'nx-release-publish': { executor: '@nx/js:release-publish' },
              },
            },
          },
        },
      },
    };
    const candidate = {
      project: 'lib',
      version: '0.0.2',
      tag: 'lib@0.0.2',
      artifacts: ['npm.tgz'],
      nxVersion: { currentVersion: '0.0.1', newVersion: '0.0.2' },
      compatibility: {
        minimumBump: 'minor',
        evidence: 'Compatible feature on 0.x',
      },
    };
    let registryCalls = 0;
    const dependencies = {
      execute: (command) =>
        command === 'git' ? `${'a'.repeat(40)}\trefs/tags/lib@0.0.1\n` : '[[]]',
      fetcher: async () => {
        registryCalls++;
        return {
          status: 200,
          ok: true,
          json: async () => ({
            name: '@example/lib',
            versions: { '0.0.1': {} },
          }),
        };
      },
    };
    assert.equal(
      (await validateCandidate(context, candidate, dependencies)).version,
      '0.0.2',
    );
    writeJson(join(dir, 'package.json'), {
      name: '@example/lib',
      version: '0.0.3',
    });
    await assert.rejects(
      validateCandidate(context, candidate, dependencies),
      /Source manifest/,
    );
    assert.equal(
      registryCalls,
      2,
      'publication history must be fresh on every candidate check',
    );
    const dbt = join(dir, 'dbt');
    mkdirSync(dbt);
    writeFileSync(
      join(dbt, 'dbt_project.yml'),
      'name: example\nversion: 0.0.2\n',
    );
    const first = inspectArtifact('github', dbt);
    assert.equal(first.version, '0.0.2');
    writeFileSync(join(dbt, 'macro.sql'), 'select 1');
    assert.notEqual(inspectArtifact('github', dbt).sha256, first.sha256);
    symlinkSync(resolve(dbt, 'macro.sql'), join(dbt, 'link.sql'));
    assert.throws(() => inspectArtifact('github', dbt), /symlinks/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
