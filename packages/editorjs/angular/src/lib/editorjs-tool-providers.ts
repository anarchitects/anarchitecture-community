import {
  DestroyRef,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import {
  composeToolRegistry,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  selectToolRegistry,
  ToolRegistryError,
  type ToolDefinition,
  type ToolRegistry,
} from '@anarchitects/editorjs-core';

/** A synchronous DI factory produces inert definitions, never loaded tools. */
export type EditorJsToolContribution<
  Definitions extends readonly ToolDefinition[] = readonly ToolDefinition[],
> = Definitions | { readonly factory: () => Definitions };

export interface EditorJsToolProviderOptions {
  /** Local contributions isolate by default. Inheritance uses the selected parent. */
  readonly inherit?: boolean;
  /** Select after composing all local contributions and any inherited snapshot. */
  readonly select?: readonly string[];
}

interface Contribution {
  readonly definitions:
    | readonly ToolDefinition[]
    | (() => readonly ToolDefinition[]);
  readonly options: Readonly<{ inherit: boolean; select?: readonly string[] }>;
}

const CONTRIBUTIONS = new InjectionToken<readonly Contribution[]>(
  'anarchitects.editorjs.tool-contributions',
);

/** Internal ownership seam shared with the component integration; not a public export. */
export interface EditorJsToolScope {
  readonly registry: ToolRegistry;
  readonly destroyRef: DestroyRef;
}

export const EDITOR_JS_TOOL_SCOPE = new InjectionToken<EditorJsToolScope>(
  'anarchitects.editorjs.tool-scope',
);

/** Optional, immutable environment snapshot. Lookup never invokes tool loaders. */
export const EDITOR_JS_TOOL_REGISTRY = new InjectionToken<ToolRegistry>(
  'anarchitects.editorjs.tool-registry',
);

function record(
  value: unknown,
  keys: readonly string[],
  path: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    throw new ToolRegistryError('invalid-options', path);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key))
      throw new ToolRegistryError('invalid-options', path);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor))
      throw new ToolRegistryError('invalid-options', [...path, key]);
    result[key] = descriptor.value;
  }
  return result;
}

function optionsSnapshot(
  value: EditorJsToolProviderOptions,
): Contribution['options'] {
  const options = record(
    value,
    ['inherit', 'select'],
    ['providers', 'options'],
  );
  if (
    options['inherit'] !== undefined &&
    typeof options['inherit'] !== 'boolean'
  )
    throw new ToolRegistryError('invalid-options', [
      'providers',
      'options',
      'inherit',
    ]);
  const names = options['select'];
  let select: string[] | undefined;
  if (names !== undefined) {
    if (!Array.isArray(names))
      throw new ToolRegistryError('invalid-options', [
        'providers',
        'options',
        'select',
      ]);
    select = [];
    for (let i = 0; i < names.length; i++) {
      const item = Object.getOwnPropertyDescriptor(names, String(i));
      if (!item || !('value' in item) || typeof item.value !== 'string')
        throw new ToolRegistryError('invalid-options', [
          'providers',
          'options',
          'select',
          i,
        ]);
      select.push(item.value);
    }
    Object.freeze(select);
  }
  return Object.freeze({ inherit: options['inherit'] === true, select });
}

function createScope(): EditorJsToolScope {
  const contributions = inject(CONTRIBUTIONS, { self: true });
  const options = contributions[0].options;
  contributions.forEach((entry, index) => {
    const other = entry.options;
    if (
      options.inherit !== other.inherit ||
      options.select?.length !== other.select?.length ||
      options.select?.some((name, i) => name !== other.select?.[i])
    )
      throw new ToolRegistryError('invalid-options', [
        'providers',
        index,
        'options',
      ]);
  });
  const parent = options.inherit
    ? inject(EDITOR_JS_TOOL_SCOPE, { skipSelf: true, optional: true })
    : null;
  const destroyRef = inject(DestroyRef);
  const groups = contributions.map((entry, index) => {
    if (typeof entry.definitions !== 'function') return entry.definitions;
    const definitions = entry.definitions(); // The owning provider factory's synchronous DI context.
    if (!Array.isArray(definitions)) {
      // A mistakenly async factory is invalid, but its rejection still needs an observer.
      if (definitions instanceof Promise)
        void definitions.catch(() => undefined);
      throw new ToolRegistryError('invalid-definition', [
        'providers',
        index,
        'factory',
      ]);
    }
    return definitions;
  });
  const registry = composeToolRegistry(groups, {
    profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
    base: parent?.registry,
  });
  return Object.freeze({
    registry:
      options.select === undefined
        ? registry
        : selectToolRegistry(registry, options.select),
    destroyRef,
  });
}

/** Contribute definitions in provider order to one application/route environment. */
export function provideEditorJsTools<
  const Definitions extends readonly ToolDefinition[],
>(
  contribution: EditorJsToolContribution<Definitions>,
  options: EditorJsToolProviderOptions = {},
): EnvironmentProviders {
  let definitions: Contribution['definitions'];
  if (Array.isArray(contribution)) definitions = contribution;
  else {
    const wrapper = record(
      contribution,
      ['factory'],
      ['providers', 'contribution'],
    );
    if (typeof wrapper['factory'] !== 'function')
      throw new ToolRegistryError('invalid-definition', [
        'providers',
        'contribution',
        'factory',
      ]);
    definitions = wrapper['factory'] as () => Definitions;
  }
  const entry: Contribution = Object.freeze({
    definitions,
    options: optionsSnapshot(options),
  });
  return makeEnvironmentProviders([
    { provide: CONTRIBUTIONS, multi: true, useValue: entry },
    { provide: EDITOR_JS_TOOL_SCOPE, useFactory: createScope },
    {
      provide: EDITOR_JS_TOOL_REGISTRY,
      useFactory: () => inject(EDITOR_JS_TOOL_SCOPE).registry,
    },
  ]);
}
