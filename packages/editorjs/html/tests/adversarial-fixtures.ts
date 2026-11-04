import type { HtmlRendererOptions, HtmlStandardProfile } from '../src/index.js';

// Shared by unit tests and the packed Chromium harness; no renderer implementation.
export const attacks = [
  ['event', '<b onclick="globalThis.__executed=true">click</b>'],
  ['script', '<script>globalThis.__executed=true</script>'],
  [
    'image-event',
    '<img src="https://attack.invalid/pixel" alt="" onerror="globalThis.__executed=true">',
  ],
  [
    'mixed-protocol',
    '<a href="JaVaScRiPt:globalThis.__executed=true">click</a>',
  ],
  [
    'entity-protocol',
    '<a href="jav&#x61;script:globalThis.__executed=true">click</a>',
  ],
  [
    'control-protocol',
    '<a href="java&#9;&#10;&#13;script:globalThis.__executed=true">click</a>',
  ],
  [
    'encoded-protocol',
    '<a href="javascript%3aglobalThis.__executed=true">click</a>',
  ],
  ['protocol-relative', '<a href="//attack.invalid/path">click</a>'],
  ['backslash', '<a href="/&#92;attack.invalid/path">click</a>'],
  ['data', '<a href="data:text/html,unsafe">click</a>'],
  ['vbscript', '<a href="vbscript:msgbox(1)">click</a>'],
  ['blob', '<a href="blob:https://attack.invalid/id">click</a>'],
  ['file', '<a href="file:///secret">click</a>'],
  ['credentials', '<a href="https://user:secret@attack.invalid">click</a>'],
  [
    'css-url',
    '<mark style="background:url(https://attack.invalid/style)">text</mark>',
  ],
  ['target', '<a href="#safe" target="_blank" rel="opener">click</a>'],
  ['clobber', '<b id="renderer" name="__executed" data-value="x">text</b>'],
  [
    'svg',
    '<svg><a xlink:href="javascript:globalThis.__executed=true">click</a></svg>',
  ],
  [
    'math',
    '<math><mtext><img src="https://attack.invalid/math" alt="" onerror="globalThis.__executed=true"></mtext></math>',
  ],
  [
    'svg-rcdata',
    '<svg><textarea><img src="https://attack.invalid/rcdata" alt="" onerror="globalThis.__executed=true"></textarea></svg>',
  ],
  [
    'math-mutation',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=https://attack.invalid/mutation onerror=globalThis.__executed=true>">',
  ],
  [
    'rawtext',
    '<textarea><img src="https://attack.invalid/raw" onerror="globalThis.__executed=true"></textarea/>',
  ],
  [
    'iframe',
    '<iframe srcdoc="<script>globalThis.__executed=true</script>"></iframe>',
  ],
  [
    'template',
    '<template><img src="https://attack.invalid/template" onerror="globalThis.__executed=true"></template>',
  ],
  ['misnested', '<b><i>text</b></i>'],
  ['unclosed', '<strong>text'],
  ['nested-link', '<a href="#one"><a href="#two">click</a></a>'],
] as const;

export const invalidFragments = [
  '<ul><p>Not a list item</p></ul>',
  '<ol>Direct text<li>Item</li></ol>',
  '<li>Orphan</li>',
  '<figcaption>Orphan</figcaption>',
  '<figure><figcaption>First</figcaption><figcaption>Second</figcaption></figure>',
  '<figure><p>Before</p><figcaption>Middle</figcaption><p>After</p></figure>',
  '<figure>Before<figcaption>Middle</figcaption>After</figure>',
  '<span><div>Block in phrasing</div></span>',
  '<pre><section>Block in pre</section></pre>',
  '<p><a href="#safe"><div>Transparent link in paragraph</div></a></p>',
];
export const profiles: HtmlStandardProfile[] = [
  'paragraph',
  'header',
  'quote',
  'list',
  'image',
];
export const routes = [
  ...profiles,
  ...profiles.map((profile) => `alias-${profile}`),
  'custom',
  'override',
  'tune',
  'helper',
];
const any = (data: unknown): data is unknown => {
  void data;
  return true;
};
export function imageData(alt: string | undefined = '') {
  return {
    file: { url: 'https://assets.invalid/allowed.png' },
    alt,
    caption: '',
    withBorder: false,
    withBackground: false,
    stretched: false,
  };
}
export function scenario(route: string, markup: string) {
  const alias = route.startsWith('alias-');
  const profile = (alias ? route.slice(6) : route) as HtmlStandardProfile;
  const type = route === 'override' ? 'paragraph' : route;
  let data: object = {};
  const options: {
    -readonly [Key in keyof HtmlRendererOptions]: HtmlRendererOptions[Key];
  } = {};
  if (profiles.includes(profile)) {
    if (profile === 'paragraph') data = { text: markup };
    if (profile === 'header') data = { text: markup, level: 2 };
    if (profile === 'quote')
      data = { text: markup, caption: markup, alignment: 'left' };
    if (profile === 'list')
      data = {
        style: 'unordered',
        meta: {},
        items: [{ content: markup, meta: {}, items: [] }],
      };
    if (profile === 'image') data = { ...imageData(), caption: markup };
    if (alias) options.profiles = [{ name: route, profile }];
  } else {
    options.blocks = [
      {
        name: type,
        ...(route === 'override' ? { override: true } : {}),
        validate: any,
        render: (_data, context) =>
          route === 'tune'
            ? '<p>Original</p>'
            : route === 'helper'
              ? `<p>${context.inline(markup)}</p>`
              : markup,
      },
    ];
    if (route === 'tune')
      options.tunes = [{ name: 'wrap', validate: any, render: () => markup }];
  }
  return {
    input: {
      blocks: [
        { type, data, ...(route === 'tune' ? { tunes: { wrap: {} } } : {}) },
      ],
    },
    options,
  };
}
