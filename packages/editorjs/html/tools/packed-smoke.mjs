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
import { adversarialBrowser } from './adversarial-browser.mjs';
import { persistenceContracts, persistenceDom } from './persistence.mjs';
import { headlessRecipes, readmeExamples } from './readme-examples.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const prepared = process.env.EDITORJS_RENDERER_CONSUMER;
const phase = process.env.EDITORJS_RENDERER_PHASE;
const temporary =
  prepared ??
  realpathSync(mkdtempSync(join(tmpdir(), 'editorjs-html-packed-')));
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
  if (!prepared || phase === 'prepare') {
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
  }
  if (phase === 'prepare') process.exit(0);
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
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket']) Object.defineProperty(globalThis,name,{get(){throw Error('Unexpected I/O '+name)}});
    const http=await import('node:http');const https=await import('node:https');
    for(const module of [http.default,https.default]) for(const name of ['request','get']) module[name]=()=>{throw Error('Unexpected network call')};
    const {renderEditorJsHtml,createEditorJsHtmlRenderer}=await import('@anarchitects/editorjs-html');
    assert.equal(typeof createEditorJsHtmlRenderer,'function');
    assert.equal(renderEditorJsHtml({blocks:[{type:'image',data:{file:{url:'https://assets.invalid/not-fetched.png'},alt:'Authored',caption:'',withBorder:false,withBackground:false,stretched:false}}]}).status,'success');
    assert.deepEqual(renderEditorJsHtml({blocks:[{type:'paragraph',data:{text:'Hello <b>world</b>'}}]}),{status:'success',html:'<p>Hello <b>world</b></p>',diagnostics:[]});
    const failure=renderEditorJsHtml({blocks:[{type:'paragraph',data:{text:'<img src=x onerror=alert(1)>'}}]});
    assert.equal(failure.status,'failure');assert.equal('html' in failure,false);
    await assert.rejects(import('@anarchitects/editorjs-html/dist/lib/safety.js'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
  `;
  run(process.execPath, ['--input-type=module', '-e', source]);
  const examples = readmeExamples(
    readFileSync(join(packageRoot, 'README.md'), 'utf8'),
    headlessRecipes,
  );
  const files = [...examples].map(([name, example]) => {
    writeFileSync(join(temporary, name), example);
    return name;
  });
  writeFileSync(
    join(temporary, 'public-contract.mts'),
    `import type {
      EditorJsHtmlRenderer, HtmlRendererOptions, HtmlRenderResult,
      HtmlDiagnostic, HtmlDiagnosticCode, HtmlRenderLimits, HtmlUrlPolicy, HtmlClasses,
      HtmlReadonly, HtmlReadonlyJson, HtmlDataGuard, HtmlRenderContext,
      HtmlStandardProfile, HtmlProfileRegistration, HtmlBlockRegistration,
      HtmlTuneRegistration, HtmlBlockRegistrations, HtmlTuneRegistrations,
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
    type Data = { code: string; nested: { text: string } };
    const guard: HtmlDataGuard<Data> = (input): input is Data => {
      if (!input || typeof input !== 'object' || !('code' in input) || typeof input.code !== 'string' || !('nested' in input)) return false;
      return !!input.nested && typeof input.nested === 'object' && 'text' in input.nested && typeof input.nested.text === 'string';
    };
    const block: HtmlBlockRegistration<'code', Data> = {
      name: 'code', validate: guard, render: (data, context) => {
        const readonlyData: HtmlReadonly<Data> = data;
        const ctx: HtmlRenderContext = context;
        const json: HtmlReadonlyJson = ctx.block.data;
        // @ts-expect-error Data is deeply readonly.
        data.nested.text = 'forbidden';
        // @ts-expect-error Saved type has code, not callout text.
        const text: string = data.text;
        return ctx.escapeText(readonlyData.code);
      },
    };
    const tune: HtmlTuneRegistration<'flag', { flagged: boolean }> = {
      name: 'flag', validate: (data): data is { flagged: boolean } => !!data && typeof data === 'object' && 'flagged' in data && typeof data.flagged === 'boolean', ignore: true,
    };
    const profile: HtmlStandardProfile = 'image';
    const alias: HtmlProfileRegistration = { name: 'photo', profile };
    const blocks: HtmlBlockRegistrations<{ code: Data }>[] = [block];
    const tunes: HtmlTuneRegistrations<{ flag: { flagged: boolean } }>[] = [tune];
    export const registered: HtmlRendererOptions<{ code: Data }, { flag: { flagged: boolean } }> = { blocks, tunes, profiles: [alias] };
    // @ts-expect-error Async rendering is not supported.
    const asyncBlock: HtmlBlockRegistration = { name: 'bad', validate: (data): data is unknown => true, render: async () => '' };
    // @ts-expect-error Guard data and saved-name map must agree.
    const wrong: HtmlBlockRegistrations<{ code: Data }> = { name: 'code', validate: (data): data is string => typeof data === 'string', render: () => '' };
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
    for (const file of files)
      run(process.execPath, [`compiled/${file.replace(/\.mts$/, '.mjs')}`]);
    run(process.execPath, [
      '--input-type=module',
      '-e',
      `
      import assert from 'node:assert/strict';
      const quick = await import('./compiled/quick-start.mjs');
      assert.equal(quick.html, '<p>Hello <b>world</b></p>');
      const preview = await import('./compiled/preview.mjs');
      assert.equal(preview.previewHtml, '<p>Visible preview</p>');
      assert.ok(preview.diagnostics.length > 0);
      const { result: profile } = await import('./compiled/list-image.mjs');
      assert.equal(profile.status, 'success');
      assert.match(profile.html, /<ol start="3" type="I">/);
      assert.match(profile.html, /alt="A chocolate cake on a blue plate"/);
      const { result: configured } = await import('./compiled/configuration.mjs');
      assert.equal(configured.status, 'success');
      assert.equal(configured.html, '<p class="article-paragraph"><a href="https://example.com/blog">Read</a></p>');
      const { aliased } = await import('./compiled/alias.mjs');
      assert.equal(aliased.html, '<h2>A title</h2>');
      const { rendered } = await import('./compiled/custom.mjs');
      assert.equal(rendered.status, 'success');
      assert.match(rendered.html, /<div class="flagged"><aside class="callout-warning">A <mark>marked<\\/mark> warning<\\/aside><\\/div>/);
      assert.ok(rendered.html.includes('<pre><code>&lt;script&gt;literalExample()&lt;/script&gt;</code></pre>'));
    `,
    ]);
  }
  const persistence = persistenceContracts({
    temporary,
    root,
    run,
    compiler: require.resolve('typescript/bin/tsc'),
    sha,
  });
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
  let adversarialEvidence = null;
  let persistenceDomEvidence = null;
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
      // New profiles and extension callbacks execute from the installed archive.
      const profiles = await page.evaluate(() => {
        const input = {
          blocks: [
            {
              type: 'list',
              data: {
                style: 'ordered',
                meta: { start: 3, counterType: 'upper-roman' },
                items: [
                  {
                    content: 'Parent',
                    meta: { start: 2, counterType: 'lower-alpha' },
                    items: [{ content: 'Child', meta: {}, items: [] }],
                  },
                ],
              },
            },
            {
              type: 'list',
              data: {
                style: 'checklist',
                meta: {},
                items: [
                  {
                    content: 'Done task',
                    meta: { checked: true },
                    items: [
                      {
                        content: 'Pending task',
                        meta: { checked: false },
                        items: [],
                      },
                    ],
                  },
                ],
              },
            },
            {
              type: 'image',
              data: {
                file: { url: 'https://example.invalid/allowed.png' },
                alt: '" onerror="globalThis.__executed=true',
                caption: '<b>Caption</b>',
                withBorder: true,
                withBackground: false,
                stretched: false,
              },
            },
            {
              type: 'code',
              data: { code: '<script>globalThis.__executed=true</script>' },
              tunes: { flag: { flagged: true } },
            },
          ],
        };
        const result = globalThis.renderer.renderEditorJsHtml(input, {
          blocks: [
            {
              name: 'code',
              validate: (data) => typeof data.code === 'string',
              render: (data, ctx) =>
                '<pre><code>' + ctx.escapeText(data.code) + '</code></pre>',
            },
          ],
          tunes: [
            {
              name: 'flag',
              validate: (data) => typeof data.flagged === 'boolean',
              render: (html) => '<aside>' + html + '</aside>',
            },
          ],
        });
        if (result.status !== 'success')
          throw Error(JSON.stringify(result.diagnostics));
        return result.html;
      });
      await page.setContent(profiles);
      assert.deepEqual(
        await page.evaluate(() => ({
          rootStart: document.querySelector('ol').start,
          rootType: document.querySelector('ol').type,
          childStart: document.querySelector('ol ol').start,
          childType: document.querySelector('ol ol').type,
          alt: document.querySelector('img').alt,
          event: document.querySelector('img').getAttribute('onerror'),
          caption: document.querySelector('figcaption').textContent,
          code: document.querySelector('pre code').textContent,
          controls: document.querySelectorAll('input,button,[contenteditable]')
            .length,
          executed: !!globalThis.__executed,
        })),
        {
          rootStart: 3,
          rootType: 'I',
          childStart: 2,
          childType: 'a',
          alt: '" onerror="globalThis.__executed=true',
          event: null,
          caption: 'Caption',
          code: '<script>globalThis.__executed=true</script>',
          controls: 0,
          executed: false,
        },
      );
      const accessibility = await page.locator('body').ariaSnapshot();
      assert.ok(accessibility.includes('[Completed]'));
      assert.ok(accessibility.includes('[Not completed]'));
      assert.equal(requests, 1); // Only the deliberately permitted image.
      for (const route of ['custom', 'override', 'tune']) {
        const safe = await page.evaluate((route) => {
          const malicious =
            '<p style="color:red" onclick="globalThis.__executed=true">Safe</p><img src="javascript:alert(1)" alt=""><script>globalThis.__executed=true</script>';
          const result = globalThis.renderer.renderEditorJsHtml(
            {
              blocks: [
                {
                  type: route === 'override' ? 'paragraph' : 'custom',
                  data: {},
                  ...(route === 'tune' ? { tunes: { flag: {} } } : {}),
                },
              ],
            },
            {
              mode: 'preview',
              blocks: [
                {
                  name: route === 'override' ? 'paragraph' : 'custom',
                  ...(route === 'override' ? { override: true } : {}),
                  validate: () => true,
                  render: () =>
                    route === 'tune' ? '<p>Original</p>' : malicious,
                },
              ],
              ...(route === 'tune'
                ? {
                    tunes: [
                      {
                        name: 'flag',
                        validate: () => true,
                        render: () => malicious,
                      },
                    ],
                  }
                : {}),
            },
          );
          if (
            result.status !== 'preview' ||
            !result.diagnostics.some((item) => item.code === 'unsafe_html')
          )
            throw Error('Missing callback safety diagnostics');
          return result.html;
        }, route);
        await page.setContent(safe);
        assert.equal(
          await page.locator('img,script,[onclick],[style]').count(),
          0,
        );
        assert.equal(await page.evaluate(() => !!globalThis.__executed), false);
      }
      assert.equal(requests, 1);
      // Positive control: the harness must observe unsafe raw output executing.
      await page.setContent(
        '<img src="https://example.invalid/control" onerror="globalThis.__executed=true">',
      );
      await page.waitForFunction(() => globalThis.__executed === true);
      assert.equal(requests, 2);
      adversarialEvidence = await adversarialBrowser(page);
      persistenceDomEvidence = await persistenceDom(page, persistence.rendered);
    } finally {
      await browser.close();
    }
  }
  const summary = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    coreSha256: sha(readFileSync(join(temporary, 'core.tgz'))),
    htmlSha256: sha(readFileSync(join(temporary, 'html.tgz'))),
    lockSha256: sha(readFileSync(join(temporary, 'package-lock.json'))),
    browserBundleBytes: bundle.outputFiles[0].contents.length,
    chromium: browserVersion,
    adversarialEvidence,
    persistenceEvidence: {
      guides: persistence.guides,
      results: persistence.results,
      dom: persistenceDomEvidence,
    },
    runtimeVersions: Object.fromEntries(
      Object.entries(lock.packages)
        .filter(([name]) => name)
        .map(([name, value]) => [name, value.version]),
    ),
    readmeExamples: examples.size,
    readmeFiles: [...examples.keys()],
    installedPackages: Object.keys(lock.packages).filter(Boolean),
  };
  if (process.env.EDITORJS_RENDERER_REPORT) {
    writeFileSync(
      join(process.env.EDITORJS_RENDERER_REPORT, 'summary.json'),
      JSON.stringify(summary, null, 2),
    );
    writeFileSync(
      join(process.env.EDITORJS_RENDERER_REPORT, 'package-lock.json'),
      JSON.stringify(lock, null, 2),
    );
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  if (!prepared) rmSync(temporary, { recursive: true, force: true });
}
