import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { JSDOM } from 'jsdom';
import {
  fixtureRoot,
  fixtureNode,
  packed,
  buildDirectory,
  reportDirectory,
} from './ssr-environment.mjs';

const output = buildDirectory();
const report = reportDirectory('ssr');
await rm(report, { recursive: true, force: true });
await mkdir(report, { recursive: true });
await cp(join(output, 'stats.json'), join(report, 'stats.json'));
const lock = packed ? 'package-lock.json' : 'yarn.lock';
await cp(join(fixtureRoot, lock), join(report, lock));
const require = createRequire(join(fixtureRoot, 'package.json'));
await writeFile(
  join(report, 'versions.json'),
  JSON.stringify(
    {
      node: process.version,
      ...Object.fromEntries(
        ['core', 'forms', 'platform-server', 'ssr', 'build'].map((name) => [
          `@angular/${name}`,
          require(`@angular/${name}/package.json`).version,
        ]),
      ),
    },
    null,
    2,
  ),
);
const stats = JSON.parse(await readFile(join(output, 'stats.json'), 'utf8'));
const editorOutputs = Object.entries(stats.outputs)
  .filter(
    ([file, details]) =>
      file.endsWith('.mjs') &&
      Object.keys(details.inputs).some(
        (input) =>
          input.includes('@editorjs/editorjs/') ||
          input.includes('/registry/tools/') ||
          input.includes('/common/tools/') ||
          input.includes('examples/custom/callout-tool.ts') ||
          input.includes('examples/custom/marker-tool.ts') ||
          input.includes('examples/custom/flag-tune.ts') ||
          input.includes('@editorjs/code/') ||
          /@editorjs\/(paragraph|header|list|quote|image)\//.test(input),
      ),
  )
  .map(([file]) => join(output, 'server', basename(file)));
assert(
  editorOutputs.length > 0,
  'Build graph must identify the real Editor.js server output',
);
const guard = join(import.meta.dirname, 'server-import-guard.mjs');
const env = {
  ...process.env,
  PORT: '0',
  FIXTURE_FORBIDDEN_OUTPUTS: JSON.stringify(editorOutputs),
};
// Positive detection control: this proves a guard that accidentally blocks nothing cannot pass.
const control = await childResult([
  '--import',
  guard,
  '--input-type=module',
  '-e',
  `await import(${JSON.stringify(pathToFileURL(editorOutputs[0]).href)})`,
]);
assert.notEqual(control.code, 0);
assert.match(control.stderr, /Editor.js server evaluation forbidden/);
await writeFile(join(report, 'import-negative-control.log'), control.stderr);
if (packed) {
  const controls = {};
  for (const source of [
    'callout-tool.ts',
    'marker-tool.ts',
    'flag-tune.ts',
    '@editorjs/code/',
  ]) {
    const files = Object.entries(stats.outputs).filter(
      ([file, details]) =>
        file.endsWith('.mjs') &&
        Object.entries(details.inputs).some(
          ([input, value]) => input.includes(source) && value.bytesInOutput > 0,
        ),
    );
    assert(
      files.length > 0,
      `Missing archived custom server provenance: ${source}`,
    );
    const file = join(output, 'server', basename(files[0][0]));
    assert(editorOutputs.includes(file));
    const result = await childResult([
      '--import',
      guard,
      '--input-type=module',
      '-e',
      `await import(${JSON.stringify(pathToFileURL(file).href)})`,
    ]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Editor.js server evaluation forbidden/);
    controls[source] = {
      file: basename(file),
      code: result.code,
      stderr: result.stderr,
    };
  }
  await writeFile(
    join(report, 'custom-import-negative-controls.json'),
    JSON.stringify(controls, null, 2),
  );
}

let stdout = '';
let stderr = '';
const child = spawn(
  fixtureNode,
  ['--import', guard, join(output, 'server/server.mjs')],
  { cwd: fixtureRoot, env, stdio: ['ignore', 'pipe', 'pipe'] },
);
child.stdout.on('data', (chunk) => {
  stdout += chunk;
});
child.stderr.on('data', (chunk) => {
  stderr += chunk;
});
const exited = new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('close', (code, signal) => resolve({ code, signal }));
});
const events = () =>
  stdout
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return {};
      }
    });
