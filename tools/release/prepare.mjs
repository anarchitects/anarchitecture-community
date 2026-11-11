import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  existsSync,
} from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  workspace,
  identity,
  previewVersions,
  validateCandidate,
} from './workspace.mjs';
import {
  assert,
  canonical,
  sha256,
  REPOSITORY,
  OWNER,
  SHA,
} from './execution.mjs';
import { controllerDigest, registry } from './controller.mjs';
import { exactCI, mainCommit } from './github.mjs';
import { checkCommit } from './check.mjs';
import { verifyConsumers } from './consumer.mjs';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const command = (args, options = {}) =>
  execFileSync('yarn', args, { stdio: 'inherit', ...options });
const noGit = {
  gitCommit: false,
  gitTag: false,
  gitPush: false,
  stageChanges: false,
};
const auditScript = fileURLToPath(new URL('./audit.py', import.meta.url));

export function selectedProjects(context, text) {
  const projects = text?.split(',') ?? [];
  assert(
    projects.length &&
      new Set(projects).size === projects.length &&
      projects.every((p) => context.projects.includes(p)),
    'Use unique exact release project names',
  );
  return projects;
}
export function publishClosure(context, project) {
  const seen = new Set();
  const visit = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const deps =
      context.graph.nodes[name].data.targets['nx-release-publish']?.dependsOn ??
      [];
    for (const d of deps) {
      if (d === '^nx-release-publish') {
        for (const edge of context.graph.dependencies[name] ?? [])
          if (context.projects.includes(edge.target)) visit(edge.target);
      } else if (typeof d === 'object' && d.target === 'nx-release-publish') {
        assert(
          Array.isArray(d.projects) &&
            d.projects.every((p) => context.projects.includes(p)),
          'Review custom publication dependency',
        );
        d.projects.forEach(visit);
      }
    }
    if (name === 'governance-host-dbt') visit('governance-runtime-dbt');
  };
  visit(project);
  return [...seen].filter((p) => p !== project).sort();
}
export function readinessTargets(projects) {
  const targets = [];
  if (projects.includes('nest-angular-ssr'))
    targets.push(
      '@anarchitecture-community/source:validate-nest-angular-ssr-release-gate',
    );
  if (projects.some((p) => p.startsWith('governance-')))
    targets.push(
      '@anarchitecture-community/source:validate-governance-release-gate',
    );
  if (projects.includes('governance-dbt-package'))
    targets.push(
      'governance-dbt-package:validate',
      'governance-dbt-package:pack',
    );
  if (projects.includes('better-auth-typeorm-adapter'))
    targets.push(
      'better-auth-typeorm-adapter:test-postgres',
      'better-auth-typeorm-adapter:test-better-auth',
    );
  // Integrated main CI already requires all Editor.js cells, security suites and
  // uncached completeness gates. Here package checks precede the final pack.
  return targets;
}
function credentialFree() {
  for (const name of [
    'RELEASE_TOKEN',
    'NODE_AUTH_TOKEN',
    'NPM_TOKEN',
    'UV_PUBLISH_TOKEN',
    'TWINE_PASSWORD',
    'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
  ])
    assert(!process.env[name], `Preparation must not receive ${name}`);
  assert(
    process.env.NX_NO_CLOUD === 'true',
    'Preparation must explicitly disable Cloud execution; gate evidence comes from the authorized CI run',
  );
}

