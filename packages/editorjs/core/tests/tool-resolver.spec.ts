import type { EditorConfig, ToolConstructable } from '@editorjs/editorjs';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  composeToolRegistry,
  createToolMap,
  createToolResolver,
  EDITOR_JS_2_31_7_TOOL_PROFILE as profile,
  selectToolRegistry,
  ToolRegistryError,
  type ToolConstructor,
  type ToolDefinition,
  type ToolResolver,
} from '../src/index.js';

class Heading {
  readonly heading = true;
}
class Inline {
  readonly inline = true;
}
class Tune {
  readonly tune = true;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const lazy = <const Name extends string, Tool extends ToolConstructor>(
  name: Name,
  load: () => Promise<Tool>,
) => ({ name, kind: 'block', source: 'lazy', load }) as const;

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('Expected resolution to fail');
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(ToolRegistryError);
      return error as ToolRegistryError;
    },
  );
const drain = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('owner-scoped tool resolution', () => {
  it('keeps construction inert and resolves only the selection without constructing or reading hooks', async () => {
    const hook = vi.fn(() => {
      throw new Error('Do not read hooks');
    });
    class Inert {
      constructor() {
        throw new Error('Do not construct');
      }
      static get isInline() {
        return hook();
      }
      static get prepare() {
        return hook();
      }
    }
    const selectedLoad = vi.fn(async () => Inert);
    const omittedLoad = vi.fn(async () => Heading);
    const registry = composeToolRegistry(
      [[lazy('selected', selectedLoad), lazy('omitted', omittedLoad)]],
      { profile },
    );
    const resolver = createToolResolver(
      selectToolRegistry(registry, ['selected']),
    );
    expect(selectedLoad).not.toHaveBeenCalled();
    expect(omittedLoad).not.toHaveBeenCalled();
    expect((await resolver.resolve()).selected.class).toBe(Inert);
    expect(selectedLoad).toHaveBeenCalledTimes(1);
    expect(omittedLoad).not.toHaveBeenCalled();
    expect(hook).not.toHaveBeenCalled();
    resolver.dispose();
  });

  it('shares one concurrent attempt, loads in selection order, and outputs all kinds in that order', async () => {
    const block = deferred<typeof Heading>();
    const inline = deferred<typeof Inline>();
    const tune = deferred<typeof Tune>();
    const calls: string[] = [];
    const registry = composeToolRegistry(
      [
        [
          lazy('heading', () => {
            calls.push('heading');
            return block.promise;
          }),
          {
            ...lazy('inline', () => {
              calls.push('inline');
              return inline.promise;
            }),
            kind: 'inline',
          },
          {
            ...lazy('tune', () => {
              calls.push('tune');
              return tune.promise;
            }),
            kind: 'tune',
          },
        ],
      ],
      { profile },
    );
    const resolver = createToolResolver(
      selectToolRegistry(registry, ['tune', 'heading', 'inline']),
    );
    const first = resolver.resolve();
    const second = resolver.resolve();
    expect(calls).toEqual(['tune', 'heading', 'inline']);
    let settled = false;
    void first.then(() => {
      settled = true;
    });
    inline.resolve(Inline);
    block.resolve(Heading);
    await drain();
    expect(settled).toBe(false);
    tune.resolve(Tune);
    const [a, b] = await Promise.all([first, second]);
    expect(Object.keys(a)).toEqual(['tune', 'heading', 'inline']);
    expect(Object.getPrototypeOf(a)).toBeNull();
    expect(a).not.toBe(b);
    expect(a.heading).not.toBe(b.heading);
    expectTypeOf(a.heading.class).toEqualTypeOf<typeof Heading>();
    expectTypeOf(a.inline.class).toEqualTypeOf<typeof Inline>();
    expectTypeOf(a.tune.class).toEqualTypeOf<typeof Tune>();
    const later = await resolver.resolve();
    expect(later).not.toBe(a);
    expect(later.heading.class).toBe(Heading);
    expect(calls).toEqual(['tune', 'heading', 'inline']);
    resolver.dispose();
  });

  it('copies output containers for every waiter and cached call while preserving opaque identities', async () => {
    const service = new Tune();
    const config = { service, transform: (text: string) => text.toUpperCase() };
    const data = { text: 'default' };
    const settings = {
      config,
      toolbox: [{ title: 'Heading', data }],
      inlineToolbar: ['bold'],
      tunes: ['delete'],
    };
    const load = vi.fn(async () => Heading);
    const registry = composeToolRegistry(
      [
        [
          { ...lazy('heading', load), settings },
          {
            name: 'eager',
            kind: 'block',
            source: 'eager',
            registration: { class: Heading, ...settings },
          },
          {
            name: 'direct',
            kind: 'block',
            source: 'eager',
            registration: Heading,
          },
        ],
      ],
      { profile },
    );
    const resolver = createToolResolver(registry);
    const [first, second] = await Promise.all([
      resolver.resolve(),
      resolver.resolve(),
    ]);
    first.heading.toolbox[0].title = 'changed';
    first.heading.inlineToolbar.push('italic');
    first.heading.tunes.push('moveUp');
    first.eager.toolbox.length = 0;
    const third = await resolver.resolve();
    for (const map of [second, third]) {
      expect(map.heading.toolbox[0].title).toBe('Heading');
      expect(map.heading.inlineToolbar).toEqual(['bold']);
      expect(map.heading.tunes).toEqual(['delete']);
      expect(map.eager.toolbox).toHaveLength(1);
      expect(map.direct).toBe(Heading);
      expect(map.heading.config).toBe(config);
      expect(map.heading.config.service).toBe(service);
      expect(map.heading.config.transform).toBe(config.transform);
      expect(map.heading.toolbox[0].data).toBe(data);
    }
    expect(Object.isFrozen(config)).toBe(false);
    expect(Object.isFrozen(data)).toBe(false);
    expectTypeOf(third.heading.config).toEqualTypeOf<typeof config>();
    expectTypeOf(third.heading.toolbox[0].data).toEqualTypeOf<typeof data>();
    expect(load).toHaveBeenCalledTimes(1);
    resolver.dispose();
  });

  it('uses the eager builder semantics for empty and eager-only selections', async () => {
    for (const registry of [
      composeToolRegistry([], { profile }),
      composeToolRegistry(
        [
          [
            {
              name: 'heading',
              kind: 'block',
              source: 'eager',
              registration: Heading,
            },
          ],
        ],
        { profile },
      ),
    ]) {
      const resolver = createToolResolver(registry);
      expect(await resolver.resolve()).toEqual(createToolMap(registry));
      resolver.dispose();
    }
  });

  it('rejects direct classes named then before promise assimilation can invoke them', async () => {
    const invoked = vi.fn();
    const tool = function () {
      invoked();
    } as unknown as typeof Heading;
    const load = vi.fn(async () => Heading);
    const resolver = createToolResolver(
      composeToolRegistry(
        [
          [
            lazy('heading', load),
            {
              name: 'then',
              kind: 'block',
              source: 'eager',
              registration: tool,
            },
          ],
        ],
        { profile },
      ),
    );
    const error = await failure(resolver.resolve());
    expect(error.code).toBe('invalid-definition');
    expect(error.toolName).toBe('then');
    expect(error.path).toEqual(['tools', 'then', 'registration']);
    expect(invoked).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    resolver.dispose();

    const configured = createToolResolver(
      composeToolRegistry(
        [
          [
            {
              name: 'then',
              kind: 'block',
              source: 'eager',
              registration: { class: tool },
            },
          ],
        ],
        { profile },
      ),
    );
    expect((await configured.resolve()).then.class).toBe(tool);
    const lazyThen = createToolResolver(
      composeToolRegistry([[lazy('then', load)]], { profile }),
    );
    expect((await lazyThen.resolve()).then.class).toBe(Heading);
    expect(invoked).not.toHaveBeenCalled();
    configured.dispose();
    lazyThen.dispose();
  });

  it('snapshots the reference context and checks selected references before loading', async () => {
    const load = vi.fn(async () => Heading);
    const registry = composeToolRegistry([[lazy('heading', load)]], {
      profile,
    });
    const context = {
      defaultBlock: 'heading',
      inlineToolbar: ['bold'],
      tunes: ['delete'],
    };
    const resolver = createToolResolver(registry, context);
    context.defaultBlock = 'missing';
    context.inlineToolbar.push('missing');
    context.tunes.push('missing');
    await resolver.resolve();
    const invalid = createToolResolver(registry, context);
    const error = await failure(invalid.resolve());
    expect(error.code).toBe('invalid-reference');
    expect(error.toolName).toBe('missing');
    expect(load).toHaveBeenCalledTimes(1);
    const wrongKind = createToolResolver(registry, {
      inlineToolbar: ['heading'],
    });
    expect((await failure(wrongKind.resolve())).code).toBe('invalid-reference');
    expect(load).toHaveBeenCalledTimes(1);
    resolver.dispose();
    invalid.dispose();
    wrongKind.dispose();
  });

  it('keeps caches separate across owners and definitions even for the same loader function', async () => {
    const load = vi.fn(async () => Heading);
    const registry = composeToolRegistry(
      [[lazy('one', load), lazy('two', load)]],
      { profile },
    );
    const first = createToolResolver(registry);
    const second = createToolResolver(registry);
    await Promise.all([first.resolve(), first.resolve(), second.resolve()]);
    expect(load).toHaveBeenCalledTimes(4);
    first.dispose();
    await second.resolve();
    expect(load).toHaveBeenCalledTimes(4);
    second.dispose();
  });

  it('preserves the pinned upstream constructor type in a resolved map', async () => {
    const registry = composeToolRegistry(
      [[lazy('heading', async () => Heading as unknown as ToolConstructable)]],
      { profile },
    );
    const resolver = createToolResolver(registry);
    const tools = await resolver.resolve();
    expectTypeOf<{ tools: typeof tools }>().toExtend<EditorConfig>();
    expect(tools.heading.class).toBe(Heading);
    // @ts-expect-error Lazy loaders return constructors, not module namespaces.
    const invalid: ToolDefinition = lazy('invalid', async () => ({
      default: Heading,
    }));
    void invalid;
    resolver.dispose();
  });
});

