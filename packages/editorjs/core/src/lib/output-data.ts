/** Values representable in JSON; runtime validation is still required for untrusted input. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;

/** A JSON object with string keys and JSON-compatible values. */
export interface JsonObject {
  [key: string]: JsonValue;
}

/** A JSON array. */
export type JsonArray = JsonValue[];

/**
 * Saved block structure compatible with Editor.js 2.x.
 *
 * Tool names are consumer-defined configuration keys, not a fixed set of plugins.
 * Data defaults to an opaque object: callers must narrow or validate it before
 * reading plugin-specific fields. This type does not prove JSON serializability.
 */
export interface OutputBlockData<
  Type extends string = string,
  Data extends object = object,
> {
  id?: string;
  type: Type;
  data: Data;
  /** Saved tune data is plugin-defined and must be narrowed before use. */
  tunes?: Record<string, unknown>;
}

/**
 * Derives a discriminated block union from a consumer's tool-name-to-data map.
 * Pass a finite map to preserve the relationship between each type and its data.
 */
export type OutputBlockDataFor<
  Tools extends { [Type in keyof Tools]: object },
> = {
  [Type in Extract<keyof Tools, string>]: OutputBlockData<Type, Tools[Type]>;
}[Extract<keyof Tools, string>];

/**
 * Saved Editor.js document. Metadata is optional, matching upstream input types.
 * Parameterize with a block union only after validating external/plugin data.
 */
export interface OutputData<Block extends OutputBlockData = OutputBlockData> {
  /** Editor.js version, not an application schema version. */
  version?: string;
  /** Save timestamp in milliseconds. */
  time?: number;
  blocks: Block[];
}
