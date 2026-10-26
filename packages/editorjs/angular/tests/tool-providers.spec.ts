import '@angular/compiler';
import {
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  inject,
  InjectionToken,
  Injector,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createToolMap,
  createToolResolver,
  ToolRegistryError,
  type ToolDefinition,
} from '@anarchitects/editorjs-core';
import {
  EDITOR_JS_TOOL_REGISTRY,
  provideEditorJsTools,
  type EditorJsToolContribution,
} from '../src/index.js';
import { EDITOR_JS_TOOL_SCOPE } from '../src/lib/editorjs-tool-providers.js';

class Heading {
  readonly heading = true;
}
class Alternate {
  readonly alternate = true;
}
const heading = {
  name: 'heading',
  kind: 'block',
  source: 'eager',
  registration: Heading,
} as const;
const environments: EnvironmentInjector[] = [];
function environment(
  providers: (Provider | EnvironmentProviders)[] = [],
  parent = Injector.NULL as EnvironmentInjector,
) {
  const result = createEnvironmentInjector(providers, parent);
  environments.push(result);
  return result;
}
afterEach(() => {
  for (const owner of environments.reverse())
    if (!owner.destroyed) owner.destroy();
  environments.length = 0;
});
const registry = (owner: EnvironmentInjector) =>
  owner.get(EDITOR_JS_TOOL_REGISTRY);

