import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

/** Exercise the shared corpus against the installed archive already loaded on page. */
export async function adversarialBrowser(page) {
  const fixtures = await build({
    entryPoints: [
      fileURLToPath(
        new URL('../tests/adversarial-fixtures.ts', import.meta.url),
      ),
    ],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'corpus',
  });
  await page.addScriptTag({ content: fixtures.outputFiles[0].text });
  const observed = [];
  const observe = (request) => observed.push(request.url());
  page.on('request', observe);
  try {
    const cases = await page.evaluate(() => {
      const { attacks, routes, scenario, invalidFragments } = globalThis.corpus;
      const render = globalThis.renderer.renderEditorJsHtml;
      const cases = [];
      for (const route of routes)
        for (const [name, markup] of attacks) {
          const { input, options } = scenario(route, markup);
          // Exercise defaults and the origin restriction separately. Allowed HTTP
          // images may load in preview even when a removed event causes diagnostics.
          for (const narrowed of [false, true]) {
            const policy = narrowed
              ? { urls: { allowedOrigins: ['https://assets.invalid'] } }
              : {};
            const strict = render(input, { ...options, ...policy });
            const preview = render(input, {
              ...options,
              ...policy,
              mode: 'preview',
            });
            if (
              strict.status !== 'failure' ||
              'html' in strict ||
              preview.status !== 'preview' ||
              !preview.diagnostics.length
            )
              throw Error(`${route}/${name}: result contract`);
            cases.push({
              name: `${route}/${name}/${narrowed}`,
              html: preview.html,
              narrowed,
            });
          }
        }
      for (const route of ['custom', 'override', 'tune'])
        for (const markup of invalidFragments) {
          const { input, options } = scenario(route, markup);
          const result = render(input, { ...options, mode: 'preview' });
          if (
            result.status !== 'preview' ||
            result.html !== '' ||
            !result.diagnostics.some((item) => item.code === 'unsafe_html')
          )
            throw Error(`${route}: invalid content model accepted`);
        }
      return cases;
    });
    // Each fragment is parsed in a normal flow container, including a second
    // serialization/parsing pass to catch mutation differences. Never interpolate
    // a fragment into an attribute, script, style, table or interactive container.
    for (const narrowed of [false, true]) {
      observed.length = 0;
      const subset = cases.filter((entry) => entry.narrowed === narrowed);
      const expected = await page.evaluate((cases) => {
        globalThis.__executed = false;
        document.body.innerHTML = '';
        const expected = new Set();
        for (const entry of cases) {
          const host = document.createElement('div');
          host.innerHTML = entry.html;
          const serialized = host.innerHTML;
          host.innerHTML = serialized;
          document.body.append(host);
          for (const element of host.querySelectorAll('*')) {
            if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml')
              throw Error(entry.name + ': namespace');
            if (
              element.matches(
                'script,style,iframe,object,embed,svg,math,form,input,button,template,textarea',
              )
            )
              throw Error(entry.name + ': active element');
            for (const attr of element.attributes) {
              if (
                /^on/i.test(attr.name) ||
                [
                  'style',
                  'target',
                  'rel',
                  'id',
                  'name',
                  'srcdoc',
                  'srcset',
                ].includes(attr.name)
              )
                throw Error(entry.name + ': attribute ' + attr.name);
            }
            if (element.matches('a')) {
              const href = element.getAttribute('href');
              if (href && !href.startsWith('#'))
                throw Error(entry.name + ': unexpected link');
              element.click();
            }
            if (element.matches('img')) {
              if (!element.hasAttribute('alt'))
                throw Error(entry.name + ': missing alt');
              expected.add(element.src);
            }
          }
        }
        return [...expected].sort();
      }, subset);
      // All requests are aborted by the parent harness; wait for image error
      // dispatch rather than relying on an arbitrary timeout for event execution.
      await page.waitForFunction(() =>
        [...document.images].every((image) => image.complete),
      );
      assert.equal(await page.evaluate(() => !!globalThis.__executed), false);
      assert.deepEqual([...new Set(observed)].sort(), expected);
      assert.ok(
        expected.every((url) =>
          narrowed
            ? url === 'https://assets.invalid/allowed.png'
            : /https:\/\/(assets|attack)\.invalid\//.test(url),
        ),
      );
      assert.ok(expected.includes('https://assets.invalid/allowed.png'));
      if (!narrowed)
        assert.ok(expected.includes('https://attack.invalid/pixel'));
    }
    // Caption is not alt; decorative images disappear from the accessibility
    // tree, authored alt remains, heading levels and link names are not rewritten.
    const semantic = await page.evaluate(() => {
      const { imageData } = globalThis.corpus;
      const result = globalThis.renderer.renderEditorJsHtml({
        blocks: [
          { type: 'header', data: { level: 2, text: 'Article heading' } },
          {
            type: 'paragraph',
            data: { text: '<a href="#read">Read article</a>' },
          },
          {
            type: 'quote',
            data: {
              text: 'Quotation',
              caption: 'Attribution',
              alignment: 'left',
            },
          },
          {
            type: 'image',
            data: { ...imageData('A mountain'), caption: 'Mountain caption' },
          },
          {
            type: 'image',
            data: { ...imageData(''), caption: 'Decorative caption' },
          },
        ],
      });
      if (result.status !== 'success') throw Error(JSON.stringify(result));
      document.body.innerHTML = result.html;
      return {
        headings: [...document.querySelectorAll('h2')].map(
          (node) => node.textContent,
        ),
        captions: [...document.querySelectorAll('figure > figcaption')].map(
          (node) => node.textContent,
        ),
        alts: [...document.images].map((node) => node.getAttribute('alt')),
        quote: document.querySelector('figure > blockquote > p')?.textContent,
        linkTarget: document.querySelector('a').target,
      };
    });
    assert.deepEqual(semantic, {
      headings: ['Article heading'],
      captions: ['Attribution', 'Mountain caption', 'Decorative caption'],
      alts: ['A mountain', ''],
      quote: 'Quotation',
      linkTarget: '',
    });
    const accessibility = await page.locator('body').ariaSnapshot();
    assert.match(accessibility, /heading "Article heading" \[level=2\]/);
    assert.match(accessibility, /link "Read article"/);
    assert.match(accessibility, /img "A mountain"/);
    assert.equal((accessibility.match(/\bimg\b/g) ?? []).length, 1);
    return {
      attackCases: cases.length,
      semanticOmissions: 30,
      accessibility: true,
    };
  } finally {
    page.off('request', observe);
  }
}
