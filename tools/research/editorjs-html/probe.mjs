// Research harness only: deliberately observes unsafe candidate output, not a renderer.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

assert.equal(
  process.argv.length,
  4,
  'Usage: node probe.mjs CONSUMER_DIRECTORY RESULTS_DIRECTORY',
);
const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const requireWorkspace = createRequire(import.meta.url);
const consumer = resolve(process.argv[2]);
const destination = resolve(process.argv[3]);
await mkdir(destination, { recursive: true });
const requireConsumer = createRequire(join(consumer, 'package.json'));
const fixtures = JSON.parse(
  await readFile(new URL('./fixtures.json', import.meta.url), 'utf8'),
);
const packages = ['editorjs-parser', 'editorjs-html', 'editorjs-to-html'];
const expected = JSON.parse(
  await readFile(new URL('./consumer.json', import.meta.url), 'utf8'),
);
for (const [name, version] of Object.entries(expected.dependencies)) {
  const manifest = JSON.parse(
    await readFile(
      join(consumer, 'node_modules', name, 'package.json'),
      'utf8',
    ),
  );
  assert.equal(
    manifest.version,
    version,
    `Unexpected installed ${name} version`,
  );
}
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const result = {
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  tooling: Object.fromEntries(
    ['typescript', 'esbuild', '@playwright/test'].map((name) => [
      name,
      requireWorkspace(`${name}/package.json`).version,
    ]),
  ),
  lockSha256: sha(await readFile(join(consumer, 'package-lock.json'))),
  fixturesSha256: sha(
    await readFile(new URL('./fixtures.json', import.meta.url)),
  ),
  packages: {},
  sanitizers: {},
};
// Resolve public neutral entries via the repository's existing source condition.
// This is source-contract evidence, not a packed-consumer proof.
const contractBundle = await build({
  stdin: {
    contents: `
  import {validateOutputData} from '@anarchitects/editorjs-core';
  import {validateParagraphData} from '@anarchitects/editorjs-tool-paragraph';
  import {validateHeaderData} from '@anarchitects/editorjs-tool-header';
  import {validateQuoteData} from '@anarchitects/editorjs-tool-quote';
  import {validateListData} from '@anarchitects/editorjs-tool-list';
  import {validateImageData} from '@anarchitects/editorjs-tool-image';
  const validators = new Map([['paragraph',validateParagraphData],['header',validateHeaderData],['heading',validateHeaderData],['quote',validateQuoteData],['list',validateListData],['image',validateImageData]]);
  export const validate = input => validateOutputData(input,{toolValidators:validators,unknownTools:'reject'});
`,
    resolveDir: workspace,
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  conditions: ['@anarchitecture-community/source'],
  metafile: true,
  write: false,
  logLevel: 'silent',
});
await writeFile(
  join(destination, 'contract-probe.mjs'),
  contractBundle.outputFiles[0].text,
);
const contracts = await import(
  pathToFileURL(join(destination, 'contract-probe.mjs')).href
);
result.contracts = {
  inputs: Object.keys(contractBundle.metafile.inputs).map((path) =>
    relative(workspace, resolve(path)),
  ),
  cases: fixtures.map((fixture) => ({
    name: fixture.name,
    result: contracts.validate({
      version: '2.31.7',
      blocks: fixture.blocks ?? [fixture.block],
    }),
  })),
};
const browser = await chromium.launch({ headless: true });
result.chromium = browser.version();
try {
  for (const name of packages) {
    const root = join(consumer, 'node_modules', name);
    const manifest = JSON.parse(
      await readFile(join(root, 'package.json'), 'utf8'),
    );
    const entry = requireConsumer.resolve(name);
    const factory =
      name === 'editorjs-parser'
        ? 'new candidate({}, custom ? {callout: (data) => data.text} : {})'
        : 'candidate(custom ? {callout: (block) => block.data.text} : {}, {strict: true})';
    const observation = (result.packages[name] = {
      version: manifest.version,
      license: manifest.license,
      dependencies: manifest.dependencies ?? {},
      peers: manifest.peerDependencies ?? {},
      engines: manifest.engines ?? {},
      exports: manifest.exports ?? null,
      main: manifest.main,
      module: manifest.module ?? null,
      types: manifest.types ?? null,
      licenseSha256: sha(await readFile(join(root, 'LICENSE'))),
      entrySha256: sha(await readFile(entry)),
    });
    // Distinguish an actually absent DOM from a stronger access-trap diagnostic.
    for (const mode of ['esm', 'cjs', 'esmTrapped', 'cjsTrapped']) {
      const script = `
        ${mode.endsWith('Trapped') ? "for (const key of ['window','document','HTMLElement']) Object.defineProperty(globalThis,key,{get(){throw Error('browser global: '+key)}});" : ''}
        try {
          const mod = ${mode.startsWith('esm') ? `await import(${JSON.stringify(name)})` : `require(${JSON.stringify(name)})`};
          const candidate = mod.default ?? mod;
          const custom = false;
          const parser = ${factory};
          const cases = ${JSON.stringify(fixtures)}.map(fixture => {
            const custom = fixture.custom ?? false;
            const parser = ${factory};
            try { return {name:fixture.name,html:parser.parse({version:'2.31.7',blocks:fixture.blocks ?? [fixture.block]})}; }
            catch(error) {return {name:fixture.name,error:error.message};}
          });
          console.log(JSON.stringify({ok:true,html:parser.parse({blocks:[{type:'paragraph',data:{text:'Node probe'}}]}),cases}));
        } catch(error) { console.log(JSON.stringify({ok:false,error:error.message})); }
      `;
      const run = spawnSync(
        process.execPath,
        [
          ...(mode.startsWith('esm') ? ['--input-type=module'] : []),
          '-e',
          script,
        ],
        { cwd: consumer, encoding: 'utf8', timeout: 10000 },
      );
      assert.equal(
        run.status,
        0,
        `${name} ${mode} probe process failed: ${run.error ?? run.stderr}`,
      );
      observation[mode] = {
        ...JSON.parse(run.stdout),
        stderr: run.stderr.replaceAll(consumer, '<consumer>').trim(),
      };
    }
    // Probe actual public declarations without ambient workspace types or skipLibCheck.
    await writeFile(
      join(consumer, 'probe.mts'),
      `import renderer from '${name}';\nvoid renderer;\n`,
    );
    for (const module of ['NodeNext', 'Bundler']) {
      // types:[] prevents accidental workspace ambient-type support.
      await writeFile(
        join(consumer, 'tsconfig.probe.json'),
        JSON.stringify({
          compilerOptions: {
            noEmit: true,
            strict: true,
            skipLibCheck: false,
            target: 'ES2022',
            lib: ['ES2022'],
            module: module === 'Bundler' ? 'ESNext' : module,
            moduleResolution: module,
            types: [],
          },
          files: ['probe.mts'],
        }),
      );
      const check = spawnSync(
        process.execPath,
        [
          createRequire(import.meta.url).resolve('typescript/bin/tsc'),
          '-p',
          'tsconfig.probe.json',
        ],
        { cwd: consumer, encoding: 'utf8', timeout: 20000 },
      );
      assert.notEqual(
        check.status,
        null,
        `${name} ${module} declaration probe did not complete: ${check.error}`,
      );
      observation[`types${module}`] = {
        status: check.status,
        output: (check.stdout + check.stderr)
          .replaceAll(consumer, '<consumer>')
          .trim(),
      };
    }
    const source = `import candidate from ${JSON.stringify(name)}; globalThis.makeCandidate = (custom) => ${factory};`;
    const bundle = await build({
      stdin: { contents: source, resolveDir: consumer },
      bundle: true,
      platform: 'browser',
      format: 'iife',
      write: false,
      minify: true,
      logLevel: 'silent',
    });
    observation.browserBundleBytes = bundle.outputFiles[0].contents.length;
    const page = await browser.newPage();
    let requests = 0;
    await page.route('**/*', (route) => {
      requests++;
      return route.abort();
    });
    await page.setContent(
      '<!doctype html><html><head></head><body></body></html>',
    );
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    observation.importStyleElements = await page.locator('style').count();
    observation.cases = [];
    for (const fixture of fixtures) {
      const document = {
        version: '2.31.7',
        blocks: fixture.blocks ?? [fixture.block],
      };
      const rendered = await page.evaluate(
        ({ document, custom }) => {
          const before = JSON.stringify(document);
          const parser = globalThis.makeCandidate(custom);
          try {
            const html = parser.parse(document);
            return {
              html,
              deterministic: html === parser.parse(document),
              mutated: JSON.stringify(document) !== before,
            };
          } catch (error) {
            return {
              error: error.message,
              mutated: JSON.stringify(document) !== before,
            };
          }
        },
        { document, custom: fixture.custom ?? false },
      );
      if (typeof rendered.html === 'string') {
        await page.evaluate(() => {
          globalThis.__spikeExecuted = false;
        });
        await page.setContent(rendered.html);
        await page.waitForTimeout(50); // Bounded observation window, not a security pass assertion.
        rendered.dom = await page.evaluate(() => ({
          executed: globalThis.__spikeExecuted,
          html: document.body.innerHTML,
          images: [...document.images].map((i) => ({
            alt: i.getAttribute('alt'),
            src: i.getAttribute('src'),
          })),
          links: [...document.querySelectorAll('a')].map((a) =>
            a.getAttribute('href'),
          ),
          orderedLists: [...document.querySelectorAll('ol')].map((e) => ({
            start: e.getAttribute('start'),
            type: e.getAttribute('type'),
          })),
        }));
      }
      observation.cases.push({ name: fixture.name, ...rendered });
    }
    observation.blockedNetworkRequests = requests;
    for (const mode of ['esm', 'cjs']) {
      observation[`${mode}BrowserParity`] =
        observation[mode].ok &&
        observation.cases.every(
          (c, i) =>
            c.html === observation[mode].cases[i].html &&
            c.error === observation[mode].cases[i].error,
        );
    }
    if (name === 'editorjs-parser') {
      observation.instanceIsolation = await page.evaluate(() => {
        const first = globalThis.makeCandidate(false);
        const second = globalThis.makeCandidate(false);
        first.config.paragraph.pClass = 'changed-by-other-instance';
        return {
          secondInstanceHtml: second.parse({
            blocks: [{ type: 'paragraph', data: { text: 'Other instance' } }],
          }),
        };
      });
    }
    await page.close();
  }
  for (const name of ['sanitize-html', 'dompurify']) {
    const entry = requireConsumer.resolve(name);
    const module = await import(pathToFileURL(entry).href);
    const sanitizer = module.default ?? module;
    const dirty =
      '<p>Hello <b>bold</b><img src="https://example.invalid/x" onerror="globalThis.__spikeExecuted=true"><a href="jav&#x61;script:alert(1)">link</a></p>';
    const options = {
      allowedTags: ['p', 'b', 'a', 'img'],
      allowedAttributes: { a: ['href'], img: ['src', 'alt'] },
      allowedSchemes: ['https'],
      allowProtocolRelative: false,
      parseStyleAttributes: false,
    };
    const node =
      name === 'sanitize-html'
        ? { html: sanitizer(dirty, options) }
        : {
            isSupported: sanitizer.isSupported,
            hasSanitize: typeof sanitizer.sanitize === 'function',
          };
    const bundle = await build({
      stdin: {
        contents: `import sanitize from ${JSON.stringify(name)}; globalThis.sanitizeProbe = sanitize;`,
        resolveDir: consumer,
      },
      bundle: true,
      platform: 'browser',
      format: 'iife',
      write: false,
      minify: true,
      logLevel: 'silent',
    });
    const page = await browser.newPage();
    await page.route('**/*', (r) => r.abort());
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const html = await page.evaluate(
      ({ name, dirty, options }) =>
        name === 'sanitize-html'
          ? globalThis.sanitizeProbe(dirty, options)
          : globalThis.sanitizeProbe.sanitize(dirty),
      { name, dirty, options },
    );
    result.sanitizers[name] = {
      node,
      browserHtml: html,
      browserBundleBytes: bundle.outputFiles[0].contents.length,
    };
    if (name === 'sanitize-html') assert.equal(html, node.html);
    await page.close();
  }
  result.installedPackages = (
    await readdir(join(consumer, 'node_modules'))
  ).filter((n) => !n.startsWith('.'));
  await writeFile(
    join(destination, 'results.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      candidates: packages.length,
      casesPerCandidate: fixtures.length,
      chromium: result.chromium,
      output: join(destination, 'results.json'),
    }),
  );
} finally {
  await browser.close();
}
