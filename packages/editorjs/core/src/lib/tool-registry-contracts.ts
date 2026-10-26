import type {
  ToolConfiguration,
  ToolConstructor,
  ToolOptions,
  ToolboxEntry,
} from './tool-configuration.js';

export type ToolKind = 'block' | 'inline' | 'tune';

/** Readonly containers are accepted; opaque config/data retain their identity. */
type Settings<Config extends object, Data extends object> = Readonly<
  Omit<ToolOptions<Data>, 'inlineToolbar' | 'tunes' | 'toolbox'> & {
    config?: Config;
    inlineToolbar?: boolean | readonly string[];
    tunes?: boolean | readonly string[];
    toolbox?:
      | Readonly<ToolboxEntry<Data>>
      | readonly Readonly<ToolboxEntry<Data>>[]
      | false;
  }
>;

/** A declaration only: composition never invokes a class, loader or static hook. */
export type ToolDefinition<
  Tool extends ToolConstructor = ToolConstructor,
  Config extends object = object,
  Data extends object = object,
  Name extends string = string,
> = Readonly<{
  name: Name;
  kind: ToolKind;
  replace?: true;
}> &
  (
    | Readonly<{
        source: 'eager';
        registration:
          | Tool
          | (Settings<Config, Data> & { readonly class: Tool });
        load?: never;
        settings?: never;
      }>
    | Readonly<{
        source: 'lazy';
        load: () => Promise<Tool>;
        settings?: Settings<Config, Data>;
        registration?: never;
      }>
  );

export interface BuiltInTool {
  readonly name: string;
  readonly kind: ToolKind;
  /** Reserved helpers cannot be replaced or used as the default block. */
  readonly reserved?: true;
}

export interface BuiltInToolProfile {
  readonly tools: readonly BuiltInTool[];
  readonly defaultBlock?: string;
}

export interface ToolReferenceContext {
  readonly defaultBlock?: string;
  readonly initialBlock?: string;
  readonly inlineToolbar?: boolean | readonly string[];
  readonly tunes?: readonly string[];
}

export type ToolRegistryErrorCode =
  | 'invalid-definition'
  | 'invalid-name'
  | 'invalid-options'
  | 'invalid-profile'
  | 'invalid-registry'
  | 'duplicate-name'
  | 'invalid-replacement'
  | 'invalid-selection'
  | 'invalid-reference'
  | 'unresolved-tool';

/** Structured configuration diagnostic; never serializes caller configuration. */
export class ToolRegistryError extends Error {
  readonly path: readonly (string | number)[];

  constructor(
    readonly code: ToolRegistryErrorCode,
    path: readonly (string | number)[],
    readonly toolName?: string,
    options?: ErrorOptions,
  ) {
    super(`Tool registry error: ${code}.`, options);
    this.name = 'ToolRegistryError';
    this.path = Object.freeze([...path]);
  }
}

export type ToolRegistryEntries = Record<string, ToolDefinition>;
declare const registryBrand: unique symbol;

/** Opaque immutable snapshot. Only composition/selection create registries. */
export interface ToolRegistry<
  Entries extends ToolRegistryEntries = ToolRegistryEntries,
> {
  readonly [registryBrand]: Entries;
  readonly names: readonly string[];
  readonly profile: BuiltInToolProfile;
}

type MutableToolbox<T> = T extends readonly (infer E)[]
  ? { -readonly [K in keyof E]: E[K] }[]
  : T extends object
    ? { -readonly [K in keyof T]: T[K] }
    : T;

type MutableNames<T> = T extends readonly string[] ? T[number][] : T;

type MutableSettings<T> = {
  -readonly [K in keyof T]: K extends 'inlineToolbar' | 'tunes'
    ? MutableNames<T[K]>
    : K extends 'toolbox'
      ? MutableToolbox<T[K]>
      : T[K];
};

type Registration<D> = D extends { source: 'eager'; registration: infer R }
  ? R extends ToolConstructor
    ? R
    : MutableSettings<R>
  : D extends { source: 'lazy'; load: () => Promise<infer T> }
    ? { class: T } & (D extends { settings: infer S }
        ? MutableSettings<S>
        : D extends { settings?: infer S }
          ? MutableSettings<NonNullable<S>>
          : object)
    : ToolConfiguration;

/** Typed output shared by eager materialization and future lazy resolution. */
export type ToolRegistryTools<Entries extends ToolRegistryEntries> = {
  [K in keyof Entries]: Registration<Entries[K]>;
};

type IsUnion<T, Whole = T> = T extends unknown
  ? [Whole] extends [T]
    ? false
    : true
  : never;

type Add<Entries, D extends ToolDefinition> = string extends D['name']
  ? Record<string, Entries[keyof Entries] | D>
  : true extends IsUnion<D['name']>
    ? Record<string, Entries[keyof Entries] | D>
    : Omit<Entries, D['name']> & {
        [K in D['name']]: D;
      };

// Tuples preserve the final replacement type; dynamic arrays conservatively keep unions.
type AddDefinitions<
  Entries,
  Definitions extends readonly ToolDefinition[],
> = Definitions extends readonly [
  infer Head extends ToolDefinition,
  ...infer Tail extends readonly ToolDefinition[],
]
  ? AddDefinitions<Add<Entries, Head>, Tail>
  : number extends Definitions['length']
    ? string extends Definitions[number]['name']
      ? Record<string, Entries[keyof Entries] | Definitions[number]>
      : {
          [K in keyof Entries | Definitions[number]['name']]:
            | (K extends keyof Entries ? Entries[K] : never)
            | (Definitions[number] extends infer D extends ToolDefinition
                ? K extends D['name']
                  ? D
                  : never
                : never);
        }
    : Entries;

export type ComposedToolEntries<
  Groups extends readonly (readonly ToolDefinition[])[],
  Base extends ToolRegistryEntries,
> = Groups extends readonly [
  infer Head extends readonly ToolDefinition[],
  ...infer Tail extends readonly (readonly ToolDefinition[])[],
]
  ? ComposedToolEntries<Tail, AddDefinitions<Base, Head>>
  : number extends Groups['length']
    ? AddDefinitions<Base, Groups[number]>
    : Base;