let base;
let failure;
let lastCompleted = 0;
try {
  await until(
    () => events().some((e) => e.event === 'listening'),
    'server readiness',
  );
  base = `http://127.0.0.1:${events().find((e) => e.event === 'listening').port}`;
  assert.equal(await (await fetch(base + '/fixture-health')).text(), 'ready');
  for (const route of ['/', '/sample/public']) {
    const { html } = await request(route, `public-${route.length}`);
    inspect(html, undefined);
  }
  // Sequential A/B requests through both independent entry points, then replay A.
  for (const route of ['standalone', 'forms']) {
    const a = await request(
      `/${route}?marker=${route}-alpha&disabled=true`,
      `${route}-alpha`,
    );
    check(a, `${route}-alpha`, route, true, false);
    const b = await request(
      `/${route}?marker=${route}-beta&readonly=true`,
      `${route}-beta`,
    );
    check(b, `${route}-beta`, route, false, true);
    assert(!b.html.includes(`${route}-alpha`));
    const again = await request(
      `/${route}?marker=${route}-alpha&disabled=true`,
      `${route}-alpha-repeat`,
    );
    assert.equal(
      again.html,
      a.html,
      'Identical inputs must produce deterministic HTML',
    );
  }
  // Hold A's Angular application open until B has an owner, proving actual overlap.
  for (const route of ['standalone', 'forms']) {
    const markerA = `${route}-overlap-alpha`;
    const markerB = `${route}-overlap-beta`;
    const [a, b] = await Promise.all([
      request(`/${route}?marker=${markerA}&disabled=true`, markerA, 200),
      (async () => {
        await until(
          () =>
            events().some((e) => e.event === 'owned' && e.id > lastCompleted),
          'first overlapping owner',
        );
        return request(
          `/${route}?marker=${markerB}&readonly=true`,
          markerB,
          100,
        );
      })(),
    ]);
    check(a, markerA, route, true, false);
    check(b, markerB, route, false, true);
    assert(!a.html.includes(markerB));
    assert(!b.html.includes(markerA));
    const log = events();
    assert(
      log.findIndex((e) => e.id === b.id && e.event === 'owned') <
        log.findIndex((e) => e.id === a.id && e.event === 'finished'),
      'Applications must coexist, not just queued HTTP requests',
    );
  }
  for (const route of [
    'registry',
    'registry/forms',
    'tools',
    'tools/forms',
    'upload',
    'forms-upload',
    ...(packed ? ['custom', 'custom-forms'] : []),
  ]) {
    for (const concurrent of [false, true]) {
      const verify = async (marker) => {
        const result = await request(
          `/${route}?marker=${marker}`,
          marker,
          concurrent ? 200 : 0,
        );
        const dom = new JSDOM(result.html);
        try {
          const holders =
            dom.window.document.querySelectorAll('aa-editorjs > div');
          const uploads = route === 'upload' || route === 'forms-upload';
          const custom = route.startsWith('custom');
          assert.equal(
            holders.length,
            uploads || custom ? 0 : route.endsWith('forms') ? 1 : 2,
          );
          for (const holder of holders)
            assert.equal(holder.childNodes.length, 0);
          assert.equal(
            dom.window.document.querySelector('[data-testid="marker"]')
              .textContent,
            marker,
          );
          if (custom) {
            assert(
              dom.window.document.querySelector('aa-custom-ssr button')
                .disabled,
            );
            assert.equal(
              dom.window.document.querySelectorAll(
                'app-custom-page, app-custom-form-page, .callout-text, .ce-code__textarea',
              ).length,
              0,
            );
          } else if (uploads) {
            for (const name of ['backend-calls', 'backend-completed'])
              assert.equal(
                dom.window.document.querySelector(`[data-testid="${name}"]`)
                  .textContent,
                '0',
              );
            assert.equal(
              dom.window.document.querySelectorAll('[data-testid="ready"]')
                .length,
              2,
            );
            for (const ready of dom.window.document.querySelectorAll(
              '[data-testid="ready"]',
            ))
              assert.equal(ready.textContent.trim(), 'waiting');
            assert(!result.html.includes('PRIVATE_'));
          } else {
            assert.equal(
              dom.window.document.querySelector(
                '[data-testid="registry-config-label"]',
              ).textContent,
              marker,
            );
          }
          assert(
            !dom.window.document.querySelector(
              '[contenteditable], .registry-card, [ngskiphydration]',
            ),
          );
        } finally {
          dom.window.close();
        }
        return result;
      };
      const prefix =
        route.replace('/', '-') + (concurrent ? '-concurrent' : '-sequential');
      const a = `${prefix}-alpha`,
        b = `${prefix}-beta`;
      const previous = lastCompleted;
      const results = concurrent
        ? await Promise.all([
            verify(a),
            (async () => {
              await until(
                () =>
                  events().some((e) => e.event === 'owned' && e.id > previous),
                'first overlapping registry owner',
              );
              return verify(b);
            })(),
          ])
        : [await verify(a), await verify(b)];
      assert(!results[0].html.includes(b));
      assert(!results[1].html.includes(a));
      if (concurrent) {
        const log = events();
        assert(
          log.findIndex((e) => e.id === results[1].id && e.event === 'owned') <
            log.findIndex(
              (e) => e.id === results[0].id && e.event === 'finished',
            ),
          'Registry applications must coexist',
        );
      }
    }
  }
  for (const route of ['standalone', 'forms', 'public']) {
    const html = await readFile(
      join(output, `browser/sample/${route}/index.html`),
      'utf8',
    );
    await writeFile(join(report, `prerender-${route}.html`), html);
    inspect(html, route === 'public' ? undefined : 'public-sample', route);
    const served = await request(
      `/sample/${route}?marker=ignored-private&disabled=true`,
      `sample-${route}`,
    );
    assert.equal(served.html, html);
    assert(!served.html.includes('ignored-private'));
  }
  assert(!events().some((e) => e.event === 'unexpected-submit'));
  assert(!/Error|NG\d{4}|forbidden by SSR fixture/.test(stderr), stderr);
  console.log(
    'SSR HTTP, deterministic HTML, prerender, escaped state, sequential/overlapping isolation and request teardown passed.',
  );
} catch (error) {
  failure = error;
} finally {
  child.kill('SIGTERM');
  const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
  const result = await exited;
  clearTimeout(timeout);
  await writeFile(join(report, 'server.stdout.log'), stdout);
  await writeFile(join(report, 'server.stderr.log'), stderr);
  try {
    assert.equal(
      result.code,
      0,
      `Server must exit cleanly: ${JSON.stringify(result)}`,
    );
    assert(
      events().some((e) => e.event === 'closed'),
      'Server close callback must run',
    );
    if (base)
      await assert.rejects(
        fetch(base + '/fixture-health', { signal: AbortSignal.timeout(1000) }),
      );
  } catch (error) {
    failure ??= error;
  }
}
if (failure) throw failure;
console.log('Owned server process and listening socket teardown passed.');