/** Local version/changelog preparation only. The maintainer signs and submits its diff normally. */
export async function version({
  projects: selection,
  compatibility: compatibilityPath,
  firstRelease = false,
  stabilize = false,
}) {
  credentialFree();
  assert(
    git(['status', '--porcelain']) === '',
    'Start version preparation in a clean checkout',
  );
  const context = await workspace();
  const projects = selectedProjects(context, selection);
  const baseline = git(['rev-parse', 'HEAD']);
  const compatibility = read(compatibilityPath);
  if (stabilize)
    assert(
      projects.length === 1 &&
        compatibility[projects[0]]?.stableTransition?.version === '1.0.0' &&
        compatibility[projects[0]].stableTransition.evidence?.trim(),
      'Explicit owner evidence required to stabilize one project at 1.0.0',
    );
  const preview = await previewVersions(
    context,
    projects,
    firstRelease,
    stabilize,
  );
  const expanded = Object.entries(preview.projectsVersionData)
    .filter(([, v]) => v.newVersion)
    .map(([p]) => p);
  assert(expanded.length > 0, 'Nx found no release changes');
  for (const p of expanded)
    assert(
      compatibility[p]?.evidence &&
        ['none', 'patch', 'minor', 'major'].includes(
          compatibility[p].minimumBump,
        ),
      `Compatibility evidence required for expanded project ${p}`,
    );
  // Existing version actions need build outputs. They run only here without
  // publication credentials; the candidate gets rebuilt after integration.
  command(['nx', 'run-many', '-t', 'build', '-p', expanded.join(',')]);
  const result = await prepareNxVersions(projects, firstRelease, stabilize);
  const actual = Object.entries(result.projectsVersionData)
    .filter(([, v]) => v.newVersion)
    .map(([p, v]) => [p, v.newVersion]);
  assert(
    canonical(actual) ===
      canonical(
        expanded.map((p) => [p, preview.projectsVersionData[p].newVersion]),
      ),
    'Nx preparation differs from preview',
  );
  mkdirSync('.release', { recursive: true });
  writeFileSync(
    '.release/request.json',
    canonical({
      schema: 1,
      baseline,
      projects,
      firstRelease,
      stabilize,
      compatibility,
      versions: result.projectsVersionData,
      channels: Object.fromEntries(expanded.map((p) => [p, 'latest'])),
    }),
  );
  return { baseline, projects: expanded, request: '.release/request.json' };
}

export async function prepareNxVersions(
  projects,
  firstRelease = false,
  stabilize = false,
) {
  const { ReleaseClient } = await import('nx/release');
  const client = new ReleaseClient({
    version: { preVersionCommand: '' },
    changelog: {
      projectChangelogs: {
        file: '{projectRoot}/CHANGELOG.md',
        createRelease: false,
      },
    },
  });
  const result = await client.releaseVersion({
    projects,
    firstRelease,
    ...(firstRelease
      ? { specifier: '0.0.1' }
      : stabilize
        ? { specifier: '1.0.0' }
        : {}),
    ...noGit,
  });
  await client.releaseChangelog({
    projects,
    versionData: result.projectsVersionData,
    firstRelease,
    createRelease: false,
    ...noGit,
  });
  return result;
}

