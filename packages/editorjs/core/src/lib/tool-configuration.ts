/**
 * Opaque reference to a host-supplied tool class, preserving its constructor type.
 * Core never constructs tools or defines their browser lifecycle.
 */
export type ToolConstructor = abstract new (...args: never[]) => object;

/** A toolbox entry may override part of the tool's saved data. */
export interface ToolboxEntry<Data extends object = object> {
  title?: string;
  /** Host-supplied icon markup; core does not sanitize it. */
  icon?: string;
  data?: Partial<Data>;
}

/** Editor.js-compatible options shared by external tool registrations. */
export interface ToolOptions<Data extends object = object> {
  inlineToolbar?: boolean | string[];
  tunes?: boolean | string[];
  shortcut?: string;
  toolbox?: ToolboxEntry<Data> | ToolboxEntry<Data>[] | false;
}

/**
 * Typed configuration for a host-supplied external tool class.
 * Config may contain callbacks or services and is not a persisted JSON document.
 * The host verifies the class implements its editor's tool API.
 */
export interface ToolConfiguration<
  Tool extends ToolConstructor = ToolConstructor,
  Config extends object = object,
  Data extends object = object,
> extends ToolOptions<Data> {
  class: Tool;
  config?: Config;
}

/** Register a class directly or provide its configuration and editor options. */
export type ToolRegistration<
  Tool extends ToolConstructor = ToolConstructor,
  Config extends object = object,
  Data extends object = object,
> = Tool | ToolConfiguration<Tool, Config, Data>;
