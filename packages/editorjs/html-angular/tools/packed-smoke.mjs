import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { chromium, expect } from '@playwright/test';
import { corpusCheck, isolationCheck } from './packed/browser-checks.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const workspace = resolve(project, '../../..');
const prepared = process.env.EDITORJS_RENDERER_CONSUMER;
const phase = process.env.EDITORJS_RENDERER_PHASE;
const angular = process.env.EDITORJS_RENDERER_ANGULAR ?? '22.1.4';
const cli = process.env.EDITORJS_RENDERER_ANGULAR ?? '22.1.6';
const temporary =
  prepared ??
  realpathSync(mkdtempSync(join(tmpdir(), 'editorjs-html-angular-')));
const evidence =
  process.env.EDITORJS_RENDERER_REPORT ??
  join(workspace, 'dist/test-results/editorjs-html-angular');
rmSync(evidence, { recursive: true, force: true });
mkdirSync(evidence, { recursive: true });
const environment = {
  ...process.env,
  NODE_OPTIONS: '',
  NG_CLI_ANALYTICS: 'false',
  npm_config_cache: join(temporary, 'cache'),
};
const write = (name, value) =>
  writeFileSync(
    join(temporary, name),
    typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  );
const run = (command, args, cwd = temporary) => {
  try {
    return execFileSync(command, args, {
      cwd,
      env: environment,
      encoding: 'utf8',
      timeout: 180_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    writeFileSync(
      join(evidence, 'failure.log'),
      String(error.stdout ?? '') + String(error.stderr ?? ''),
    );
    throw error;
  }
};
let server;
let browser;
try {
  let archives = {};
  if (!prepared || phase === 'prepare') {
    for (const name of ['core', 'html', 'html-angular']) {
      const archive = join(temporary, `${name}.tgz`);
      // Core/headless packages export their own built dist; Angular publishes APF.
      const directory =
        name === 'html-angular'
          ? join(workspace, 'dist/packages/editorjs/html-angular')
          : join(project, '..', name);
      if (name === 'html-angular') {
        run(
          'npm',
          ['pack', '--ignore-scripts', '--pack-destination', temporary],
          directory,
        );
        const packed = readdirSync(temporary).find(
          (file) =>
            file.startsWith('anarchitects-editorjs-html-angular-') &&
            file.endsWith('.tgz'),
        );
        assert.ok(packed);
        cpSync(join(temporary, packed), archive);
      } else {
        // Yarn rewrites workspace: ranges in the neutral packages' archives.
        run('yarn', ['pack', '--out', archive], directory);
      }
      archives[name] = createHash('sha256')
        .update(readFileSync(archive))
        .digest('hex');
    }
    write('package.json', {
      name: 'packed-html-angular-consumer',
      version: '0.0.0',
      private: true,
      type: 'module',
      dependencies: {
        '@anarchitects/editorjs-core': 'file:./core.tgz',
        '@anarchitects/editorjs-html': 'file:./html.tgz',
        '@anarchitects/editorjs-html-angular': 'file:./html-angular.tgz',
        ...Object.fromEntries(
          [
            'core',
            'common',
            'compiler',
            'compiler-cli',
            'platform-browser',
            'platform-server',
            'router',
          ].map((name) => [`@angular/${name}`, angular]),
        ),
        '@angular/ssr': cli,
        '@angular/build': cli,
        '@angular/cli': cli,
        typescript: '6.0.3',
        rxjs: '7.8.2',
        '@types/node': '24.10.1',
      },
    });
    console.log('Installing isolated packed consumer');
    writeFileSync(
      join(evidence, 'install.log'),
      run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']),
    );
    const installed = join(
      temporary,
      'node_modules/@anarchitects/editorjs-html-angular',
    );
    const manifest = JSON.parse(
      readFileSync(join(installed, 'package.json'), 'utf8'),
    );
    assert.deepEqual(manifest.dependencies, {
      '@anarchitects/editorjs-html': '^0.0.1',
      tslib: '^2.3.0',
    });
    assert.deepEqual(manifest.peerDependencies, {
      '@angular/core': '22.0.0 || 22.1.4 || 22.2.2',
    });
    assert.equal(
      readdirSync(installed).some((name) =>
        ['src', 'tests', 'tools'].includes(name),
      ),
      false,
    );
    const readme = readFileSync(join(installed, 'README.md'), 'utf8');
    assert.equal(readme, readFileSync(join(project, 'README.md'), 'utf8'));
    assert.equal(
      readFileSync(join(installed, 'LICENSE'), 'utf8'),
      readFileSync(join(project, 'LICENSE'), 'utf8'),
    );
    const lock = JSON.parse(
      readFileSync(join(temporary, 'package-lock.json'), 'utf8'),
    );
    assert.equal(
      Object.keys(lock.packages).some((name) =>
        /@editorjs\/|@anarchitects\/editorjs-angular(?:\/|$)/.test(name),
      ),
      false,
    );
    // Angular build tooling may contain optional framework peers; runtime exports must not import them.
    const js = readFileSync(
      join(installed, 'fesm2022/anarchitects-editorjs-html-angular.mjs'),
      'utf8',
    );
    assert.doesNotMatch(
      js,
      /@angular\/forms|@editorjs\/|bypassSecurityTrustHtml|provideClientHydration/,
    );
    cpSync(join(project, 'tools/consumer'), join(temporary, 'src'), {
      recursive: true,
    });
    cpSync(
      join(project, '../html/tests/adversarial-fixtures.ts'),
      join(temporary, 'src/adversarial-fixtures.ts'),
    );
    const corpusPath = join(temporary, 'src/adversarial-fixtures.ts');
    writeFileSync(
      corpusPath,
      readFileSync(corpusPath, 'utf8').replace(
        '../src/index.js',
        '@anarchitects/editorjs-html',
      ),
    );
    mkdirSync(join(temporary, 'src/examples'));
    const persistence = readFileSync(
      join(
        temporary,
        'node_modules/@anarchitects/editorjs-core/persistence.md',
      ),
      'utf8',
    );
    assert.equal(
      persistence,
      readFileSync(join(project, '../core/persistence.md'), 'utf8'),
    );
    const codec = [
      ...persistence.matchAll(
        /<!-- persistence-example-file: persistence.ts -->\s*```ts\n([\s\S]*?)```/g,
      ),
    ];
    assert.equal(codec.length, 1, 'Expected the archived persistence codec');
    write('src/examples/persistence.ts', codec[0][1]);
    const examples = [
      ...readme.matchAll(/<!-- example: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g),
    ];
    assert.equal(examples.length, 7);
    for (const [, name, source] of examples)
      write(`src/examples/${name}`, source);
    const compilerOptions = {
      target: 'ES2022',
      module: 'preserve',
      moduleResolution: 'bundler',
      experimentalDecorators: true,
      strict: true,
      skipLibCheck: true,
      lib: ['ES2022', 'DOM'],
      types: ['node'],
      outDir: './out',
    };
    write('tsconfig.examples.json', {
      compilerOptions,
      angularCompilerOptions: { strictTemplates: true },
      include: ['src/examples/**/*.ts'],
    });
    write('tsconfig.json', {
      compilerOptions,
      angularCompilerOptions: { strictTemplates: true },
      files: ['src/main.ts', 'src/main.server.ts', 'src/server.ts'],
    });
    write(
      'src/index.html',
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>HTML Angular packed consumer</title><base href="/"></head><body><aa-root></aa-root></body></html>',
    );
    write('angular.json', {
      version: 1,
      cli: { analytics: false, cache: { enabled: false } },
      projects: {
        consumer: {
          projectType: 'application',
          root: '',
          sourceRoot: 'src',
          architect: {
            build: {
              builder: '@angular/build:application',
              options: {
                browser: 'src/main.ts',
                server: 'src/main.server.ts',
                ssr: { entry: 'src/server.ts' },
                outputMode: 'server',
                index: 'src/index.html',
                tsConfig: 'tsconfig.json',
                outputPath: 'dist/consumer',
                styles: [],
                assets: [],
                statsJson: true,
                security: { allowedHosts: ['localhost', '127.0.0.1'] },
              },
            },
          },
        },
      },
    });
    write('packed-metadata.json', {
      archives,
      readmeExamples: examples.length,
      angular,
      cli,
    });
  }
  const metadata = JSON.parse(
    readFileSync(join(temporary, 'packed-metadata.json'), 'utf8'),
  );
  archives = metadata.archives;
  if (phase === 'prepare') process.exit(0);
  if (!prepared || phase === 'build') {
    console.log('Compiling packaged README examples');
    run(process.execPath, [
      'node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js',
      '-p',
      'tsconfig.examples.json',
      '--noEmit',
    ]);
    console.log('Building production SSR and browser bundles');
    writeFileSync(
      join(evidence, 'build.log'),
      run(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'build']),
    );
  }
  if (phase === 'build') process.exit(0);
  server = spawn(process.execPath, ['dist/consumer/server/server.mjs'], {
    cwd: temporary,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stderr.on('data', (chunk) => {
    serverLog += chunk;
  });
  const port = await new Promise((yes, no) => {
    const timeout = setTimeout(
      () => no(Error('SSR startup timed out')),
      30_000,
    );
    server.once('error', (error) => {
      clearTimeout(timeout);
      no(error);
    });
    server.once('exit', (code) => {
      clearTimeout(timeout);
      no(Error(`SSR exited ${code}: ${serverLog}`));
    });
    server.stdout.on('data', (chunk) => {
      serverLog += chunk;
      const match = serverLog.match(/READY (\d+)/);
      if (match) {
        clearTimeout(timeout);
        yes(Number(match[1]));
      }
    });
  });
  const origin = `http://127.0.0.1:${port}`;
  if (phase === 'corpus' || phase === 'isolation') {
    browser = await chromium.launch({ headless: true });
    const result =
      phase === 'corpus'
        ? await corpusCheck(browser, origin, evidence)
        : await isolationCheck(browser, origin, temporary);
    writeFileSync(
      join(evidence, 'summary.json'),
      JSON.stringify(
        {
          node: process.version,
          angular,
          cli,
          chromium: browser.version(),
          ...result,
        },
        null,
        2,
      ),
    );
  } else {
    const pages = await Promise.all(
      ['first', 'second'].map(async (name) => {
        const response = await fetch(`${origin}/${name}`);
        assert.equal(response.status, 200);
        const html = await response.text();
        writeFileSync(join(evidence, `${name}.html`), html);
        return html;
      }),
    );
    assert.match(pages[0], /Article first/);
    assert.doesNotMatch(pages[0], /Article second/);
    assert.match(pages[1], /Article second/);
    assert.doesNotMatch(pages[1], /Article first/);
    assert.match(pages[0], /class="route-first"/);
    assert.doesNotMatch(pages[0], /class="route-second"/);
    assert.match(pages[1], /class="route-second"/);
    assert.doesNotMatch(pages[1], /class="route-first"/);
    assert.match(pages[0], /ngh=/);
    assert.match(pages[0], /alt="Blue boat"/);
    browser = await chromium.launch({ headless: true });
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const ssr = await noJs.newPage();
    await ssr.route('https://assets.invalid/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      }),
    );
    await ssr.goto(`${origin}/first`);
    await expect(
      ssr.locator('#directive').getByRole('heading', { name: 'Article first' }),
    ).toBeVisible();
    await expect(
      ssr.locator('#directive').getByRole('img', { name: 'Blue boat' }),
    ).toHaveCount(1);
    await expect(ssr.locator('main')).toHaveAttribute('data-hydrated', 'false');
    await noJs.close();
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error' ||
        /NG05\d\d|hydration mismatch/i.test(message.text())
      )
        errors.push(message.text());
    });
    page.on('request', (request) => requests.push(request.url()));
    await page.route('https://assets.invalid/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      }),
    );
    let release;
    const gate = new Promise((yes) => {
      release = yes;
    });
    await page.route('**/*.js', async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto(`${origin}/first`, { waitUntil: 'commit' });
    await expect(page.locator('#primary h2')).toHaveText('Article first');
    await page.evaluate(() => {
      globalThis.__before = {
        directive: document.querySelector('#directive'),
        directiveHtml: document.querySelector('#directive').innerHTML,
        host: document.querySelector('#primary'),
        container: document.querySelector('#primary .editorjs-html'),
        heading: document.querySelector('#primary h2'),
        html: document.querySelector('#primary .editorjs-html').innerHTML,
      };
    });
    release();
    await expect(page.locator('main')).toHaveAttribute('data-hydrated', 'true');
    const hydration = await page.evaluate(() => ({
      directiveReused:
        globalThis.__before.directive === document.querySelector('#directive'),
      directiveHtmlIdentical:
        globalThis.__before.directiveHtml ===
        document.querySelector('#directive').innerHTML,
      hostReused:
        globalThis.__before.host === document.querySelector('#primary'),
      containerReused:
        globalThis.__before.container ===
        document.querySelector('#primary .editorjs-html'),
      htmlIdentical:
        globalThis.__before.html ===
        document.querySelector('#primary .editorjs-html').innerHTML,
      headingReused:
        globalThis.__before.heading === document.querySelector('#primary h2'),
    }));
    assert.equal(hydration.directiveReused, true);
    assert.equal(hydration.directiveHtmlIdentical, true);
    assert.equal(hydration.hostReused, true);
    assert.equal(hydration.containerReused, true);
    assert.equal(hydration.htmlIdentical, true);
    const parity = async () => {
      assert.equal(
        await page.locator('#directive').innerHTML(),
        await page.locator('#primary .editorjs-html').innerHTML(),
      );
      await expect(page.locator('#directive-result')).toHaveText(
        await page.locator('#component-result').innerText(),
      );
      await expect(page.locator('#directive')).toHaveAttribute(
        'class',
        'host-owned',
      );
      await expect(page.locator('#directive')).toHaveAttribute(
        'aria-label',
        'Directive article',
      );
      await expect(page.locator('#directive')).toHaveAttribute(
        'data-owner',
        'consumer',
      );
    };
    await parity();
    for (const [scope, css] of [
      ['root', 'application'],
      ['route', 'route-first'],
      ['element', 'element'],
    ]) {
      await expect(page.locator(`#${scope}-directive p`)).toHaveAttribute(
        'class',
        css,
      );
      await expect(page.locator(`#${scope}-component p`)).toHaveAttribute(
        'class',
        css,
      );
    }
    await expect(
      page.locator('app-scoped-article aa-editorjs-html p'),
    ).toHaveClass('element-text');
    await expect(page.locator('app-scoped-article article p')).toHaveClass(
      'element-text',
    );
    await expect(page.locator('#primary ol')).toHaveAttribute('start', '3');
    await expect(page.locator('#primary ol')).toHaveAttribute('type', 'I');
    await expect(page.locator('#primary figcaption')).toHaveText('At sea');
    await expect(page.locator('app-article b')).toHaveText('reader');
    await expect(page.locator('app-preview pre')).toHaveText('<literal text>');
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.locator('#primary p.changed')).toHaveText('Updated');
    await expect(page.locator('#secondary p.secondary')).toHaveText(
      'Independent',
    );
    await parity();
    await page.getByRole('button', { name: 'Invalid', exact: true }).click();
    await expect(page.locator('#primary .editorjs-html')).toBeEmpty();
    await expect(page.locator('#component-result')).toHaveText('failure');
    await parity();
    assert.equal(
      await page.evaluate(() => globalThis.__attack === true),
      false,
    );
    assert.equal(
      requests.some((url) => url.endsWith('/x')),
      false,
    );
    await page.getByRole('button', { name: 'Recover', exact: true }).click();
    await expect(page.locator('#primary p')).toHaveText('Recovered');
    await expect(page.locator('#component-result')).toHaveText('success');
    await parity();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.locator('#primary p')).toHaveText('Preview kept');
    await expect(page.locator('#component-result')).toHaveText('preview');
    await parity();
    await page.getByRole('button', { name: 'Empty', exact: true }).click();
    await expect(page.locator('#primary .editorjs-html')).toBeEmpty();
    await expect(page.locator('#secondary p.secondary')).toHaveText(
      'Independent',
    );
    await parity();
    // Positive control: this browser would execute an unsanitized inline handler.
    assert.equal(
      await page.evaluate(() => {
        const button = document.createElement('button');
        button.setAttribute('onclick', 'globalThis.__probe=true');
        document.body.append(button);
        button.click();
        button.remove();
        return globalThis.__probe;
      }),
      true,
    );
    await page
      .getByRole('button', { name: 'Unsafe preview', exact: true })
      .click();
    await expect(page.locator('#directive-result')).toHaveText('preview');
    await expect(page.locator('#directive b')).toHaveText('Safe text');
    await parity();
    await expect(
      page.locator(
        '#directive [onclick], #directive [onerror], #directive img, #directive [href]',
      ),
    ).toHaveCount(0);
    const beforeClick = page.url();
    await page.locator('#directive a').click();
    assert.equal(page.url(), beforeClick);
    await page
      .getByRole('button', { name: 'Unsafe custom', exact: true })
      .click();
    await expect(page.locator('#directive-result')).toHaveText('failure');
    await expect(page.locator('#directive')).toBeEmpty();
    await parity();
    assert.equal(
      await page.evaluate(() => globalThis.__attack === true),
      false,
    );
    assert.equal(
      requests.some((url) => new URL(url).pathname === '/x'),
      false,
    );
    await page.goto(`${origin}/second`);
    await expect(page.locator('main')).toHaveAttribute('data-hydrated', 'true');
    await expect(page.locator('#directive h2')).toHaveText('Article second');
    await expect(page.locator('#route-directive p')).toHaveClass(
      'route-second',
    );
    await expect(page.locator('#root-directive p')).toHaveClass('application');
    await expect(page.locator('#element-directive p')).toHaveClass('element');
    await parity();
    assert.deepEqual(errors, []);
    const summary = {
      node: process.version,
      angular,
      cli,
      typescript: '6.0.3',
      chromium: browser.version(),
      archives,
      readmeExamples: metadata.readmeExamples,
      ssrRequests: 2,
      hydration,
      scopes: [
        'application',
        'route-first',
        'route-second',
        'element',
        'instance',
      ],
      directiveSecurityNegativeControls: true,
      errors,
    };
    writeFileSync(
      join(evidence, 'summary.json'),
      JSON.stringify(summary, null, 2),
    );
    writeFileSync(join(evidence, 'server.log'), serverLog);
    cpSync(
      join(temporary, 'package-lock.json'),
      join(evidence, 'package-lock.json'),
    );
    console.log(JSON.stringify(summary, null, 2));
  }
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
  }
  if (!prepared) rmSync(temporary, { recursive: true, force: true });
}