export async function freeze({ ciRunId, out = 'release-payload' }) {
  credentialFree();
  const commit = git(['rev-parse', 'HEAD']);
  assert(
    process.env.GITHUB_REPOSITORY === REPOSITORY &&
      process.env.GITHUB_REF === 'refs/heads/main' &&
      process.env.GITHUB_SHA === commit &&
      process.env.GITHUB_RUN_ATTEMPT === '1',
    'Freeze only in the trusted main preparation workflow',
  );
  assert(
    commit === (await mainCommit()),
    'Prepare the current integrated candidate',
  );
  assert(git(['status', '--porcelain']) === '', 'Dirty candidate');
  const request = read('.release/request.json');
  assert(
    request.schema === 1 && SHA.test(request.baseline),
    'Missing integrated version request',
  );
  git(['merge-base', '--is-ancestor', request.baseline, commit]);
  const context = await workspace();
  const projects = selectedProjects(context, request.projects.join(','));
  const ci = await exactCI(commit, ciRunId);
  const preview = await previewVersions(
    context,
    projects,
    request.firstRelease,
    request.stabilize,
  );
  const versions = Object.fromEntries(
    Object.entries(preview.projectsVersionData).filter(([, v]) => v.newVersion),
  );
  const releaseProjects = Object.keys(versions);
  assert(releaseProjects.length > 0, 'No versioned projects');
  for (const p of releaseProjects)
    assert(
      request.versions[p]?.newVersion === versions[p].newVersion &&
        identity(context, p).version === versions[p].newVersion,
      'Integrated manifests/request differ from fresh Nx result',
    );
  assert(
    Object.entries(request.versions).filter(([, v]) => v.newVersion).length ===
      releaseProjects.length,
    'Unexpected dependent version effects',
  );
  // Check actual integrated commits since the preparation baseline too. The
  // baseline's older commits are covered by Nx intent and compatibility review.
  for (const sha of git([
    'rev-list',
    '--reverse',
    `${request.baseline}..${commit}`,
  ])
    .split('\n')
    .filter(Boolean)) {
    const files = git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha])
      .split('\n')
      .filter(Boolean);
    await checkCommit(context, {
      message: git(['show', '-s', '--format=%B', sha]),
      files,
    });
  }
  const gates = readinessTargets(releaseProjects);
  command([
    'nx',
    'run-many',
    '-t',
    'build,typecheck,test,lint',
    '-p',
    releaseProjects.join(','),
  ]);
  for (const target of gates) command(['nx', 'run', target]);
  // Final writer runs after checks; credentialed execution never rebuilds.
  command(['nx', 'run-many', '-t', 'build', '-p', releaseProjects.join(',')]);
  const packages = [];
  const ownership = readFileSync('OWNERSHIP.md', 'utf8');
  for (const project of releaseProjects) {
    const id = identity(context, project),
      data = context.graph.nodes[project].data;
    const row = ownership
      .split('\n')
      .find((line) => line.split('|')[1]?.trim() === '`' + project + '`');
    assert(
      row && row.split('|')[4]?.trim() === 'Johan',
      'Missing confirmed package owner',
    );
    const capability = row.split('|')[3].trim();
    const directory = resolve(out, project);
    mkdirSync(directory, { recursive: true });
    if (id.channel === 'npm') {
      const packageRoot =
        data.targets['nx-release-publish'].options.packageRoot ?? data.root;
      if (packageRoot === data.root)
        command(
          ['pack', '--out', join(directory, `${project}-${id.version}.tgz`)],
          { cwd: resolve(packageRoot) },
        );
      else
        execFileSync(
          'npm',
          ['pack', '--ignore-scripts', '--pack-destination', directory],
          { cwd: resolve(packageRoot), stdio: 'inherit' },
        );
    } else if (id.channel === 'pypi') {
      for (const name of readdirSync(join(data.root, 'dist')).filter(
        (n) => n.endsWith('.whl') || n.endsWith('.tar.gz'),
      ))
        copyFileSync(join(data.root, 'dist', name), join(directory, name));
    } else {
      // Retain the exact Git subdirectory, never a pack-only pseudo-distribution.
      execFileSync('git', [
        'archive',
        '--format=tar.gz',
        `--output=${join(directory, project + '.tar.gz')}`,
        `${commit}:${data.root}`,
      ]);
    }
    const files = readdirSync(directory).map((name) => {
      const path = join(directory, name),
        bytes = readFileSync(path);
      const inspection = JSON.parse(
        execFileSync('python3', [auditScript, path], {
          encoding: 'utf8',
          maxBuffer: 8 * 1024 * 1024,
        }),
      );
      if (id.channel === 'npm') {
        assert(
          inspection.readme ===
            sha256(readFileSync(join(data.root, 'README.md'))),
          'Packed README is not source-current',
        );
        const license = existsSync(join(data.root, 'LICENSE'))
          ? join(data.root, 'LICENSE')
          : 'LICENSE';
        assert(
          inspection.license === sha256(readFileSync(license)),
          'Packed LICENSE is not source-current',
        );
      }
      if (id.channel === 'pypi') {
        const runtime = identity(context, 'governance-runtime-dbt');
        assert(
          inspection.runtime?.runtimePackage === runtime.name &&
            inspection.runtime.runtimeVersion === runtime.version,
          'Packaged Python runtime pin mismatch',
        );
      }
      return {
        name,
        size: bytes.length,
        sha256: sha256(bytes),
        inventory: inspection.inventory,
      };
    });
    const candidate = {
      project,
      version: id.version,
      tag: `${project}@${id.version}`,
      nxVersion: versions[project],
      compatibility: request.compatibility[project],
      stableTransition: request.compatibility[project]?.stableTransition,
      artifacts:
        id.channel === 'github'
          ? [data.root]
          : files.map((f) => join(directory, f.name)),
    };
    const validation = await validateCandidate(context, candidate);
    packages.push({
      ...id,
      ...candidate,
      capability,
      ...(id.channel === 'github'
        ? {
            subdirectory: data.root,
            subtree: git(['rev-parse', `${commit}:${data.root}`]),
          }
        : {}),
      artifacts: undefined,
      files,
      history: validation.history,
      dependencies: [],
      distTag: request.channels[project],
      notes: existsSync(join(data.root, 'CHANGELOG.md'))
        ? readFileSync(join(data.root, 'CHANGELOG.md'), 'utf8')
        : `${project} ${id.version}`,
    });
  }
  for (const p of packages)
    for (const name of publishClosure(context, p.project)) {
      const included = packages.find((x) => x.project === name);
      if (included)
        p.dependencies.push({
          project: included.project,
          name: included.name,
          version: included.version,
          channel: included.channel,
          distTag: included.distTag,
          files: included.files,
        });
      else {
        const id = identity(context, name),
          data = await registry(id);
        assert(
          id.channel === 'npm' && data?.versions[id.version],
          `Dependency ${name} must already be distributed or included in a separate authorized release`,
        );
        const dist = data.versions[id.version].dist;
        const url = new URL(dist.tarball);
        assert(
          url.origin === 'https://registry.npmjs.org',
          'Unexpected dependency archive origin',
        );
        const response = await fetch(url, {
          redirect: 'error',
          signal: AbortSignal.timeout(60_000),
        });
        assert(response.ok, 'Dependency archive unavailable');
        const bytes = Buffer.from(await response.arrayBuffer());
        p.dependencies.push({
          ...id,
          distTag: 'latest',
          files: [
            {
              name: basename(url.pathname),
              size: bytes.length,
              sha256: sha256(bytes),
            },
          ],
        });
      }
    }
  const consumers = verifyConsumers(packages, out);
  assert(
    git(['diff', '--name-only']) === '' &&
      git(['diff', '--cached', '--name-only']) === '',
    'A build changed candidate sources; integrate writers before freezing',
  );
  const record = {
    schema: 1,
    repository: REPOSITORY,
    owner: OWNER,
    baseline: request.baseline,
    candidate: { commit, tree: git(['rev-parse', 'HEAD^{tree}']) },
    controller: { commit, digest: controllerDigest() },
    lockDigest: sha256(readFileSync('yarn.lock')),
    preparation: { runId: Number(process.env.GITHUB_RUN_ID), attempt: 1 },
    evidence: {
      consumers,
      tools: {
        node: process.version,
        npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
        yarn: execFileSync('yarn', ['--version'], { encoding: 'utf8' }).trim(),
        python: execFileSync('python3', ['--version'], {
          encoding: 'utf8',
        }).trim(),
        nx: read('node_modules/nx/package.json').version,
      },
      ciRunId: ci.id,
      ci,
      gates: [
        ...releaseProjects.flatMap((project) =>
          ['build', 'typecheck', 'test', 'lint']
            .filter(
              (target) => context.graph.nodes[project].data.targets[target],
            )
            .map((target) => `${project}:${target}`),
        ),
        ...gates,
      ],
      exceptions: [
        'Renderer G07: remote restoration/DTE not claimed; docs/editorjs-integrated-stability-review.md',
      ],
    },
    packages,
  };
  const bytes = canonical(record);
  writeFileSync(join(out, 'release-record.json'), bytes);
  return {
    digest: sha256(bytes),
    candidate: commit,
    projects: releaseProjects,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      projects: { type: 'string' },
      compatibility: { type: 'string' },
      'first-release': { type: 'boolean' },
      stabilize: { type: 'boolean' },
      'ci-run': { type: 'string' },
      out: { type: 'string' },
    },
  });
  const action = positionals[0];
  const promise =
    action === 'version'
      ? version({
          projects: values.projects,
          compatibility: values.compatibility,
          firstRelease: values['first-release'],
          stabilize: values.stabilize,
        })
      : action === 'freeze'
        ? freeze({
            ciRunId: Number(values['ci-run'] ?? process.env.RELEASE_CI_RUN_ID),
            out: values.out,
          })
        : Promise.reject(new Error('Use version or freeze'));
  promise
    .then((result) => {
      console.log(canonical(result));
      if (process.env.GITHUB_OUTPUT)
        writeFileSync(
          process.env.GITHUB_OUTPUT,
          `digest=${result.digest ?? ''}\n`,
          { flag: 'a' },
        );
    })
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
