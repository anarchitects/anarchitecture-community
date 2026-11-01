import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temporary = realpathSync(
  mkdtempSync(join(tmpdir(), 'editorjs-html-packed-')),
);
const require = createRequire(import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const environment = {
  ...process.env,
  NODE_OPTIONS: '',
  npm_config_cache: join(temporary, 'cache'),
};
const run = (command, args, cwd = temporary) =>
  execFileSync(command, args, {
    cwd,
    env: environment,
    encoding: 'utf8',
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
try {
  for (const project of ['core', 'html'])
    run(
      'yarn',
      ['pack', '--out', join(temporary, `${project}.tgz`)],
      join(root, project),
    );
  writeFileSync(
    join(temporary, 'package.json'),
    JSON.stringify({
      name: 'editorjs-html-packed-consumer',
      version: '0.0.0',
      private: true,
      type: 'module',
      dependencies: {
        '@anarchitects/editorjs-core': 'file:./core.tgz',
        '@anarchitects/editorjs-html': 'file:./html.tgz',
      },
    }),
  );
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']);
  const packageRoot = join(
    temporary,
    'node_modules/@anarchitects/editorjs-html',
  );
  const manifest = JSON.parse(
    readFileSync(join(packageRoot, 'package.json'), 'utf8'),
  );
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
    '@anarchitects/editorjs-core',
    'sanitize-html',
  ]);
  assert.equal(manifest.dependencies['@anarchitects/editorjs-core'], '^0.0.1');
  assert.equal(manifest.dependencies['sanitize-html'], '2.18.1');
  assert.deepEqual(Object.keys(manifest.peerDependencies ?? {}), []);
  assert.equal(
    readFileSync(join(packageRoot, 'README.md'), 'utf8'),
    readFileSync(join(root, 'html/README.md'), 'utf8'),
  );
  assert.equal(
    readFileSync(join(packageRoot, 'LICENSE'), 'utf8'),
    readFileSync(join(root, 'html/LICENSE'), 'utf8'),
  );
  assert.equal(
    readdirSync(packageRoot).some((name) =>
      ['src', 'tests', 'tools'].includes(name),
    ),
    false,
  );
  const lock = JSON.parse(
    readFileSync(join(temporary, 'package-lock.json'), 'utf8'),
  );
  assert.equal(
    Object.keys(lock.packages).some((name) =>
      /@(?:angular|editorjs|nestjs|nx)\//.test(name),
    ),
    false,
  );
  for (const name of [
    'node',
    'vite',
    'typescript',
    '@types/node',
    '@anarchitects/editorjs-angular',
  ])
    assert.equal(Object.hasOwn(lock.packages, `node_modules/${name}`), false);
  const source = `
    import assert from 'node:assert/strict';
    for(const name of ['window','document','HTMLElement','navigator','EditorJS']) Object.defineProperty(globalThis,name,{get(){throw Error('Unexpected browser global '+name)}});
    const {renderEditorJsHtml,createEditorJsHtmlRenderer}=await import('@anarchitects/editorjs-html');
    assert.equal(typeof createEditorJsHtmlRenderer,'function');
    assert.deepEqual(renderEditorJsHtml({blocks:[{type:'paragraph',data:{text:'Hello <b>world</b>'}}]}),{status:'success',html:'<p>Hello <b>world</b></p>',diagnostics:[]});
    const failure=renderEditorJsHtml({blocks:[{type:'paragraph',data:{text:'<img src=x onerror=alert(1)>'}}]});
    assert.equal(failure.status,'failure');assert.equal('html' in failure,false);
    await assert.rejects(import('@anarchitects/editorjs-html/dist/lib/safety.js'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
  `;
  run(process.execPath, ['--input-type=module', '-e', source]);
  const examples = [
    ...readFileSync(join(packageRoot, 'README.md'), 'utf8').matchAll(
      /```ts\n([\s\S]*?)```/g,
    ),
  ].map((match) => match[1]);
  assert.ok(examples.length > 0);
  const files = examples.map((example, index) => {
    const name = `example-${index}.mts`;
    writeFileSync(join(temporary, name), example);
    return name;
  });
  writeFileSync(
    join(temporary, 'public-contract.mts'),
    `import type {
      EditorJsHtmlRenderer, HtmlRendererOptions, HtmlRenderResult,
      HtmlDiagnostic, HtmlDiagnosticCode, HtmlRenderLimits, HtmlUrlPolicy, HtmlClasses,
    } from '@anarchitects/editorjs-html';
    export function check(renderer: EditorJsHtmlRenderer, input: unknown) {
      const result: HtmlRenderResult = renderer.render(input);
      const diagnostics: readonly HtmlDiagnostic[] = result.diagnostics;
      const codes: readonly HtmlDiagnosticCode[] = diagnostics.map(item => item.code);
      if (result.status === 'failure') {
        // @ts-expect-error Failure must never expose partial HTML.
        const forbidden: string = result.html;
        return codes;
      }
      const html: string = result.html;
      return html;
    }
    const limits: HtmlRenderLimits = { maxBlocks: 2 };
    const urls: HtmlUrlPolicy = { httpsOnly: true };
    const classes: HtmlClasses = { paragraph: ['content'] };
    export const options: HtmlRendererOptions = { limits, urls, classes };
    // @ts-expect-error No sanitizer bypass is public.
    export const unsafe: HtmlRendererOptions = { sanitize: false };
    // @ts-expect-error No implicit fallback mode is public.
    export const fallback: HtmlRendererOptions = { mode: 'fallback' };
    `,
  );
  for (const resolution of ['NodeNext', 'Bundler']) {
    writeFileSync(
      join(temporary, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          skipLibCheck: false,
          target: 'ES2022',
          lib: ['ES2022'],
          types: [],
          module: resolution === 'NodeNext' ? 'NodeNext' : 'ESNext',
          moduleResolution: resolution,
          outDir: 'compiled',
        },
        files: [...files, 'public-contract.mts'],
      }),
    );
    run(process.execPath, [
      require.resolve('typescript/bin/tsc'),
      '-p',
      'tsconfig.json',
    ]);
    for (let index = 0; index < files.length; index++)
      run(process.execPath, [`compiled/example-${index}.mjs`]);
  }
  const bundle = await build({
    stdin: {
      contents: "export * from '@anarchitects/editorjs-html';",
      resolveDir: temporary,
    },
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'renderer',
    minify: true,
    metafile: true,
    write: false,
    logLevel: 'silent',
  });
  assert.equal(
    Object.keys(bundle.metafile.inputs).some((name) =>
      /@(?:angular|editorjs|nestjs|nx)\//.test(name),
    ),
    false,
  );
  let browserVersion = null;
  if (process.argv.includes('--browser')) {
    const browser = await chromium.launch({ headless: true });
    try {
      browserVersion = browser.version();
      const page = await browser.newPage();
      let requests = 0;
      await page.route('**/*', (route) => {
        requests++;
        return route.abort();
      });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      const html = await page.evaluate(() => {
        const result = globalThis.renderer.renderEditorJsHtml(
          {
            blocks: [
              {
                type: 'paragraph',
                data: {
                  text: '<b>Safe</b><img src="https://example.invalid/x" onerror="globalThis.__executed=true"><a href="jav&#x61;script:alert(1)">link</a>',
                },
              },
            ],
          },
          { mode: 'preview' },
        );
        if (result.status !== 'preview' || result.diagnostics.length === 0)
          throw Error('Missing preview diagnostics');
        return result.html;
      });
      await page.setContent(html);
      await page.waitForTimeout(100);
      assert.deepEqual(
        await page.evaluate(() => ({
          text: document.body.textContent,
          images: document.images.length,
          href: document.querySelector('a').getAttribute('href'),
          executed: !!globalThis.__executed,
        })),
        { text: 'Safelink', images: 0, href: null, executed: false },
      );
      assert.equal(requests, 0);
      // Positive control: the harness must observe unsafe raw output executing.
      await page.setContent(
        '<img src="https://example.invalid/control" onerror="globalThis.__executed=true">',
      );
      await page.waitForFunction(() => globalThis.__executed === true);
      assert.equal(requests, 1);
    } finally {
      await browser.close();
    }
  }
  console.log(
    JSON.stringify(
      {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        coreSha256: sha(readFileSync(join(temporary, 'core.tgz'))),
        htmlSha256: sha(readFileSync(join(temporary, 'html.tgz'))),
        lockSha256: sha(readFileSync(join(temporary, 'package-lock.json'))),
        browserBundleBytes: bundle.outputFiles[0].contents.length,
        chromium: browserVersion,
        readmeExamples: examples.length,
        installedPackages: Object.keys(lock.packages).filter(Boolean),
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
