import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';
import { headlessBrowserIdentity } from './browser-identity.mjs';
import {
  files,
  matrix,
  paths,
  phases,
  read,
  sha,
  snapshot,
  sourceIdentity,
  target,
  verifyResult,
  workspace,
} from './artifacts.mjs';

const [phase, cell] = process.argv.slice(2);
const execution = (cell) => ({
  snapshot: snapshot(cell),
  coordinator: process.version,
  browser: headlessBrowserIdentity(),
  workspace,
  environment: Object.fromEntries(
    [
      'NODE_OPTIONS',
      'CI',
      'PLAYWRIGHT_BROWSERS_PATH',
      'NG_BUILD_MAX_WORKERS',
    ].map((name) => [name, process.env[name] ?? null]),
  ),
});
const json = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2));
if (phase === 'targets') {
  console.log(
    Object.keys(matrix)
      .flatMap((name) => phases(name).map((step) => target(name, step)))
      .join(','),
  );
} else if (phase === 'collect') {
  const complete = join(
    workspace,
    'dist/editorjs-renderer-results',
    paths(Object.keys(matrix)[0]).runId,
    'complete.json',
  );
  rmSync(complete, { force: true });
  const results = [];
  for (const name of Object.keys(matrix)) {
    const identity = sha(JSON.stringify(execution(name)));
    for (const step of phases(name))
      results.push(
        verifyResult(paths(name, step).output, identity, name, step),
      );
  }
  const report = join(
    workspace,
    'dist/editorjs-renderer-results',
    paths(Object.keys(matrix)[0]).runId,
    'complete.json',
  );
  json(report, {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workspace,
      encoding: 'utf8',
    }).trim(),
    sources: sourceIdentity(),
    results,
  });
  console.log(`Verified ${results.length} required renderer atoms: ${report}`);
} else if (phase === 'hash') {
  console.log(JSON.stringify(execution(cell)));
} else {
  const location = paths(cell, phase);
  if (phase !== 'prepare')
    assert.equal(
      process.argv[4],
      location.runId,
      'Nx --runId must match EDITORJS_RENDERER_RUN_ID',
    );
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'renderer-cell-')));
  const consumer = join(root, 'consumer');
  const tool = join(root, 'runtime');
  const report =
    phase === 'prepare' ? join(location.input, 'evidence') : location.output;
  const versions = matrix[cell];
  const script = join(
    workspace,
    'packages/editorjs',
    versions.angular ? 'html-angular' : 'html',
    'tools/packed-smoke.mjs',
  );
  let env = {
    ...process.env,
    NODE_OPTIONS: '',
    npm_config_cache: join(root, 'npm-cache'),
    NG_CLI_ANALYTICS: 'false',
  };
  const run = (command, args, cwd = root) => {
    try {
      return execFileSync(command, args, {
        cwd,
        env,
        encoding: 'utf8',
        timeout: 300_000,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (error) {
      writeFileSync(
        join(report, 'failure.log'),
        String(error.stdout ?? '') + String(error.stderr ?? ''),
      );
      throw error;
    }
  };
  try {
    if (phase === 'prepare') {
      assert(
        !existsSync(location.input),
        'Preparation is immutable: use a new run ID',
      );
      mkdirSync(report, { recursive: true });
      mkdirSync(consumer);
      mkdirSync(tool);
      const sources = sourceIdentity();
      json(join(tool, 'package.json'), {
        private: true,
        dependencies: { node: versions.node },
      });
      writeFileSync(
        join(report, 'runtime-install.log'),
        run('npm', ['install', '--no-audit', '--no-fund'], tool),
      );
      const node = join(tool, 'node_modules/node/bin/node');
      assert.equal(run(node, ['--version']).trim(), `v${versions.node}`);
      env = {
        ...env,
        PATH: `${dirname(node)}:${env.PATH}`,
        EDITORJS_RENDERER_CONSUMER: consumer,
        EDITORJS_RENDERER_REPORT: report,
        EDITORJS_RENDERER_PHASE: 'prepare',
        ...(versions.angular
          ? { EDITORJS_RENDERER_ANGULAR: versions.angular }
          : {}),
      };
      writeFileSync(join(report, 'prepare.log'), run(node, [script]));
      if (versions.angular) {
        const bundle = await build({
          stdin: {
            contents: `import '@angular/compiler'; import EditorJS from '@editorjs/editorjs'; import Paragraph from '@editorjs/paragraph'; import { EditorJs } from './packages/editorjs/angular/dist/fesm2022/anarchitects-editorjs-angular.mjs'; globalThis.__authoringControl = {editor: typeof EditorJS, tool: typeof Paragraph, angular: typeof EditorJs};`,
            resolveDir: workspace,
          },
          bundle: true,
          platform: 'browser',
          format: 'iife',
          write: false,
          metafile: true,
          minify: true,
          logLevel: 'silent',
        });
        writeFileSync(
          join(consumer, 'control.js'),
          bundle.outputFiles[0].contents,
        );
        json(join(consumer, 'control-meta.json'), bundle.metafile);
      }
      cpSync(
        join(consumer, 'package-lock.json'),
        join(report, 'package-lock.json'),
      );
      cpSync(
        join(tool, 'package-lock.json'),
        join(report, 'runtime-lock.json'),
      );
      run('tar', [
        '-czf',
        join(location.input, 'consumer.tar.gz'),
        'consumer',
        'runtime',
      ]);
      assert.equal(
        sourceIdentity(),
        sources,
        'Sources changed during preparation',
      );
      json(join(location.input, 'snapshot.json'), {
        version: 1,
        cell,
        runId: location.runId,
        versions,
        sources,
        platform: `${process.platform}/${process.arch}/${process.report.getReport().header.glibcVersionRuntime ?? ''}`,
        archive: sha(readFileSync(join(location.input, 'consumer.tar.gz'))),
        lock: sha(readFileSync(join(consumer, 'package-lock.json'))),
        runtimeLock: sha(readFileSync(join(tool, 'package-lock.json'))),
      });
    } else {
      const context = execution(cell);
      const prepared = context.snapshot;
      const identity = sha(JSON.stringify(context));
      rmSync(report, { recursive: true, force: true });
      mkdirSync(report, { recursive: true });
      run('tar', ['-xzf', join(location.input, 'consumer.tar.gz')]);
      const node = join(tool, 'node_modules/node/bin/node');
      assert.equal(run(node, ['--version']).trim(), `v${versions.node}`);
      env = {
        ...env,
        PATH: `${dirname(node)}:${env.PATH}`,
        EDITORJS_RENDERER_CONSUMER: consumer,
        EDITORJS_RENDERER_REPORT: report,
        EDITORJS_RENDERER_PHASE: phase,
        ...(versions.angular
          ? { EDITORJS_RENDERER_ANGULAR: versions.angular }
          : {}),
      };
      if (versions.angular && phase !== 'build') {
        const built = paths(cell, 'build').output;
        verifyResult(built, identity, cell, 'build');
        cpSync(join(built, 'dist'), join(consumer, 'dist'), {
          recursive: true,
        });
      }
      writeFileSync(
        join(report, 'run.log'),
        run(node, [script, ...(versions.angular ? [] : ['--browser'])]),
      );
      if (phase === 'build')
        cpSync(join(consumer, 'dist'), join(report, 'dist'), {
          recursive: true,
        });
      else
        assert.equal(
          read(join(report, 'summary.json')).node,
          `v${versions.node}`,
        );
      assert.equal(
        sourceIdentity(),
        prepared.sources,
        'Sources changed during proof',
      );
      json(join(report, 'result.json'), {
        status: 'passed',
        identity,
        cell,
        phase,
        files: files(report),
      });
    }
    console.log(`${cell}/${phase}: passed`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
