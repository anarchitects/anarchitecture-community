import type { ToolConstructable, EditorConfig } from '@editorjs/editorjs';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  composeToolRegistry,
  createToolMap,
  EDITOR_JS_2_31_7_TOOL_PROFILE as profile,
  selectToolRegistry,
  ToolRegistryError,
  validateToolReferences,
  type BuiltInToolProfile,
  type ToolConfiguration,
  type ToolDefinition,
  type ToolRegistry,
  type ToolRegistryErrorCode,
} from '../src/index.js';

class Heading {
  readonly heading = true;
}
class AlternateHeading {
  readonly alternate = true;
}
class Alignment {
  readonly alignment = true;
}
const heading = {
  name: 'heading',
  kind: 'block',
  source: 'eager',
  registration: Heading,
} as const;
const alignment = {
  name: 'alignment',
  kind: 'tune',
  source: 'eager',
  registration: Alignment,
} as const;
const compose = (groups: unknown, builtIns: BuiltInToolProfile = profile) =>
  composeToolRegistry(groups as readonly (readonly ToolDefinition[])[], {
    profile: builtIns,
  });

function diagnostic(
  action: () => unknown,
  code: ToolRegistryErrorCode,
  name?: string,
) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ToolRegistryError);
    const result = error as ToolRegistryError;
    expect(result.code).toBe(code);
    if (name !== undefined) expect(result.toolName).toBe(name);
    expect(Object.isFrozen(result.path)).toBe(true);
    return result;
  }
  throw new Error('Expected a registry diagnostic');
}

