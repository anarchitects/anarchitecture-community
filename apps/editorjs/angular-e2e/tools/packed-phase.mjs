import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildPortable } from './portable-consumer.mjs';
import { commandRunner } from './packed-process.mjs';
import { buildPackedSsr, ssrProfiles } from './packed-ssr.mjs';
import { validateReadmeSsr } from './readme-ssr.mjs';
import { packedPhases, phasesFor } from './packed-phases.mjs';
import {
  pathsFor,
  readSnapshot,
  sha256,
  sourceFingerprint,
  artifactManifest,
  verifyArtifacts,
} from './packed-artifacts.mjs';
import { leasePorts } from './packed-ports.mjs';
import { validateNestUpload } from './nest-upload.mjs';
import { validateNeutralPersistence } from './neutral-persistence.mjs';

const [mode, cell, phase, runId] = process.argv.slice(2);
assert.equal(
  runId,
  process.env.EDITORJS_PACKED_RUN_ID,
  'The task argument and hashed run ID must agree',
);
assert(phasesFor(mode, cell).includes(phase), `Invalid packed phase: ${phase}`);
const workspace = resolve(import.meta.dirname, '../../../..');
const project = resolve(import.meta.dirname, '..');
const { input, output: report } = pathsFor(workspace, runId, mode, cell, phase);
const snapshot = await readSnapshot(input, runId, mode, cell);
await mkdir(join(report, '..'), { recursive: true });
const lock = `${report}.lock`;
await mkdir(lock); // Prevent concurrent writers for the same run and atom.
let root;
let portableRoot;
let nestRoot;
let neutralRoot;
let lease;
let runner;
const started = Date.now();
let status = 'failed';
let failure;
let buildSha;
try {
  await rm(report, { recursive: true, force: true });
  await mkdir(report);
  runner = commandRunner({
    report,
    cache: join(report, 'npm-cache'),
    ownerPid: process.ppid,
  });
  assert.equal(
    snapshot.sources,
    await sourceFingerprint(workspace),
    'Prepare a new snapshot after package or fixture changes',
  );
  const { run } = runner;
  const dependencies = packedPhases[phase];
  for (const dependency of dependencies) {
    const { output } = pathsFor(workspace, runId, mode, cell, dependency);
    const result = JSON.parse(
      await readFile(join(output, 'result.json'), 'utf8'),
    );
    assert.equal(result.status, 'passed', `Prerequisite failed: ${dependency}`);
    assert.equal(
      result.snapshot,
      snapshot.sha256,
      `Wrong consumer snapshot: ${dependency}`,
    );
    assert.equal(result.runId, runId);
    assert.equal(result.mode, mode);
    assert.equal(result.cell, cell);
    assert.equal(result.phase, dependency);
    await verifyArtifacts(output, result.artifacts);
  }
  {
    root = await realpath(
      await mkdtemp(join(tmpdir(), 'editorjs-packed-atom-')),
    );
    await run(
      'tar',
      ['-xzf', join(input, 'consumer.tar.gz'), '-C', root],
      workspace,
    );
    for (const dependency of dependencies) {
      const { output } = pathsFor(workspace, runId, mode, cell, dependency);
      const result = JSON.parse(
        await readFile(join(output, 'result.json'), 'utf8'),
      );
      assert.equal(
        await sha256(join(output, 'build.tar.gz')),
        result.buildSha,
        'Build artifact was modified',
      );
      await run(
        'tar',
        ['-xzf', join(output, 'build.tar.gz'), '-C', root],
        workspace,
      );
    }
    const node = join(root, 'node_modules/node/bin/node');
    assert.equal(
      (await run(node, ['--version'], root, true)).trim(),
      `v${snapshot.versions.node}`,
    );
    // No resolution from workspace ancestors: the restored consumer remains external.
    for (const name of [
      '@anarchitects/editorjs-core',
      '@anarchitects/editorjs-angular',
      '@angular/core',
      '@angular/forms',
    ])
      assert(
        (await realpath(join(root, 'node_modules', name))).startsWith(
          `${root}/`,
        ),
      );
    const ssrRoot = join(root, 'ssr');
    const browser =
      phase === 'portable' ||
      phase.startsWith('csr-') ||
      phase.startsWith('hydration-') ||
      phase === 'isolation' ||
      phase.startsWith('readme-');
    if (browser) {
      lease = await leasePorts(8);
      await lease.handoff();
    }
    const ports = lease?.ports ?? [];
    const ssrEnv = {
      EDITORJS_SSR_ROOT: ssrRoot,
      EDITORJS_SSR_NODE: node,
      EDITORJS_SSR_REPORT: report,
      EDITORJS_SSR_PORTS: JSON.stringify(ports.slice(1, 6)),
    };
    const playwright = (config, env, file) =>
      run(
        process.execPath,
        [
          join(workspace, 'node_modules/@playwright/test/cli.js'),
          'test',
          '--config',
          join(project, config),
          ...(file ? [file] : []),
        ],
        project,
        false,
        env,
      );
    let buildPath;
    if (phase.startsWith('nest-upload-')) {
      nestRoot = await realpath(
        await mkdtemp(join(tmpdir(), 'editorjs-nest-upload-atom-')),
      );
      await run(
        'tar',
        ['-xzf', join(root, 'nest-upload.tar.gz'), '-C', nestRoot],
        workspace,
      );
      await validateNestUpload({
        root: nestRoot,
        node,
        platform: phase.slice('nest-upload-'.length),
        report,
        run,
        workspace,
      });
    } else if (phase === 'portable') {
      neutralRoot = await realpath(
        await mkdtemp(join(tmpdir(), 'editorjs-neutral-persistence-')),
      );
      await run(
        'tar',
        ['-xzf', join(root, 'neutral-persistence.tar.gz'), '-C', neutralRoot],
        workspace,
      );
      await validateNeutralPersistence({
        root: neutralRoot,
        node,
        report,
        run,
      });
      portableRoot = await realpath(
        await mkdtemp(join(tmpdir(), 'editorjs-portable-atom-')),
      );
      await run(
        'tar',
        ['-xzf', join(root, 'portable.tar.gz'), '-C', portableRoot],
        workspace,
      );
      await buildPortable({ root: portableRoot, node, report, run });
      await playwright('playwright.portable.config.mts', {
        EDITORJS_PACKED_ROOT: portableRoot,
        EDITORJS_PACKED_NODE: node,
        EDITORJS_PACKED_REPORT: report,
        EDITORJS_PACKED_PORT: String(ports[0]),
      });
    } else if (phase === 'interop') {
      await run(node, ['node_modules/vitest/vitest.mjs', 'run'], root, false, {
        EDITORJS_INTEROP_PACKED: 'true',
      });
    } else if (phase === 'build-csr') {
      await run(node, ['node_modules/@angular/cli/bin/ng.js', 'build'], root);
      buildPath = 'dist';
    } else if (phase.startsWith('csr-')) {
      await playwright(
        'packed.config.mts',
        {
          EDITORJS_PACKED_ROOT: root,
          EDITORJS_PACKED_NODE: node,
          EDITORJS_PACKED_REPORT: report,
          EDITORJS_PACKED_PORT: String(ports[0]),
        },
        `src/${phase.slice(4)}.spec.ts`,
      );
    } else if (phase.startsWith('build-ssr-')) {
      const profile = phase.slice('build-ssr-'.length);
      await buildPackedSsr({ root: ssrRoot, report, node, run, profile });
      buildPath = `ssr/dist/apps/editorjs/angular-host-ssr${ssrProfiles[profile]}`;
    } else if (phase === 'ssr') {
      await run(
        node,
        [join(project, 'tools/validate-ssr.mjs')],
        ssrRoot,
        false,
        ssrEnv,
      );
    } else if (phase.startsWith('hydration-')) {
      await playwright(
        'playwright.hydration.config.mts',
        ssrEnv,
        `hydration/${phase.slice('hydration-'.length)}.spec.ts`,
      );
    } else if (phase === 'isolation') {
      await playwright('playwright.isolation.config.mts', ssrEnv);
    } else {
      const profile = phase.slice('readme-'.length);
      await validateReadmeSsr({
        root: join(root, phase),
        report,
        node,
        workspace,
        project,
        run,
        profile,
        port: ports[profile === 'default' ? 6 : 7],
      });
    }
    if (buildPath) {
      await run(
        'tar',
        ['-czf', join(report, 'build.tar.gz'), '-C', root, buildPath],
        root,
      );
      buildSha = await sha256(join(report, 'build.tar.gz'));
    }
  }
  status = failure ? 'failed' : 'passed';
} catch (error) {
  failure = String(error);
  // NX_CACHE_FAILURES retains diagnostics without disguising failed checks as
  // successful Nx tasks. The coordinator also rejects missing/skipped evidence.
  console.error(`Packed validation failed (${phase}): ${failure}`);
} finally {
  await lease?.release();
  if (portableRoot) await rm(portableRoot, { recursive: true, force: true });
  if (nestRoot) await rm(nestRoot, { recursive: true, force: true });
  if (neutralRoot) await rm(neutralRoot, { recursive: true, force: true });
  if (root) await rm(root, { recursive: true, force: true });
  let artifacts;
  try {
    artifacts = await artifactManifest(report);
  } catch (error) {
    status = 'failed';
    failure = `Artifact recording failed: ${error}`;
  }
  await writeFile(
    join(report, 'result.json'),
    JSON.stringify(
      {
        phase,
        mode,
        cell,
        runId,
        status,
        error: failure,
        snapshot: snapshot.sha256,
        buildSha,
        artifacts,
        started,
        durationMs: Date.now() - started,
        consumerRemoved: true,
        interrupted: runner?.interrupted ?? false,
      },
      null,
      2,
    ) + '\n',
  );
  runner?.dispose();
  await rm(lock, { recursive: true, force: true });
}
process.exitCode = status === 'passed' ? 0 : 1;