describe('resolution failure and recovery', () => {
  it.each(['throw', 'reject'] as const)(
    'wraps a loader %s with its original cause and supports explicit retry',
    async (mode) => {
      const cause = { reason: 'unavailable' };
      const load = vi
        .fn<() => Promise<typeof Heading>>()
        .mockImplementationOnce(() => {
          if (mode === 'throw') throw cause;
          return Promise.reject(cause);
        })
        .mockResolvedValue(Heading);
      const resolver = createToolResolver(
        composeToolRegistry([[lazy('heading', load)]], { profile }),
      );
      const error = await failure(resolver.resolve());
      expect(error.code).toBe('load-failed');
      expect(error.cause).toBe(cause);
      expect(error.toolName).toBe('heading');
      expect(error.path).toEqual(['tools', 'heading', 'load']);
      await drain();
      expect(load).toHaveBeenCalledTimes(1);
      expect((await resolver.resolve()).heading.class).toBe(Heading);
      expect(load).toHaveBeenCalledTimes(2);
      resolver.dispose();
    },
  );

  it.each([undefined, null, 42, {}, { default: Heading }])(
    'rejects invalid loaded value %j',
    async (value) => {
      const load = vi.fn(async () => value as unknown as typeof Heading);
      const resolver = createToolResolver(
        composeToolRegistry([[lazy('heading', load)]], { profile }),
      );
      const error = await failure(resolver.resolve());
      expect(error.code).toBe('invalid-loaded-constructor');
      expect(error.cause).toBe(value);
      expect(error.toolName).toBe('heading');
      expect(error.path).toEqual(['tools', 'heading', 'load']);
      resolver.dispose();
    },
  );

  it.each(['fulfill', 'reject'] as const)(
    'discards partial success and ignores stale sibling %s during retry',
    async (lateOutcome) => {
      const completed = vi.fn(async () => Heading);
      const bad = deferred<typeof Heading>();
      const old = deferred<typeof Heading>();
      const fresh = deferred<typeof Heading>();
      const fails = vi
        .fn<() => Promise<typeof Heading>>()
        .mockReturnValueOnce(bad.promise)
        .mockResolvedValue(Heading);
      const slow = vi
        .fn<() => Promise<typeof Heading>>()
        .mockReturnValueOnce(old.promise)
        .mockReturnValue(fresh.promise);
      const resolver = createToolResolver(
        composeToolRegistry(
          [
            [
              lazy('completed', completed),
              lazy('fails', fails),
              lazy('slow', slow),
            ],
          ],
          { profile },
        ),
      );
      const first = failure(resolver.resolve());
      const joined = failure(resolver.resolve());
      await drain();
      bad.reject('first failure');
      const [a, b] = await Promise.all([first, joined]);
      expect(a).toBe(b);
      expect(a.cause).toBe('first failure');
      let settled = false;
      const retry = resolver.resolve();
      void retry.then(() => {
        settled = true;
      });
      if (lateOutcome === 'fulfill')
        old.resolve(Inline as unknown as typeof Heading);
      else old.reject('stale rejection');
      await drain();
      expect(settled).toBe(false);
      fresh.resolve(Heading);
      expect((await retry).slow.class).toBe(Heading);
      for (const load of [completed, fails, slow])
        expect(load).toHaveBeenCalledTimes(2);
      expect((await resolver.resolve()).slow.class).toBe(Heading);
      expect(slow).toHaveBeenCalledTimes(2);
      resolver.dispose();
    },
  );

  it('reports the first observed asynchronous failure and observes later rejections', async () => {
    const a = deferred<typeof Heading>();
    const b = deferred<typeof Heading>();
    const resolver = createToolResolver(
      composeToolRegistry(
        [[lazy('a', () => a.promise), lazy('b', () => b.promise)]],
        { profile },
      ),
    );
    const result = failure(resolver.resolve());
    b.reject('b first');
    expect((await result).toolName).toBe('b');
    a.reject('a later');
    await drain();
    resolver.dispose();
  });
});