async function request(path, name, wait = 0) {
  const response = await fetch(base + path, {
    headers: {
      'x-fixture-delay': String(wait),
      authorization: `Bearer synthetic-secret-not-for-transfer-${name}`,
      cookie: `session=synthetic-cookie-not-for-transfer-${name}`,
    },
    signal: AbortSignal.timeout(10000),
  });
  const html = await response.text();
  await writeFile(join(report, `${name}.html`), html);
  assert.equal(response.status, 200, html);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert(!html.includes('synthetic-secret-not-for-transfer'));
  assert(!html.includes('synthetic-cookie-not-for-transfer'));
  const id = Number(response.headers.get('x-fixture-request'));
  lastCompleted = Math.max(lastCompleted, id);
  await until(
    () => events().some((e) => e.event === 'finished' && e.id === id),
    'response body completion',
  );
  const authoring =
    path.startsWith('/standalone') ||
    path.startsWith('/forms') ||
    path.startsWith('/registry') ||
    path.startsWith('/upload') ||
    path.startsWith('/custom') ||
    path.startsWith('/tools');
  // Angular schedules platform destruction after rendering. Observe its actual
  // DestroyRef callbacks; do not force disposal or infer it from HTTP completion.
  if (authoring)
    await until(
      () => events().some((e) => e.event === 'disposed' && e.id === id),
      'Angular owner disposal',
    );
  const lifetime = events().find(
    (e) => e.event === (authoring ? 'disposed' : 'finished') && e.id === id,
  ).lifetime;
  assert.deepEqual(lifetime, {
    owners: authoring ? 1 : 0,
    destroyed: authoring ? 1 : 0,
    loaders: /^\/(standalone|forms)(\?|$)/.test(path) ? 1 : 0,
    loadersDestroyed: /^\/(standalone|forms)(\?|$)/.test(path) ? 1 : 0,
    calls: 0,
    instances: 0,
  });
  return { html, id };
}
function inspect(html, marker, route) {
  const dom = new JSDOM(html); // Parse only in the test process; no script execution.
  const document = dom.window.document;
  try {
    assert.equal(document.doctype?.name, 'html');
    assert.equal(document.querySelectorAll('aa-root main').length, 1);
    assert.equal(
      document.querySelectorAll(
        '[contenteditable], .codex-editor, .ce-toolbar, b',
      ).length,
      0,
    );
    assert.equal(document.querySelectorAll('[ngskiphydration]').length, 0);
    const holders = document.querySelectorAll('aa-editorjs > div');
    assert.equal(holders.length, marker ? 1 : 0);
    for (const holder of holders) assert.equal(holder.childNodes.length, 0);
    if (!marker) {
      assert.equal(document.querySelectorAll('aa-editorjs-control').length, 0);
      return;
    }
    assert.equal(
      document.querySelector('[data-testid="marker"]').textContent,
      marker,
    );
    const transfer = JSON.parse(
      document.querySelector('script[type="application/json"]').textContent,
    );
    const data = transfer['editorjs-fixture-document'];
    assert.equal(data.marker, marker);
    assert.equal(
      data.document.blocks[0].data.text,
      `${marker} </script><b>safe & " ' \u2028</b>`,
    );
    assert.deepEqual(Object.keys(data).sort(), [
      'disabled',
      'document',
      'marker',
      'readonly',
    ]);
    assert(!html.includes('</script><b>safe'));
    assert.equal(
      document.querySelectorAll('aa-editorjs-control').length,
      route === 'forms' ? 1 : 0,
    );
    if (route === 'forms') {
      assert.equal(document.querySelector('form').method, 'post');
      assert.equal(
        document.querySelector('form').getAttribute('action'),
        '/fixture-submit',
      );
      assert(document.querySelector('fieldset').disabled);
      assert(
        document
          .querySelector('aa-editorjs-control > div')
          .hasAttribute('inert'),
      );
      const flags = document.querySelector('[data-testid="form-state"]');
      for (const flag of ['dirty', 'touched', 'pending', 'submitting'])
        assert.equal(flags.getAttribute(`data-${flag}`), 'false');
      assert.equal(flags.getAttribute('data-disabled'), String(data.disabled));
      assert.equal(flags.getAttribute('data-readonly'), String(data.readonly));
    }
  } finally {
    dom.window.close();
  }
}
function check(result, marker, route, disabled, readonly) {
  inspect(result.html, marker, route);
  const dom = new JSDOM(result.html);
  try {
    const state = JSON.parse(
      dom.window.document.querySelector('script[type="application/json"]')
        .textContent,
    )['editorjs-fixture-document'];
    assert.equal(state.disabled, disabled);
    assert.equal(state.readonly, readonly);
  } finally {
    dom.window.close();
  }
}
async function until(predicate, label) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    assert(
      child.exitCode === null && child.signalCode === null,
      `Server exited while awaiting ${label}: ${stderr}`,
    );
    assert(Date.now() < deadline, `Timeout awaiting ${label}: ${stderr}`);
    await delay(10);
  }
}
async function childResult(args) {
  const process = spawn(fixtureNode, args, {
    cwd: fixtureRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  process.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  return new Promise((resolve, reject) => {
    process.once('error', reject);
    process.once('close', (code) => resolve({ code, stderr }));
  });
}