describe('tool environment providers', () => {
  it('has no implicit root registry or provider requirement', () => {
    const owner = environment();
    expect(owner.get(EDITOR_JS_TOOL_REGISTRY, null)).toBeNull();
    expect(owner.get(EDITOR_JS_TOOL_SCOPE, null)).toBeNull();
  });

  it('constructs providers and resolves tokens without loading or constructing tools', () => {
    const load = vi.fn(async () => Heading);
    class Inert {
      constructor() {
        throw new Error('Do not construct');
      }
    }
    const factory = vi.fn(
      () =>
        [
          { ...heading, registration: Inert },
          { name: 'lazy', kind: 'block', source: 'lazy', load },
        ] as const,
    );
    const providers = provideEditorJsTools({ factory });
    expect(factory).not.toHaveBeenCalled();
    const owner = environment([providers]);
    expect(factory).not.toHaveBeenCalled();
    const snapshot = registry(owner);
    expect(snapshot.names).toEqual(['heading', 'lazy']);
    expect(registry(owner)).toBe(snapshot);
    expect(owner.get(EDITOR_JS_TOOL_SCOPE).registry).toBe(snapshot);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(load).not.toHaveBeenCalled();
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('combines repeated local contributions in order and delegates whole replacement to core', () => {
    const owner = environment([
      provideEditorJsTools([heading]),
      provideEditorJsTools([{ ...heading, name: 'other' }], { inherit: false }),
      provideEditorJsTools([
        { ...heading, replace: true, registration: Alternate },
      ]),
    ]);
    const snapshot = registry(owner);
    expect(snapshot.names).toEqual(['heading', 'other']);
    expect(createToolMap(snapshot)['heading']).toBe(Alternate);
    const duplicate = environment([
      provideEditorJsTools([heading]),
      provideEditorJsTools([heading]),
    ]);
    expect(() => registry(duplicate)).toThrow(
      expect.objectContaining({ code: 'duplicate-name', toolName: 'heading' }),
    );
  });

  it.each([
    [{}, { inherit: true }],
    [{}, { select: [] }],
    [{ select: ['heading', 'other'] }, { select: ['other', 'heading'] }],
  ])(
    'rejects inconsistent normalized scope options before running factories',
    (first, second) => {
      const factory = vi.fn(() => [heading]);
      const owner = environment([
        provideEditorJsTools({ factory }, first),
        provideEditorJsTools({ factory }, second),
      ]);
      expect(() => registry(owner)).toThrow(
        expect.objectContaining({
          code: 'invalid-options',
          path: ['providers', 1, 'options'],
        }),
      );
      expect(factory).not.toHaveBeenCalled();
    },
  );

  it('applies a shared selection after all contributions and snapshots option arrays', () => {
    const select = ['other', 'heading'];
    const first = provideEditorJsTools([heading], { select });
    select.reverse();
    const owner = environment([
      first,
      provideEditorJsTools([{ ...heading, name: 'other' }], {
        inherit: false,
        select: ['other', 'heading'],
      }),
    ]);
    expect(registry(owner).names).toEqual(['other', 'heading']);
    const empty = environment([
      provideEditorJsTools([heading], { select: [] }),
    ]);
    expect(registry(empty).names).toEqual([]);
    for (const names of [['missing'], ['heading', 'heading']]) {
      const invalid = environment([
        provideEditorJsTools([heading], { select: names }),
      ]);
      expect(() => registry(invalid)).toThrow(
        expect.objectContaining({ code: 'invalid-selection' }),
      );
    }
  });

  it('uses normal parent lookup without introducing a child snapshot or lifetime', () => {
    const parent = environment([provideEditorJsTools([heading])]);
    const child = environment([], parent);
    expect(registry(child)).toBe(registry(parent));
    expect(child.get(EDITOR_JS_TOOL_SCOPE)).toBe(
      parent.get(EDITOR_JS_TOOL_SCOPE),
    );
    expect(child.get(EDITOR_JS_TOOL_SCOPE).destroyRef).toBe(
      parent.get(DestroyRef),
    );
  });

  it('isolates local scopes by default and does not even resolve a hidden parent', () => {
    const factory = vi.fn(() => {
      throw new Error('Parent should stay unused');
    });
    const parent = environment([provideEditorJsTools({ factory })]);
    const child = environment([provideEditorJsTools([heading])], parent);
    const empty = environment([provideEditorJsTools([])], parent);
    expect(registry(child).names).toEqual(['heading']);
    expect(registry(empty).names).toEqual([]);
    expect(factory).not.toHaveBeenCalled();
  });

  it('inherits the selected parent without replaying replacement operations and preserves siblings', () => {
    const parent = environment([
      provideEditorJsTools(
        [
          { ...heading, name: 'paragraph', replace: true },
          heading,
          { ...heading, name: 'hidden' },
        ],
        { select: ['paragraph', 'heading'] },
      ),
    ]);
    const child = environment(
      [
        provideEditorJsTools(
          [
            { ...heading, replace: true, registration: Alternate },
            { ...heading, name: 'local' },
          ],
          { inherit: true, select: ['local', 'heading', 'paragraph'] },
        ),
      ],
      parent,
    );
    const sibling = environment(
      [provideEditorJsTools([], { inherit: true })],
      parent,
    );
    expect(registry(child).names).toEqual(['local', 'heading', 'paragraph']);
    expect(createToolMap(registry(child))['heading']).toBe(Alternate);
    expect(createToolMap(registry(parent))['heading']).toBe(Heading);
    expect(createToolMap(registry(sibling))['heading']).toBe(Heading);
    expect(registry(sibling)).not.toBe(registry(parent));
    expect(child.get(EDITOR_JS_TOOL_SCOPE).destroyRef).toBe(
      child.get(DestroyRef),
    );
    const excluded = environment(
      [provideEditorJsTools([], { inherit: true, select: ['hidden'] })],
      parent,
    );
    expect(() => registry(excluded)).toThrow(
      expect.objectContaining({ code: 'invalid-selection' }),
    );
    const noParent = environment([
      provideEditorJsTools([heading], { inherit: true }),
    ]);
    expect(registry(noParent).names).toEqual(['heading']);
  });

  it('evaluates DI factories once in their owner even when first requested by a child', () => {
    const SETTINGS = new InjectionToken<{ label: string }>('settings');
    const captured: string[] = [];
    const providers = provideEditorJsTools({
      factory: () => {
        const config = inject(SETTINGS);
        captured.push(config.label);
        return [{ ...heading, registration: { class: Heading, config } }];
      },
    });
    const parentConfig = { label: 'parent' };
    const parent = environment([
      { provide: SETTINGS, useValue: parentConfig },
      providers,
    ]);
    const child = environment(
      [{ provide: SETTINGS, useValue: { label: 'child' } }],
      parent,
    );
    const independent = environment([
      { provide: SETTINGS, useValue: { label: 'independent' } },
      providers,
    ]);
    const childConfig = createToolMap(registry(child))['heading'];
    expect(childConfig).toMatchObject({ config: parentConfig });
    expect(typeof childConfig !== 'function' && childConfig.config).toBe(
      parentConfig,
    );
    expect(registry(child)).toBe(registry(parent));
    expect(registry(independent)).not.toBe(registry(parent));
    expect(captured).toEqual(['parent', 'independent']);
  });

  it('runs factory contributions in order and preserves captured services in inert loaders', async () => {
    const SERVICE = new InjectionToken<{ load: () => Promise<typeof Heading> }>(
      'service',
    );
    const load = vi.fn(async () => Heading);
    const order: string[] = [];
    const owner = environment([
      { provide: SERVICE, useValue: { load } },
      provideEditorJsTools({
        factory: () => {
          order.push('first');
          const service = inject(SERVICE);
          return [
            {
              name: 'lazy',
              kind: 'block',
              source: 'lazy',
              load: () => service.load(),
            },
          ];
        },
      }),
      provideEditorJsTools({
        factory: () => {
          order.push('second');
          return [heading];
        },
      }),
    ]);
    const resolver = createToolResolver(registry(owner));
    expect(order).toEqual(['first', 'second']);
    expect(load).not.toHaveBeenCalled();
    await resolver.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    resolver.dispose();
  });

  it('takes core snapshots on first lookup without freezing opaque host configuration', () => {
    const config = { label: 'Heading' };
    const definitions: ToolDefinition[] = [
      { ...heading, registration: { class: Heading, config } },
    ];
    const owner = environment([provideEditorJsTools(definitions)]);
    const snapshot = registry(owner);
    definitions.length = 0;
    expect(snapshot.names).toEqual(['heading']);
    expect(Object.isFrozen(config)).toBe(false);
    expect(registry(owner)).toBe(snapshot);
  });

  it('rejects invalid wrapper/options shapes without calling accessors or bare functions', () => {
    const invoked = vi.fn(() => [heading]);
    for (const value of [
      invoked,
      Heading,
      {},
      { factory: 42 },
      { factory: invoked, extra: true },
    ]) {
      expect(() =>
        provideEditorJsTools(value as EditorJsToolContribution),
      ).toThrow(ToolRegistryError);
    }
    const accessor = Object.defineProperty({}, 'factory', { get: invoked });
    expect(() =>
      provideEditorJsTools(accessor as EditorJsToolContribution),
    ).toThrow(ToolRegistryError);
    expect(() => provideEditorJsTools([], { inherit: 'yes' } as never)).toThrow(
      ToolRegistryError,
    );
    expect(() => provideEditorJsTools([], { select: new Array(1) })).toThrow(
      ToolRegistryError,
    );
    expect(invoked).not.toHaveBeenCalled();
  });

  it('rejects asynchronous factories and observes rejected results; propagates synchronous factory errors', async () => {
    const owner = environment([
      provideEditorJsTools({
        factory: () => Promise.reject('async failure'),
      } as unknown as EditorJsToolContribution),
    ]);
    expect(() => registry(owner)).toThrow(
      expect.objectContaining({
        code: 'invalid-definition',
        path: ['providers', 0, 'factory'],
      }),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    const cause = new Error('factory failed');
    const failed = environment([
      provideEditorJsTools({
        factory: () => {
          throw cause;
        },
      }),
    ]);
    expect(() => registry(failed)).toThrow(cause);
  });
});

describe('provider environment lifetime', () => {
  it('does not evaluate an unused contribution when the environment is destroyed', () => {
    const factory = vi.fn(() => [heading]);
    const owner = environment([provideEditorJsTools({ factory })]);
    owner.destroy();
    expect(factory).not.toHaveBeenCalled();
  });

  it('binds cleanup to the actual parent owner and supports callback removal', () => {
    const parent = environment([provideEditorJsTools([heading])]);
    const child = environment([], parent);
    const scope = child.get(EDITOR_JS_TOOL_SCOPE);
    const cleanup = vi.fn();
    const removed = vi.fn();
    scope.destroyRef.onDestroy(cleanup);
    const unregister = scope.destroyRef.onDestroy(removed);
    unregister();
    child.destroy();
    expect(scope.destroyRef.destroyed).toBe(false);
    expect(cleanup).not.toHaveBeenCalled();
    parent.destroy();
    expect(scope.destroyRef.destroyed).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(removed).not.toHaveBeenCalled();
  });

  it('gives inherited child snapshots their own lifetime, leaving parent and siblings intact', async () => {
    const parent = environment([
      provideEditorJsTools([
        {
          name: 'lazy',
          kind: 'block',
          source: 'lazy',
          load: () => new Promise<typeof Heading>(() => undefined),
        },
      ]),
    ]);
    const child = environment(
      [provideEditorJsTools([], { inherit: true })],
      parent,
    );
    const sibling = environment(
      [provideEditorJsTools([], { inherit: true })],
      parent,
    );
    const scope = child.get(EDITOR_JS_TOOL_SCOPE);
    const resolver = createToolResolver(scope.registry);
    // Exercise the internal owner binding; component wiring is a separate slice.
    scope.destroyRef.onDestroy(() => resolver.dispose());
    const pending = expect(resolver.resolve()).rejects.toMatchObject({
      code: 'disposed',
    });
    child.destroy();
    await pending;
    expect(parent.get(EDITOR_JS_TOOL_SCOPE).destroyRef.destroyed).toBe(false);
    expect(sibling.get(EDITOR_JS_TOOL_SCOPE).destroyRef.destroyed).toBe(false);
    expect(registry(sibling).names).toEqual(['lazy']);
    expect(() => registry(child)).toThrow();
  });

  it('runs cleanup registered inside a DI contribution factory at environment destruction', () => {
    const cleanup = vi.fn();
    const owner = environment([
      provideEditorJsTools({
        factory: () => {
          inject(DestroyRef).onDestroy(cleanup);
          return [heading];
        },
      }),
    ]);
    registry(owner);
    owner.destroy();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