describe('disposal and reentrant loaders', () => {
  it('disposes before loading and rejects all future calls', async () => {
    const load = vi.fn(async () => Heading);
    const resolver = createToolResolver(
      composeToolRegistry([[lazy('heading', load)]], { profile }),
    );
    resolver.dispose();
    resolver.dispose();
    expect((await failure(resolver.resolve())).code).toBe('disposed');
    expect(load).not.toHaveBeenCalled();
  });

  it('promptly rejects joined calls even if a loader never settles', async () => {
    const never = new Promise<typeof Heading>(() => undefined);
    const resolver = createToolResolver(
      composeToolRegistry([[lazy('heading', () => never)]], { profile }),
    );
    const first = failure(resolver.resolve());
    const second = failure(resolver.resolve());
    resolver.dispose();
    resolver.dispose();
    const errors = await Promise.all([first, second]);
    expect(errors[0].code).toBe('disposed');
    expect(errors[1]).toBe(errors[0]);
    expect((await failure(resolver.resolve())).code).toBe('disposed');
  });

  it.each(['fulfill', 'reject'] as const)(
    'observes late %s after disposal without reviving the owner',
    async (outcome) => {
      const pending = deferred<typeof Heading>();
      const load = vi.fn(() => pending.promise);
      const resolver = createToolResolver(
        composeToolRegistry([[lazy('heading', load)]], { profile }),
      );
      const result = failure(resolver.resolve());
      resolver.dispose();
      expect((await result).code).toBe('disposed');
      if (outcome === 'fulfill') pending.resolve(Heading);
      else pending.reject('late rejection');
      await drain();
      expect((await failure(resolver.resolve())).code).toBe('disposed');
      expect(load).toHaveBeenCalledTimes(1);
    },
  );

  it('invalidates success before delivery and clears already successful caches', async () => {
    const registry = composeToolRegistry(
      [
        [
          {
            name: 'heading',
            kind: 'block',
            source: 'eager',
            registration: Heading,
          },
        ],
      ],
      { profile },
    );
    const resolver = createToolResolver(registry);
    const result = failure(resolver.resolve());
    resolver.dispose();
    expect((await result).code).toBe('disposed');
    const load = vi.fn(async () => Heading);
    const loaded = createToolResolver(
      composeToolRegistry([[lazy('heading', load)]], { profile }),
    );
    const previous = await loaded.resolve();
    const cached = failure(loaded.resolve());
    loaded.dispose();
    expect((await cached).code).toBe('disposed');
    expect(previous.heading.class).toBe(Heading);
    expect((await failure(loaded.resolve())).code).toBe('disposed');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('joins reentrant resolution instead of invoking the loader twice', async () => {
    let joined: Promise<unknown> | undefined;
    const load = vi.fn(() => {
      joined = resolver.resolve();
      return Promise.resolve(Heading);
    });
    const resolver: ToolResolver = createToolResolver(
      composeToolRegistry([[lazy('heading', load)]], { profile }),
    );
    const result = await resolver.resolve();
    expect(await joined).toEqual(result);
    expect(load).toHaveBeenCalledTimes(1);
    resolver.dispose();
  });

  it('stops starting loaders when a loader disposes synchronously and observes its rejection', async () => {
    const skipped = vi.fn(async () => Heading);
    const load = () => {
      resolver.dispose();
      return Promise.reject('after disposal');
    };
    const resolver: ToolResolver = createToolResolver(
      composeToolRegistry([[lazy('first', load), lazy('skipped', skipped)]], {
        profile,
      }),
    );
    expect((await failure(resolver.resolve())).code).toBe('disposed');
    await drain();
    expect(skipped).not.toHaveBeenCalled();
  });
});