describe('ordered registry composition', () => {
  it('composes all kinds, preserves names and applies whole-definition replacement', () => {
    const registry = composeToolRegistry(
      [
        [
          {
            ...heading,
            registration: {
              class: Heading,
              config: { old: true },
              inlineToolbar: ['bold'],
            },
          },
          alignment,
        ],
        [
          {
            name: 'custom/inline',
            kind: 'inline',
            source: 'eager',
            registration: Alignment,
          },
          {
            ...heading,
            replace: true,
            registration: { class: AlternateHeading, config: { next: true } },
          },
        ],
      ],
      { profile },
    );
    expect(registry.names).toEqual(['heading', 'alignment', 'custom/inline']);
    const tools = createToolMap(registry);
    expect(tools.heading).toEqual({
      class: AlternateHeading,
      config: { next: true },
    });
    expect(Object.keys(tools)).toEqual(registry.names);
    expect(Object.getPrototypeOf(tools)).toBeNull();
    expectTypeOf(tools.heading.class).toEqualTypeOf<typeof AlternateHeading>();
    expectTypeOf(tools.heading.config.next).toEqualTypeOf<true>();
    expectTypeOf(tools.alignment).toEqualTypeOf<typeof Alignment>();
  });

  it('retains possible value types when a later name is only known at runtime', () => {
    const runtimeName = String('other');
    const dynamic = { ...alignment, name: runtimeName };
    const tuple = createToolMap(
      composeToolRegistry([[heading, dynamic]], { profile }),
    );
    expectTypeOf(tuple['heading']).toEqualTypeOf<
      typeof Heading | typeof Alignment
    >();
    const group = [dynamic];
    const array = createToolMap(
      composeToolRegistry([[heading], group], { profile }),
    );
    expectTypeOf(array['heading']).toEqualTypeOf<
      typeof Heading | typeof Alignment
    >();
    expect(tuple['heading']).toBe(Heading);
    expect(array['heading']).toBe(Heading);
    const unionName = String('heading') as 'heading' | 'other';
    const union = createToolMap(
      composeToolRegistry(
        [
          [
            heading,
            {
              ...heading,
              name: unionName,
              replace: true,
              registration: AlternateHeading,
            },
          ],
        ],
        { profile },
      ),
    );
    expectTypeOf(union['heading']).toEqualTypeOf<
      typeof Heading | typeof AlternateHeading
    >();
    expect(union['heading']).toBe(AlternateHeading);
  });

  it('rejects every implicit duplicate and invalid replacement', () => {
    for (const replacement of [heading, { ...heading, kind: 'inline' }]) {
      diagnostic(
        () => compose([[heading, replacement]]),
        'duplicate-name',
        'heading',
      );
    }
    diagnostic(
      () => compose([[{ ...heading, replace: true }]]),
      'invalid-replacement',
      'heading',
    );
    diagnostic(
      () => compose([[heading, { ...heading, kind: 'tune', replace: true }]]),
      'invalid-replacement',
      'heading',
    );
    diagnostic(
      () => compose([[{ ...heading, name: 'paragraph' }]]),
      'duplicate-name',
      'paragraph',
    );
    for (const name of ['stub', 'convertTo']) {
      diagnostic(
        () => compose([[{ ...heading, name, replace: true }]]),
        'invalid-replacement',
        name,
      );
    }
  });

  it('seeds a base without replaying replacement commands or changing its siblings', () => {
    const parent = composeToolRegistry(
      [[{ ...heading, name: 'paragraph', replace: true }, alignment]],
      { profile },
    );
    const child = composeToolRegistry(
      [
        [
          {
            ...heading,
            name: 'paragraph',
            replace: true,
            registration: AlternateHeading,
          },
        ],
      ],
      { profile, base: parent },
    );
    expect(createToolMap(child).paragraph).toBe(AlternateHeading);
    expectTypeOf(createToolMap(child).paragraph).toEqualTypeOf<
      typeof AlternateHeading
    >();
    expect(createToolMap(parent).paragraph).toBe(Heading);
    expect(
      createToolMap(composeToolRegistry([], { profile, base: parent }))
        .paragraph,
    ).toBe(Heading);
    diagnostic(
      () => composeToolRegistry([], { profile: { tools: [] }, base: parent }),
      'invalid-profile',
    );
  });

  it('selects only requested names in order and narrows literal keys', () => {
    const registry = composeToolRegistry([[heading, alignment]], { profile });
    const selected = selectToolRegistry(registry, ['alignment', 'heading']);
    expect(Object.keys(createToolMap(selected))).toEqual([
      'alignment',
      'heading',
    ]);
    const single = createToolMap(selectToolRegistry(registry, ['heading']));
    expectTypeOf<keyof typeof single>().toEqualTypeOf<'heading'>();
    expect(single.heading).toBe(Heading);
    expect(selectToolRegistry(registry)).toBe(registry);
    expect(createToolMap(selectToolRegistry(registry, []))).toEqual({});
    for (const names of [['missing'], ['heading', 'heading'], ['bold']]) {
      diagnostic(
        () => selectToolRegistry(registry as ToolRegistry, names),
        'invalid-selection',
      );
    }
    // @ts-expect-error Literal selections cannot request an absent custom key.
    const invalidSelection = () => selectToolRegistry(registry, ['missing']);
    void invalidSelection;
  });

  it('snapshots containers but preserves opaque config, data, services and callbacks', () => {
    const service = new Alignment();
    const callback = () => service;
    const config = { nested: { values: [1] }, callback, service };
    const data = { title: 'original' };
    const registration = {
      class: Heading,
      config,
      inlineToolbar: ['bold'],
      tunes: ['alignment'],
      toolbox: [{ title: 'Heading', data }],
    };
    const definitions: ToolDefinition[] = [
      { ...heading, registration },
      alignment,
    ];
    const registry = composeToolRegistry([definitions], { profile });
    registration.inlineToolbar.push('not-registered');
    registration.toolbox[0].title = 'caller mutation';
    definitions.length = 0;
    const first = createToolMap(registry).heading as typeof registration;
    first.inlineToolbar.push('italic');
    first.toolbox[0].title = 'upstream mutation';
    const second = createToolMap(registry).heading as typeof registration;
    expect(second.inlineToolbar).toEqual(['bold']);
    expect(second.toolbox[0].title).toBe('Heading');
    expect(second.config).toBe(config);
    expect(second.config.callback).toBe(callback);
    expect(second.config.service).toBe(service);
    expect(second.toolbox[0].data).toBe(data);
    expect(Object.isFrozen(config)).toBe(false);
    expect(Object.isFrozen(data)).toBe(false);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.names)).toBe(true);
    expect(Object.isFrozen(registry.profile.tools[0])).toBe(true);
  });
});

describe('validation without evaluation', () => {
  it('does not construct tools, inspect static hooks, or invoke any loader', () => {
    const load = vi.fn(async () => Heading);
    const hook = vi.fn(() => {
      throw new Error('Do not inspect static hooks');
    });
    class Inert {
      constructor() {
        throw new Error('Do not construct');
      }
      static get prepare() {
        return hook();
      }
      static get isInline() {
        return hook();
      }
    }
    const registry = composeToolRegistry(
      [
        [
          { ...heading, registration: Inert },
          { name: 'lazy', kind: 'block', source: 'lazy', load },
        ],
      ],
      { profile },
    );
    validateToolReferences(registry);
    expect(
      createToolMap(selectToolRegistry(registry, ['heading'])).heading,
    ).toBe(Inert);
    diagnostic(() => createToolMap(registry), 'unresolved-tool', 'lazy');
    expect(load).not.toHaveBeenCalled();
    expect(hook).not.toHaveBeenCalled();
  });

  it.each([
    '',
    ' ',
    '__proto__',
    'prototype',
    'constructor',
    '0',
    '42',
    '4294967294',
  ])('rejects unsafe or order-ambiguous name %j', (name) => {
    diagnostic(() => compose([[{ ...heading, name }]]), 'invalid-name');
  });

  it('preserves exact non-index names and case', () => {
    const names = [
      '01',
      '4294967295',
      ' namespace/name ',
      'Heading',
      'heading',
    ];
    expect(
      compose([names.map((name) => ({ ...heading, name }))]).names,
    ).toEqual(names);
  });

  it.each([
    null,
    { ...heading, source: undefined },
    { ...heading, kind: 'unknown' },
    { ...heading, registration: {} },
    { ...heading, registration: { class: 'not-a-class' } },
    { ...heading, load: undefined },
    {
      name: 'lazy',
      kind: 'block',
      source: 'lazy',
      load: Heading,
      registration: Heading,
    },
    { ...heading, replace: false },
  ])('rejects malformed descriptors %j', (value) => {
    expect(() => compose([[value]])).toThrow(ToolRegistryError);
  });

  it.each([
    { config: null },
    { shortcut: 1 },
    { tunes: null },
    { inlineToolbar: 'bold' },
    { toolbox: true },
    { toolbox: { title: 2 } },
    { toolbox: { data: null } },
    { toolbox: { icon: false } },
    { tools: {} },
  ])('rejects malformed supported settings %j', (options) => {
    diagnostic(
      () =>
        compose([
          [{ ...heading, registration: { class: Heading, ...options } }],
        ]),
      'invalid-options',
      'heading',
    );
  });

  it('rejects inherited fields, sparse lists and accessors without running them', () => {
    const get = vi.fn(() => Heading);
    diagnostic(() => compose([[Object.create(heading)]]), 'invalid-definition');
    diagnostic(
      () =>
        compose([
          [{ ...heading, registration: Object.create({ class: Heading }) }],
        ]),
      'invalid-options',
      'heading',
    );
    const accessor = { ...heading };
    Object.defineProperty(accessor, 'registration', { get });
    diagnostic(() => compose([[accessor]]), 'invalid-definition');
    const settings = Object.defineProperty({}, 'class', { get });
    diagnostic(
      () => compose([[{ ...heading, registration: settings }]]),
      'invalid-options',
      'heading',
    );
    diagnostic(() => compose([new Array(1)]), 'invalid-definition');
    const toolbar = ['bold'];
    Object.defineProperty(toolbar, '0', { get });
    diagnostic(
      () =>
        compose([
          [
            {
              ...heading,
              registration: { class: Heading, inlineToolbar: toolbar },
            },
          ],
        ]),
      'invalid-options',
      'heading',
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('checks profiles and rejects forged registries', () => {
    for (const candidate of [
      null,
      {},
      { tools: [{ name: 'x', kind: 'bad' }] },
      {
        tools: [
          { name: 'x', kind: 'block' },
          { name: 'x', kind: 'block' },
        ],
      },
      { tools: [], defaultBlock: 'missing' },
    ]) {
      diagnostic(
        () => compose([], candidate as BuiltInToolProfile),
        'invalid-profile',
      );
    }
    diagnostic(
      () => createToolMap({ names: [], profile } as unknown as ToolRegistry),
      'invalid-registry',
    );
    const emptyProfile = { tools: [] } as const;
    const registry = composeToolRegistry([[heading]], {
      profile: emptyProfile,
    });
    diagnostic(() => createToolMap(registry), 'invalid-reference');
    expect(createToolMap(registry, { defaultBlock: 'heading' }).heading).toBe(
      Heading,
    );
  });
});

describe('reference validation and upstream contracts', () => {
  it('accepts built-ins and default/legacy precedence without custom registrations', () => {
    const registry = composeToolRegistry([], { profile });
    expect(() =>
      validateToolReferences(registry, {
        inlineToolbar: ['bold', 'italic', 'link', 'convertTo'],
        tunes: ['moveUp', 'delete', 'moveDown'],
      }),
    ).not.toThrow();
    expect(() =>
      validateToolReferences(registry, {
        defaultBlock: 'paragraph',
        initialBlock: 'missing',
      }),
    ).not.toThrow();
    expect(() =>
      validateToolReferences(registry, {
        defaultBlock: '',
        initialBlock: 'paragraph',
      }),
    ).not.toThrow();
    for (const defaultBlock of ['stub', 'convertTo', 'bold', 'missing'])
      diagnostic(
        () => validateToolReferences(registry, { defaultBlock }),
        'invalid-reference',
        defaultBlock,
      );
  });

  it('validates references only in selected blocks, including lazy settings', () => {
    const registry = composeToolRegistry(
      [
        [
          {
            ...heading,
            registration: {
              class: Heading,
              inlineToolbar: false,
              tunes: ['alignment'],
            },
          },
          alignment,
        ],
      ],
      { profile },
    );
    validateToolReferences(registry);
    const error = diagnostic(
      () => createToolMap(selectToolRegistry(registry, ['heading'])),
      'invalid-reference',
      'heading',
    );
    expect(error.path).toEqual(['tools', 'heading', 'tunes', 0]);
    expect(
      createToolMap(selectToolRegistry(registry, ['alignment'])).alignment,
    ).toBe(Alignment);
    const lazy = composeToolRegistry(
      [
        [
          {
            name: 'lazy',
            kind: 'block',
            source: 'lazy',
            load: async () => Heading,
            settings: { tunes: ['missing'] },
          },
        ],
      ],
      { profile },
    );
    diagnostic(() => validateToolReferences(lazy), 'invalid-reference', 'lazy');
  });

  it('rejects wrong-kind/repeated references even when UI is disabled; preserves false/empty options', () => {
    const registry = composeToolRegistry(
      [
        [
          {
            ...heading,
            registration: {
              class: Heading,
              inlineToolbar: [],
              tunes: false,
              toolbox: false,
            },
          },
        ],
      ],
      { profile },
    );
    expect(createToolMap(registry).heading).toEqual({
      class: Heading,
      inlineToolbar: [],
      tunes: false,
      toolbox: false,
    });
    for (const context of [
      { inlineToolbar: ['paragraph'] },
      { inlineToolbar: ['bold', 'bold'] },
      { tunes: ['bold'] },
      { tunes: ['delete', 'delete'] },
      { tunes: true },
    ]) {
      diagnostic(
        () => validateToolReferences(registry, context as never),
        'invalid-reference',
      );
    }
    const badBlock = compose([
      [
        {
          ...heading,
          registration: { class: Heading, inlineToolbar: ['missing'] },
        },
      ],
    ]);
    diagnostic(
      () => validateToolReferences(badBlock, { inlineToolbar: false }),
      'invalid-reference',
      'heading',
    );
  });

  it('preserves annotated config/data types and fits pinned upstream tool settings', () => {
    type Config = { transform: (text: string) => string };
    type Data = { text: string };
    const registration: ToolConfiguration<typeof Heading, Config, Data> = {
      class: Heading,
      config: { transform: (text) => text },
      toolbox: { data: { text: 'default' } },
    };
    const tools = createToolMap(
      composeToolRegistry([[{ ...heading, registration }]], { profile }),
    );
    expectTypeOf(tools.heading.config).toEqualTypeOf<Config | undefined>();
    expectTypeOf(tools.heading.class).toEqualTypeOf<typeof Heading>();
    expectTypeOf(tools.heading.toolbox).toEqualTypeOf<
      typeof registration.toolbox
    >();
    const upstream = createToolMap(
      composeToolRegistry(
        [
          [
            {
              ...heading,
              registration: Heading as unknown as ToolConstructable,
            },
          ],
        ],
        { profile },
      ),
    );
    expectTypeOf<{ tools: typeof upstream }>().toExtend<EditorConfig>();
    expect(upstream.heading).toBe(Heading);
    const invalidClass: ToolDefinition = {
      ...heading,
      // @ts-expect-error A lazy loader is not a constructor registration.
      registration: async () => Heading,
    };
    const invalidData: ToolDefinition<typeof Heading, Config, Data> = {
      ...heading,
      // @ts-expect-error Typed saved data rejects mismatched toolbox data.
      registration: { class: Heading, toolbox: { data: { text: 3 } } },
    };
    void invalidClass;
    void invalidData;
  });
});
